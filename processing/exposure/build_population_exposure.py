from pathlib import Path

import pandas as pd


ALERT_COUNTIES_FILE = Path(
    "data/processed/geography/alert_counties.csv"
)

POPULATION_FILE = Path(
    "data/reference/census/county_population.csv"
)

OUTPUT_FOLDER = Path(
    "data/processed/exposure"
)


# -------------------------------------------------
# Load datasets
# -------------------------------------------------

alerts = pd.read_csv(
    ALERT_COUNTIES_FILE,
    dtype={
        "county_fips": "string",
    },
)


population = pd.read_csv(
    POPULATION_FILE,
    dtype={
        "county_fips": "string",
    },
)


# Protect 5-digit FIPS formatting
alerts["county_fips"] = (
    alerts["county_fips"]
    .str.zfill(5)
)

population["county_fips"] = (
    population["county_fips"]
    .str.zfill(5)
)


# -------------------------------------------------
# Join alerts to Census population
# -------------------------------------------------

exposure = alerts.merge(
    population,
    on="county_fips",
    how="left",
)


matched = (
    exposure["population"]
    .notna()
    .sum()
)

unmatched = (
    exposure["population"]
    .isna()
    .sum()
)

match_rate = (
    matched / len(exposure) * 100
    if len(exposure) > 0
    else 0
)


print("\n====================================")
print("CRISISOPS - POPULATION EXPOSURE")
print("====================================")

print(
    f"\nAlert-county relationships: "
    f"{len(exposure)}"
)

print(
    f"Population matched: {matched}"
)

print(
    f"Population unmatched: {unmatched}"
)

print(
    f"Population match rate: "
    f"{match_rate:.2f}%"
)


# -------------------------------------------------
# Keep actual alerts only
# -------------------------------------------------

actual = exposure[
    exposure["is_actual_alert"]
    == True
].copy()


# -------------------------------------------------
# Build one row per affected county
# -------------------------------------------------

county_exposure = (
    actual
    .groupby(
        [
            "county_fips",
            "county_full_name",
        ],
        as_index=False,
    )
    .agg(
        population=(
            "population",
            "first",
        ),

        active_alerts=(
            "alert_id",
            "nunique",
        ),
    )
)


# -------------------------------------------------
# Potentially exposed population
# -------------------------------------------------

total_population = (
    county_exposure[
        "population"
    ]
    .sum()
)


print(
    f"\nUnique affected counties: "
    f"{len(county_exposure)}"
)

print(
    "Potentially exposed population "
    f"(county-based estimate): "
    f"{total_population:,.0f}"
)


# -------------------------------------------------
# Largest affected county populations
# -------------------------------------------------

print(
    "\nLargest potentially exposed counties:"
)


print(
    county_exposure
    .sort_values(
        "population",
        ascending=False,
    )
    [
        [
            "county_full_name",
            "population",
            "active_alerts",
        ]
    ]
    .head(15)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# Save result
# -------------------------------------------------

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "county_exposure.csv"
)


county_exposure.to_csv(
    OUTPUT_FILE,
    index=False,
)


print(
    "\nExposure dataset saved to:"
)

print(
    OUTPUT_FILE
)


print("\n====================================")
print("POPULATION EXPOSURE COMPLETE")
print("====================================")