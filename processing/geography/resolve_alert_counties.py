from pathlib import Path

import pandas as pd


# -------------------------------------------------
# 1. File locations
# -------------------------------------------------

ALERTS_FILE = Path(
    "data/processed/nws/active_alerts.csv"
)

ALERT_ZONES_FILE = Path(
    "data/processed/nws/alert_zones.csv"
)

CROSSWALK_FILE = Path(
    "data/reference/nws/forecast_zone_county_crosswalk.csv"
)

OUTPUT_FOLDER = Path(
    "data/processed/geography"
)


# -------------------------------------------------
# 2. Check that required files exist
# -------------------------------------------------

required_files = [
    ALERTS_FILE,
    ALERT_ZONES_FILE,
    CROSSWALK_FILE,
]


for file in required_files:

    if not file.exists():

        raise FileNotFoundError(
            f"Required file not found: {file}"
        )


# -------------------------------------------------
# 3. Load datasets
# -------------------------------------------------

alerts = pd.read_csv(
    ALERTS_FILE,
    dtype={
        "alert_id": "string",
    },
)


alert_zones = pd.read_csv(
    ALERT_ZONES_FILE,
    dtype={
        "alert_id": "string",
        "zone_id": "string",
        "zone_type": "string",
    },
)


crosswalk = pd.read_csv(
    CROSSWALK_FILE,
    dtype={
        "state_zone": "string",
        "county_fips": "string",
    },
)


print("\n====================================")
print("CRISISOPS - COUNTY RESOLUTION")
print("====================================")


print(
    f"\nAlert-zone relationships loaded: "
    f"{len(alert_zones)}"
)


# -------------------------------------------------
# 4. Keep forecast zones for this mapping
# -------------------------------------------------

forecast_zones = alert_zones[
    alert_zones["zone_type"]
    == "forecast"
].copy()


print(
    f"Forecast-zone relationships: "
    f"{len(forecast_zones)}"
)


# -------------------------------------------------
# 5. Convert NWS zone ID to crosswalk key
# -------------------------------------------------

# Example:
#
# NMZ201
#   ↓
# NM201
#
# The Z identifies it as a forecast zone.
# The official crosswalk uses NM201.

forecast_zones["state_zone"] = (
    forecast_zones["zone_id"]
    .str.replace(
        r"^([A-Z]{2})Z(\d{3})$",
        r"\1\2",
        regex=True,
    )
)


# -------------------------------------------------
# 6. Join forecast zones to counties
# -------------------------------------------------

resolved = forecast_zones.merge(
    crosswalk[
        [
            "state_zone",
            "state",
            "zone_name",
            "county_name",
            "county_fips",
            "latitude",
            "longitude",
        ]
    ],
    on="state_zone",
    how="left",
)


# -------------------------------------------------
# 7. Measure mapping quality
# -------------------------------------------------

matched = (
    resolved["county_fips"]
    .notna()
    .sum()
)


unmatched = (
    resolved["county_fips"]
    .isna()
    .sum()
)


match_rate = (
    matched
    / len(resolved)
    * 100
    if len(resolved) > 0
    else 0
)


print(
    f"\nResolved relationships: {matched}"
)

print(
    f"Unmatched relationships: {unmatched}"
)

print(
    f"Forecast-zone match rate: "
    f"{match_rate:.2f}%"
)


# -------------------------------------------------
# 8. Save unmatched zones for investigation
# -------------------------------------------------

unmatched_zones = (
    resolved[
        resolved["county_fips"]
        .isna()
    ][
        [
            "zone_id",
            "state_zone",
        ]
    ]
    .drop_duplicates()
)


# -------------------------------------------------
# 9. Keep successfully resolved counties
# -------------------------------------------------

resolved_counties = resolved[
    resolved["county_fips"]
    .notna()
].copy()


# -------------------------------------------------
# 10. Remove duplicate alert-county combinations
# -------------------------------------------------

before_dedup = len(
    resolved_counties
)


resolved_counties = (
    resolved_counties
    .drop_duplicates(
        subset=[
            "alert_id",
            "county_fips",
        ]
    )
)


duplicates_removed = (
    before_dedup
    - len(resolved_counties)
)


# -------------------------------------------------
# 11. Add alert details
# -------------------------------------------------

alert_columns = [
    "alert_id",
    "event",
    "severity",
    "urgency",
    "certainty",
    "area_description",
    "headline",
    "effective",
    "expires",
    "is_actual_alert",
]


alert_counties = (
    resolved_counties
    .merge(
        alerts[alert_columns],
        on="alert_id",
        how="left",
    )
)


# -------------------------------------------------
# 12. Protect FIPS formatting
# -------------------------------------------------

alert_counties[
    "county_fips"
] = (
    alert_counties[
        "county_fips"
    ]
    .astype("string")
    .str.zfill(5)
)


# -------------------------------------------------
# 13. Save outputs
# -------------------------------------------------

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "alert_counties.csv"
)


UNMATCHED_FILE = (
    OUTPUT_FOLDER
    / "unmatched_forecast_zones.csv"
)


alert_counties.to_csv(
    OUTPUT_FILE,
    index=False,
)


unmatched_zones.to_csv(
    UNMATCHED_FILE,
    index=False,
)


# -------------------------------------------------
# 14. Summary
# -------------------------------------------------

print(
    f"\nUnique alert-county relationships: "
    f"{len(alert_counties)}"
)


print(
    f"Duplicate alert-county rows removed: "
    f"{duplicates_removed}"
)


print(
    f"Unique counties currently affected: "
    f"{alert_counties['county_fips'].nunique()}"
)


print(
    "\nMost affected states:"
)


print(
    alert_counties[
        "state"
    ]
    .value_counts()
    .head(10)
)


print(
    "\nMost common county alert types:"
)


print(
    alert_counties[
        "event"
    ]
    .value_counts()
    .head(10)
)


print(
    "\nSample resolved counties:"
)


print(
    alert_counties[
        [
            "event",
            "state",
            "county_name",
            "county_fips",
            "severity",
        ]
    ]
    .head(15)
    .to_string(
        index=False
    )
)


print(
    "\nFiles saved:"
)


print(
    OUTPUT_FILE
)


print(
    UNMATCHED_FILE
)


print("\n====================================")
print("COUNTY RESOLUTION COMPLETE")
print("====================================")