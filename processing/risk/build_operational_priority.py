from pathlib import Path

import pandas as pd


# ============================================================
# 1. FILE LOCATIONS
# ============================================================

BASELINE_FILE = Path(
    "data/processed/risk/county_crisis_priority.csv"
)

OUTPUT_FOLDER = Path(
    "data/processed/risk"
)

OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "county_operational_priority.csv"
)

SUMMARY_FILE = (
    OUTPUT_FOLDER
    / "operational_priority_summary.csv"
)


# ============================================================
# 2. CHECK INPUT FILE
# ============================================================

if not BASELINE_FILE.exists():
    raise FileNotFoundError(
        f"Input file not found: {BASELINE_FILE}"
    )


# ============================================================
# 3. LOAD BASELINE V1 MODEL
# ============================================================

df = pd.read_csv(
    BASELINE_FILE,
    dtype={
        "county_fips": "string",
    },
)


df["county_fips"] = (
    df["county_fips"]
    .str.zfill(5)
)


print("\n========================================")
print("CRISISOPS - OPERATIONAL PRIORITY V2")
print("========================================")

print(
    f"\nCounties loaded: {len(df)}"
)


# ============================================================
# 4. VALIDATE REQUIRED COLUMNS
# ============================================================

required_columns = [
    "county_fips",
    "county_full_name",
    "hazard_score",
    "exposure_score",
    "vulnerability_score",
    "vulnerability_score_model",
    "history_score",
    "severe_or_extreme_alerts",
    "priority_level",
    "national_priority_rank",
]


missing_columns = [
    column
    for column in required_columns
    if column not in df.columns
]


if missing_columns:
    raise ValueError(
        "Missing required columns:\n"
        + ", ".join(missing_columns)
    )


# ============================================================
# 5. MAKE MODEL COLUMNS NUMERIC
# ============================================================

numeric_columns = [
    "hazard_score",
    "exposure_score",
    "vulnerability_score",
    "vulnerability_score_model",
    "history_score",
    "severe_or_extreme_alerts",
    "national_priority_rank",
]


for column in numeric_columns:
    df[column] = pd.to_numeric(
        df[column],
        errors="coerce",
    )


# ============================================================
# 6. CHECK CRITICAL INPUT VALUES
# ============================================================

critical_model_columns = [
    "hazard_score",
    "exposure_score",
    "vulnerability_score_model",
    "history_score",
    "severe_or_extreme_alerts",
]


missing_model_values = (
    df[critical_model_columns]
    .isna()
    .sum()
)


print(
    "\nMissing model values:"
)

print(
    missing_model_values
)


# If these fields are unexpectedly missing,
# stop rather than silently creating bad scores.

if (
    df[
        [
            "hazard_score",
            "exposure_score",
            "vulnerability_score_model",
            "history_score",
        ]
    ]
    .isna()
    .any()
    .any()
):
    raise ValueError(
        "One or more required scoring fields "
        "contain missing values."
    )


# Missing severe alert count can safely mean zero.
df["severe_or_extreme_alerts"] = (
    df["severe_or_extreme_alerts"]
    .fillna(0)
)


# ============================================================
# 7. BUILD COMMUNITY CONTEXT SCORE
# ============================================================

# Context describes how consequential an emergency
# may be for the affected community.
#
# Population Exposure        33.33%
# Social Vulnerability       33.33%
# Historical Disaster Load  33.33%
#
# Current hazard is intentionally excluded here.

df["context_score"] = (
    (
        df["exposure_score"]
        +
        df["vulnerability_score_model"]
        +
        df["history_score"]
    )
    / 3
)


df["context_score"] = (
    df["context_score"]
    .clip(
        lower=0,
        upper=100,
    )
    .round(2)
)


# ============================================================
# 8. CALCULATE WEIGHTED CONTRIBUTIONS
# ============================================================

# Operational V2 model
#
# Current Hazard          55%
# Population Exposure     15%
# Social Vulnerability    15%
# Historical Burden       15%

df["hazard_contribution"] = (
    df["hazard_score"]
    * 0.55
)

df["exposure_contribution"] = (
    df["exposure_score"]
    * 0.15
)

df["vulnerability_contribution"] = (
    df["vulnerability_score_model"]
    * 0.15
)

df["history_contribution"] = (
    df["history_score"]
    * 0.15
)


contribution_columns = [
    "hazard_contribution",
    "exposure_contribution",
    "vulnerability_contribution",
    "history_contribution",
]


df[contribution_columns] = (
    df[contribution_columns]
    .round(4)
)


# ============================================================
# 9. BUILD OPERATIONAL PRIORITY SCORE
# ============================================================

