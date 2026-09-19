from pathlib import Path

import pandas as pd


# -------------------------------------------------
# 1. Inputs
# -------------------------------------------------

CONTEXT_FILE = Path(
    "data/processed/historical/"
    "county_crisis_context.csv"
)


HAZARD_FILE = Path(
    "data/processed/risk/"
    "county_hazard_features.csv"
)


OUTPUT_FOLDER = Path(
    "data/processed/risk"
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "county_crisis_priority.csv"
)


# -------------------------------------------------
# 2. Load datasets
# -------------------------------------------------

context = pd.read_csv(
    CONTEXT_FILE,
    dtype={
        "county_fips": "string",
    },
)


hazard = pd.read_csv(
    HAZARD_FILE,
    dtype={
        "county_fips": "string",
    },
)


context["county_fips"] = (
    context["county_fips"]
    .str.zfill(5)
)


hazard["county_fips"] = (
    hazard["county_fips"]
    .str.zfill(5)
)


# -------------------------------------------------
# 3. Join current hazard with county context
# -------------------------------------------------

df = context.merge(
    hazard[
        [
            "county_fips",
            "hazard_score",
            "max_hazard_score",
            "active_alerts",
            "severe_or_extreme_alerts",
            "distinct_event_types",
        ]
    ],
    on="county_fips",
    how="left",
    suffixes=(
        "_context",
        "_hazard",
    ),
)


# -------------------------------------------------
# 4. Exposure score
# -------------------------------------------------

# Population distributions are very skewed,
# so percentile rank is more robust than
# raw min-max scaling.

df["exposure_score"] = (
    df["population"]
    .rank(
        pct=True,
        method="average",
    )
    * 100
)


# -------------------------------------------------
# 5. Vulnerability score
# -------------------------------------------------

# CDC SVI is already a 0-1 percentile score.

df["vulnerability_score"] = (
    df["svi_overall"]
    * 100
)


# Do NOT invent missing SVI values.
# Use the dataset median only for the baseline score,
# while keeping the original SVI column null.

svi_median = (
    df["vulnerability_score"]
    .median()
)


df[
    "vulnerability_score_model"
] = (
    df["vulnerability_score"]
    .fillna(
        svi_median
    )
)


df["svi_imputed"] = (
    df["vulnerability_score"]
    .isna()
)


# -------------------------------------------------
# 6. Historical burden score
# -------------------------------------------------

# Recent history gets primary emphasis.
# Number of different incident types adds diversity.

df[
    "declaration_rank"
] = (
    df[
        "fema_declarations_10y"
    ]
    .rank(
        pct=True,
        method="average",
    )
    * 100
)


df[
    "incident_diversity_rank"
] = (
    df[
        "incident_types_10y"
    ]
    .rank(
        pct=True,
        method="average",
    )
    * 100
)


df[
    "history_score"
] = (
    df[
        "declaration_rank"
    ]
    * 0.75
    +
    df[
        "incident_diversity_rank"
    ]
    * 0.25
)


# -------------------------------------------------
# 7. Handle any missing hazard values
# -------------------------------------------------

df["hazard_score"] = (
    df["hazard_score"]
    .fillna(0)
)


# -------------------------------------------------
# 8. Baseline Crisis Priority Score
# -------------------------------------------------

# VERSION 1 BASELINE:
#
# Equal weights deliberately avoid pretending
# that we already know one dimension is more
# important than another.
#
# Later we will validate/calibrate these weights.

df["crisis_priority_score"] = (
    (
        df["hazard_score"]
        +
        df["exposure_score"]
        +
        df[
            "vulnerability_score_model"
        ]
        +
        df["history_score"]
    )
    / 4
)


df[
    "crisis_priority_score"
] = (
    df[
        "crisis_priority_score"
    ]
    .round(2)
)


# -------------------------------------------------
# 9. Priority band
# -------------------------------------------------

def priority_band(score):

    if score >= 80:
        return "CRITICAL"

    elif score >= 65:
        return "HIGH"

    elif score >= 50:
        return "ELEVATED"

    elif score >= 35:
        return "MODERATE"

    return "LOW"


df["priority_level"] = (
    df[
        "crisis_priority_score"
    ]
    .apply(
        priority_band
    )
)


# -------------------------------------------------
# 10. Ranking
# -------------------------------------------------

df["national_priority_rank"] = (
    df[
        "crisis_priority_score"
    ]
    .rank(
        ascending=False,
        method="min",
    )
    .astype(int)
)


# -------------------------------------------------
# 11. Identify dominant risk driver
# -------------------------------------------------

component_columns = {
    "Current Hazard":
        "hazard_score",

    "Population Exposure":
        "exposure_score",

    "Social Vulnerability":
        "vulnerability_score_model",

    "Historical Disaster Burden":
        "history_score",
}


def dominant_driver(row):

    scores = {
        label: row[column]
        for label, column
        in component_columns.items()
    }

    return max(
        scores,
        key=scores.get,
    )


df["dominant_risk_driver"] = (
    df.apply(
        dominant_driver,
        axis=1,
    )
)


# -------------------------------------------------
# 12. Print results
# -------------------------------------------------

print("\n====================================")
print("CRISISOPS - CRISIS PRIORITY ENGINE")
print("====================================")


print(
    f"\nCounties ranked: {len(df)}"
)


print(
    "\nPriority distribution:"
)


print(
    df["priority_level"]
    .value_counts()
)


print(
    "\nTOP 20 CRISIS PRIORITIES:"
)


display_columns = [
    "national_priority_rank",
    "county_full_name",
    "crisis_priority_score",
    "priority_level",
    "hazard_score",
    "exposure_score",
    "vulnerability_score",
    "history_score",
    "dominant_risk_driver",
]


print(
    df
    .sort_values(
        "national_priority_rank"
    )
    [
        display_columns
    ]
    .head(20)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# 13. Save
# -------------------------------------------------

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


df.to_csv(
    OUTPUT_FILE,
    index=False,
)


print(
    "\nCrisis priority dataset saved to:"
)


print(
    OUTPUT_FILE
)


print("\n====================================")
print("CRISIS PRIORITY ENGINE COMPLETE")
print("====================================")