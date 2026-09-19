from pathlib import Path

import pandas as pd


FEMA_FILE = Path(
    "data/reference/fema/"
    "county_disaster_declarations.csv"
)


VULNERABILITY_FILE = Path(
    "data/processed/vulnerability/"
    "county_vulnerability_exposure.csv"
)


OUTPUT_FOLDER = Path(
    "data/processed/historical"
)


# -------------------------------------------------
# 1. Load data
# -------------------------------------------------

fema = pd.read_csv(
    FEMA_FILE,
    dtype={
        "county_fips": "string",
    },
)


counties = pd.read_csv(
    VULNERABILITY_FILE,
    dtype={
        "county_fips": "string",
    },
)


fema["county_fips"] = (
    fema["county_fips"]
    .str.zfill(5)
)


counties["county_fips"] = (
    counties["county_fips"]
    .str.zfill(5)
)


# -------------------------------------------------
# 2. Convert FEMA declaration date
# -------------------------------------------------

fema["declaration_date"] = (
    pd.to_datetime(
        fema["declaration_date"],
        errors="coerce",
        utc=True,
    )
)


# -------------------------------------------------
# 3. Define historical windows
# -------------------------------------------------

now = pd.Timestamp.now(
    tz="UTC"
)


ten_year_cutoff = (
    now - pd.DateOffset(years=10)
)


# -------------------------------------------------
# 4. 10-year declarations
# -------------------------------------------------

recent = fema[
    fema["declaration_date"]
    >= ten_year_cutoff
].copy()


# -------------------------------------------------
# 5. Aggregate FEMA history by county
# -------------------------------------------------

all_history = (
    fema
    .groupby(
        "county_fips",
        as_index=False,
    )
    .agg(
        fema_declarations_since_2000=(
            "disaster_number",
            "nunique",
        ),

        last_fema_declaration=(
            "declaration_date",
            "max",
        ),

        historical_incident_types=(
            "incident_type",
            "nunique",
        ),
    )
)


recent_history = (
    recent
    .groupby(
        "county_fips",
        as_index=False,
    )
    .agg(
        fema_declarations_10y=(
            "disaster_number",
            "nunique",
        ),

        incident_types_10y=(
            "incident_type",
            "nunique",
        ),
    )
)


# -------------------------------------------------
# 6. Count FEMA declaration categories
# -------------------------------------------------

major = (
    recent[
        recent["declaration_type"]
        == "DR"
    ]
    .groupby(
        "county_fips"
    )["disaster_number"]
    .nunique()
    .rename(
        "major_disasters_10y"
    )
)


emergency = (
    recent[
        recent["declaration_type"]
        == "EM"
    ]
    .groupby(
        "county_fips"
    )["disaster_number"]
    .nunique()
    .rename(
        "emergencies_10y"
    )
)


fire = (
    recent[
        recent["declaration_type"]
        == "FM"
    ]
    .groupby(
        "county_fips"
    )["disaster_number"]
    .nunique()
    .rename(
        "fire_management_10y"
    )
)


declaration_types = pd.concat(
    [
        major,
        emergency,
        fire,
    ],
    axis=1,
).fillna(0).reset_index()


# -------------------------------------------------
# 7. Combine FEMA features
# -------------------------------------------------

history = (
    all_history
    .merge(
        recent_history,
        on="county_fips",
        how="left",
    )
    .merge(
        declaration_types,
        on="county_fips",
        how="left",
    )
)


numeric_fill_columns = [
    "fema_declarations_10y",
    "incident_types_10y",
    "major_disasters_10y",
    "emergencies_10y",
    "fire_management_10y",
]


history[
    numeric_fill_columns
] = (
    history[
        numeric_fill_columns
    ]
    .fillna(0)
)


# -------------------------------------------------
# 8. Join history to CURRENT affected counties
# -------------------------------------------------

combined = counties.merge(
    history,
    on="county_fips",
    how="left",
)


# A county without a FEMA history match does not
# automatically mean missing data. It may simply
# have no qualifying declaration in our window.

history_columns = [
    "fema_declarations_since_2000",
    "historical_incident_types",
    "fema_declarations_10y",
    "incident_types_10y",
    "major_disasters_10y",
    "emergencies_10y",
    "fire_management_10y",
]


combined[
    history_columns
] = (
    combined[
        history_columns
    ]
    .fillna(0)
)


# -------------------------------------------------
# 9. Print analytical summary
# -------------------------------------------------

print("\n====================================")
print("CRISISOPS - FEMA HISTORY")
print("====================================")


print(
    f"\nCurrent affected counties: "
    f"{len(combined)}"
)


print(
    "Counties with FEMA declarations "
    f"since 2000: "
    f"{(combined['fema_declarations_since_2000'] > 0).sum()}"
)


print(
    "\nHighest 10-year FEMA disaster burden:"
)


print(
    combined
    .sort_values(
        "fema_declarations_10y",
        ascending=False,
    )
    [
        [
            "county_full_name",
            "population",
            "svi_overall",
            "fema_declarations_10y",
            "major_disasters_10y",
            "emergencies_10y",
            "fire_management_10y",
            "incident_types_10y",
        ]
    ]
    .head(20)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# 10. Save result
# -------------------------------------------------

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "county_crisis_context.csv"
)


combined.to_csv(
    OUTPUT_FILE,
    index=False,
)


print(
    "\nHistorical crisis context saved to:"
)


print(
    OUTPUT_FILE
)


print("\n====================================")
print("FEMA HISTORY COMPLETE")
print("====================================")