df["operational_priority_score"] = (
    df["hazard_contribution"]
    +
    df["exposure_contribution"]
    +
    df["vulnerability_contribution"]
    +
    df["history_contribution"]
)


df["operational_priority_score"] = (
    df["operational_priority_score"]
    .clip(
        lower=0,
        upper=100,
    )
    .round(2)
)


# ============================================================
# 10. PRIORITY LEVEL + CRITICAL GUARDRAIL
# ============================================================

def get_operational_priority(row):

    score = row[
        "operational_priority_score"
    ]

    severe_alerts = row[
        "severe_or_extreme_alerts"
    ]


    # CRITICAL requires:
    #
    # 1. Score >= 80
    # 2. At least one live Severe/Extreme alert

    if (
        score >= 80
        and severe_alerts > 0
    ):
        return "CRITICAL"

    if score >= 70:
        return "HIGH"

    if score >= 55:
        return "ELEVATED"

    if score >= 40:
        return "MODERATE"

    return "LOW"


df[
    "operational_priority_level"
] = (
    df.apply(
        get_operational_priority,
        axis=1,
    )
)


# ============================================================
# 11. OPERATIONAL NATIONAL RANK
# ============================================================

df["operational_rank"] = (
    df[
        "operational_priority_score"
    ]
    .rank(
        ascending=False,
        method="min",
    )
    .astype(int)
)


# ============================================================
# 12. DOMINANT WEIGHTED DRIVER
# ============================================================

driver_columns = {
    "Current Hazard":
        "hazard_contribution",

    "Population Exposure":
        "exposure_contribution",

    "Social Vulnerability":
        "vulnerability_contribution",

    "Historical Disaster Burden":
        "history_contribution",
}


def get_dominant_driver(row):

    contributions = {
        name: row[column]
        for name, column
        in driver_columns.items()
    }

    return max(
        contributions,
        key=contributions.get,
    )


df[
    "dominant_operational_driver"
] = (
    df.apply(
        get_dominant_driver,
        axis=1,
    )
)


# ============================================================
# 13. COMPARE V2 AGAINST V1
# ============================================================

df[
    "priority_changed_from_v1"
] = (
    df["priority_level"]
    !=
    df["operational_priority_level"]
)


changed_count = (
    df[
        "priority_changed_from_v1"
    ]
    .sum()
)


# ============================================================
# 14. CALCULATE RANK MOVEMENT
# ============================================================

df["rank_change"] = (
    df["national_priority_rank"]
    -
    df["operational_rank"]
)


# Positive:
# moved upward in V2
#
# Negative:
# moved downward in V2


# ============================================================
# 15. VALIDATE CRITICAL GUARDRAIL
# ============================================================

critical_df = df[
    df[
        "operational_priority_level"
    ]
    == "CRITICAL"
]


critical_without_severe = (
    (
        critical_df[
            "severe_or_extreme_alerts"
        ]
        == 0
    )
    .sum()
)


# ============================================================
# 16. VALIDATE SCORE CONTRIBUTIONS
# ============================================================

df["contribution_total"] = (
    df[
        "hazard_contribution"
    ]
    +
    df[
        "exposure_contribution"
    ]
    +
    df[
        "vulnerability_contribution"
    ]
    +
    df[
        "history_contribution"
    ]
)


df["contribution_total"] = (
    df[
        "contribution_total"
    ]
    .round(2)
)


df["score_difference"] = (
    (
        df[
            "operational_priority_score"
        ]
        -
        df[
            "contribution_total"
        ]
    )
    .abs()
    .round(4)
)


maximum_score_difference = (
    df[
        "score_difference"
    ]
    .max()
)


# ============================================================
# 17. PRINT PRIORITY DISTRIBUTION
# ============================================================

print(
    "\nV2 PRIORITY DISTRIBUTION:"
)


priority_order = [
    "CRITICAL",
    "HIGH",
    "ELEVATED",
    "MODERATE",
    "LOW",
]


priority_counts = (
    df[
        "operational_priority_level"
    ]
    .value_counts()
    .reindex(
        priority_order,
        fill_value=0,
    )
)


print(
    priority_counts
)


print(
    f"\nCounties whose priority changed "
    f"from V1: {changed_count}"
)


print(
    "CRITICAL counties without "
    f"Severe/Extreme alert: "
    f"{critical_without_severe}"
)


print(
    "Maximum score/contribution difference: "
    f"{maximum_score_difference}"
)


# ============================================================
# 18. TOP 20 OPERATIONAL PRIORITIES
# ============================================================

print(
    "\n========================================"
)

print(
    "TOP 20 OPERATIONAL PRIORITIES"
)

print(
    "========================================"
)


