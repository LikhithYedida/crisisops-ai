from pathlib import Path

import pandas as pd


# -------------------------------------------------
# 1. File locations
# -------------------------------------------------

ALERT_ZONES_FILE = Path(
    "data/processed/nws/alert_zones.csv"
)

CROSSWALK_FILE = Path(
    "data/reference/nws/forecast_zone_county_crosswalk.csv"
)


# -------------------------------------------------
# 2. Load data
# -------------------------------------------------

zones = pd.read_csv(
    ALERT_ZONES_FILE,
    dtype="string",
)


crosswalk = pd.read_csv(
    CROSSWALK_FILE,
    dtype="string",
)


print("\n====================================")
print("CRISISOPS - ZONE MATCH DIAGNOSTICS")
print("====================================")


# -------------------------------------------------
# 3. Only examine forecast zones
# -------------------------------------------------

forecast = zones[
    zones["zone_type"] == "forecast"
].copy()


print(
    f"\nForecast relationships: {len(forecast)}"
)


print(
    f"Unique forecast zone IDs: "
    f"{forecast['zone_id'].nunique()}"
)


# -------------------------------------------------
# 4. Convert zone ID to public-zone key
# -------------------------------------------------

# Example:
# TXZ123 -> TX123

forecast["state_zone"] = (
    forecast["zone_id"]
    .str.replace(
        r"^([A-Z]{2})Z(\d{3})$",
        r"\1\2",
        regex=True,
    )
)


# -------------------------------------------------
# 5. Build set of valid county-linked zones
# -------------------------------------------------

valid_public_zones = set(
    crosswalk[
        "state_zone"
    ].dropna()
)


# -------------------------------------------------
# 6. Determine match BEFORE doing the county join
# -------------------------------------------------

forecast["has_county_crosswalk"] = (
    forecast["state_zone"]
    .isin(valid_public_zones)
)


matched_relationships = (
    forecast[
        "has_county_crosswalk"
    ].sum()
)


unmatched_relationships = (
    ~forecast[
        "has_county_crosswalk"
    ]
).sum()


relationship_match_rate = (
    matched_relationships
    / len(forecast)
    * 100
)


print("\nRELATIONSHIP-LEVEL QUALITY")


print(
    f"Matched forecast relationships: "
    f"{matched_relationships}"
)


print(
    f"Unmatched forecast relationships: "
    f"{unmatched_relationships}"
)


print(
    f"Correct relationship match rate: "
    f"{relationship_match_rate:.2f}%"
)


# -------------------------------------------------
# 7. Unique-zone quality
# -------------------------------------------------

unique_zones = (
    forecast[
        [
            "zone_id",
            "state_zone",
            "has_county_crosswalk",
        ]
    ]
    .drop_duplicates()
)


matched_unique = (
    unique_zones[
        "has_county_crosswalk"
    ].sum()
)


unique_match_rate = (
    matched_unique
    / len(unique_zones)
    * 100
)


print("\nUNIQUE-ZONE QUALITY")


print(
    f"Unique forecast zones: "
    f"{len(unique_zones)}"
)


print(
    f"Unique zones mapped to counties: "
    f"{matched_unique}"
)


print(
    f"Unique-zone match rate: "
    f"{unique_match_rate:.2f}%"
)


# -------------------------------------------------
# 8. Investigate unmatched prefixes
# -------------------------------------------------

unmatched = unique_zones[
    ~unique_zones[
        "has_county_crosswalk"
    ]
].copy()


unmatched["zone_prefix"] = (
    unmatched["zone_id"]
    .str[:3]
)


print("\nTOP UNMATCHED ZONE PREFIXES")


print(
    unmatched[
        "zone_prefix"
    ]
    .value_counts()
    .head(30)
)


# -------------------------------------------------
# 9. Show unmatched examples
# -------------------------------------------------

print("\nSAMPLE UNMATCHED ZONES")


print(
    unmatched[
        [
            "zone_id",
            "state_zone",
        ]
    ]
    .head(40)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# 10. Save results
# -------------------------------------------------

OUTPUT_FOLDER = Path(
    "data/processed/geography/diagnostics"
)


OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


unmatched.to_csv(
    OUTPUT_FOLDER
    / "unmatched_zone_diagnostics.csv",
    index=False,
)


print(
    "\nDiagnostic file saved to:"
)


print(
    OUTPUT_FOLDER
    / "unmatched_zone_diagnostics.csv"
)


print("\n====================================")
print("DIAGNOSTICS COMPLETE")
print("====================================")