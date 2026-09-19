from pathlib import Path

import pandas as pd


# -------------------------------------------------
# 1. Input / output
# -------------------------------------------------

ALERT_COUNTIES_FILE = Path(
    "data/processed/geography/alert_counties.csv"
)


OUTPUT_FOLDER = Path(
    "data/processed/risk"
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "county_hazard_features.csv"
)


# -------------------------------------------------
# 2. Load active alert/county relationships
# -------------------------------------------------

alerts = pd.read_csv(
    ALERT_COUNTIES_FILE,
    dtype={
        "county_fips": "string",
    },
)


alerts["county_fips"] = (
    alerts["county_fips"]
    .str.zfill(5)
)


# Only genuine operational alerts
alerts = alerts[
    alerts["is_actual_alert"]
    == True
].copy()


print("\n====================================")
print("CRISISOPS - LIVE HAZARD ENGINE")
print("====================================")


print(
    f"\nAlert-county relationships: "
    f"{len(alerts)}"
)


# -------------------------------------------------
# 3. Map NWS categorical values to ordinal scores
# -------------------------------------------------

severity_map = {
    "Unknown": 0.00,
    "Minor": 0.25,
    "Moderate": 0.50,
    "Severe": 0.75,
    "Extreme": 1.00,
}


urgency_map = {
    "Unknown": 0.00,
    "Past": 0.00,
    "Future": 0.25,
    "Expected": 0.60,
    "Immediate": 1.00,
}


certainty_map = {
    "Unknown": 0.00,
    "Unlikely": 0.10,
    "Possible": 0.35,
    "Likely": 0.70,
    "Observed": 1.00,
}


alerts["severity_component"] = (
    alerts["severity"]
    .map(severity_map)
    .fillna(0)
)


alerts["urgency_component"] = (
    alerts["urgency"]
    .map(urgency_map)
    .fillna(0)
)


alerts["certainty_component"] = (
    alerts["certainty"]
    .map(certainty_map)
    .fillna(0)
)


# -------------------------------------------------
# 4. Score each alert
# -------------------------------------------------

# Severity matters most in the live alert itself.
# Urgency and certainty refine that signal.

alerts["alert_hazard_score"] = (
    (
        alerts["severity_component"] * 0.50
        +
        alerts["urgency_component"] * 0.30
        +
        alerts["certainty_component"] * 0.20
    )
    * 100
)


# -------------------------------------------------
# 5. Aggregate alerts to county level
# -------------------------------------------------

county_hazard = (
    alerts
    .groupby(
        [
            "county_fips",
            "state",
            "county_name",
        ],
        as_index=False,
    )
    .agg(
        active_alerts=(
            "alert_id",
            "nunique",
        ),

        max_hazard_score=(
            "alert_hazard_score",
            "max",
        ),

        avg_hazard_score=(
            "alert_hazard_score",
            "mean",
        ),

        severe_or_extreme_alerts=(
            "severity",
            lambda x: x.isin(
                ["Severe", "Extreme"]
            ).sum(),
        ),

        immediate_alerts=(
            "urgency",
            lambda x: (
                x == "Immediate"
            ).sum(),
        ),

        observed_alerts=(
            "certainty",
            lambda x: (
                x == "Observed"
            ).sum(),
        ),

        distinct_event_types=(
            "event",
            "nunique",
        ),
    )
)


# -------------------------------------------------
# 6. Add small multi-alert pressure component
# -------------------------------------------------

# More simultaneous alerts matter, but should
# not overpower severity itself.

county_hazard[
    "multi_alert_pressure"
] = (
    county_hazard[
        "active_alerts"
    ]
    .rank(
        pct=True,
        method="average",
    )
    * 100
)


# -------------------------------------------------
# 7. Final live hazard score
# -------------------------------------------------

county_hazard[
    "hazard_score"
] = (
    county_hazard[
        "max_hazard_score"
    ]
    * 0.85
    +
    county_hazard[
        "multi_alert_pressure"
    ]
    * 0.15
)


county_hazard[
    "hazard_score"
] = (
    county_hazard[
        "hazard_score"
    ]
    .clip(
        lower=0,
        upper=100,
    )
    .round(2)
)


# -------------------------------------------------
# 8. Quality / ranking output
# -------------------------------------------------

print(
    f"Counties scored: "
    f"{len(county_hazard)}"
)


print(
    "\nHighest live hazard counties:"
)


print(
    county_hazard
    .sort_values(
        "hazard_score",
        ascending=False,
    )
    [
        [
            "county_name",
            "state",
            "active_alerts",
            "max_hazard_score",
            "hazard_score",
            "severe_or_extreme_alerts",
        ]
    ]
    .head(20)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# 9. Save
# -------------------------------------------------

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


county_hazard.to_csv(
    OUTPUT_FILE,
    index=False,
)


print(
    "\nHazard features saved to:"
)

print(
    OUTPUT_FILE
)


print("\n====================================")
print("LIVE HAZARD ENGINE COMPLETE")
print("====================================")