display_columns = [
    "operational_rank",
    "county_full_name",
    "operational_priority_score",
    "operational_priority_level",

    "hazard_score",
    "context_score",

    "hazard_contribution",
    "exposure_contribution",
    "vulnerability_contribution",
    "history_contribution",

    "severe_or_extreme_alerts",

    "dominant_operational_driver",
]


top_20 = (
    df
    .sort_values(
        [
            "operational_rank",
            "county_full_name",
        ]
    )
    [
        display_columns
    ]
    .head(20)
)


print(
    top_20.to_string(
        index=False
    )
)


# ============================================================
# 19. BIGGEST UPWARD MOVERS
# ============================================================

print(
    "\n========================================"
)

print(
    "BIGGEST UPWARD MOVERS FROM V1"
)

print(
    "========================================"
)


upward_columns = [
    "county_full_name",
    "national_priority_rank",
    "operational_rank",
    "hazard_score",
    "context_score",
    "rank_change",
]


print(
    df
    .sort_values(
        "rank_change",
        ascending=False,
    )
    [
        upward_columns
    ]
    .head(10)
    .to_string(
        index=False
    )
)


# ============================================================
# 20. BIGGEST DOWNWARD MOVERS
# ============================================================

print(
    "\n========================================"
)

print(
    "BIGGEST DOWNWARD MOVERS FROM V1"
)

print(
    "========================================"
)


print(
    df
    .sort_values(
        "rank_change",
        ascending=True,
    )
    [
        upward_columns
    ]
    .head(10)
    .to_string(
        index=False
    )
)


# ============================================================
# 21. PRIORITY SUMMARY TABLE
# ============================================================

priority_summary = (
    df
    .groupby(
        "operational_priority_level",
        as_index=False,
    )
    .agg(
        county_count=(
            "county_fips",
            "nunique",
        ),

        average_priority_score=(
            "operational_priority_score",
            "mean",
        ),

        average_hazard_score=(
            "hazard_score",
            "mean",
        ),

        average_context_score=(
            "context_score",
            "mean",
        ),

        average_exposure_score=(
            "exposure_score",
            "mean",
        ),

        average_vulnerability_score=(
            "vulnerability_score_model",
            "mean",
        ),

        average_history_score=(
            "history_score",
            "mean",
        ),
    )
)


summary_numeric_columns = [
    "average_priority_score",
    "average_hazard_score",
    "average_context_score",
    "average_exposure_score",
    "average_vulnerability_score",
    "average_history_score",
]


priority_summary[
    summary_numeric_columns
] = (
    priority_summary[
        summary_numeric_columns
    ]
    .round(2)
)


# Create custom sorting order
priority_order_map = {
    "CRITICAL": 1,
    "HIGH": 2,
    "ELEVATED": 3,
    "MODERATE": 4,
    "LOW": 5,
}


priority_summary[
    "priority_sort"
] = (
    priority_summary[
        "operational_priority_level"
    ]
    .map(
        priority_order_map
    )
)


priority_summary = (
    priority_summary
    .sort_values(
        "priority_sort"
    )
    .drop(
        columns=[
            "priority_sort"
        ]
    )
)


print(
    "\n========================================"
)

print(
    "PRIORITY-LEVEL SUMMARY"
)

print(
    "========================================"
)


print(
    priority_summary.to_string(
        index=False
    )
)


# ============================================================
# 22. CREATE OUTPUT DIRECTORY
# ============================================================

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


# ============================================================
# 23. SAVE FULL OPERATIONAL MODEL
# ============================================================

df.to_csv(
    OUTPUT_FILE,
    index=False,
)


# ============================================================
# 24. SAVE PRIORITY SUMMARY
# ============================================================

priority_summary.to_csv(
    SUMMARY_FILE,
    index=False,
)


# ============================================================
# 25. FINAL VALIDATION
# ============================================================

print(
    "\n========================================"
)

print(
    "OUTPUT VALIDATION"
)

print(
    "========================================"
)


print(
    f"Operational dataset rows: "
    f"{len(df)}"
)


print(
    f"Summary rows: "
    f"{len(priority_summary)}"
)


print(
    f"Operational file exists: "
    f"{OUTPUT_FILE.exists()}"
)


print(
    f"Summary file exists: "
    f"{SUMMARY_FILE.exists()}"
)


print(
    "\nOperational priority dataset saved to:"
)

print(
    OUTPUT_FILE
)


print(
    "\nPriority summary saved to:"
)

print(
    SUMMARY_FILE
)


print(
    "\n========================================"
)

print(
    "OPERATIONAL PRIORITY V2 COMPLETE"
)

print(
    "========================================"
)