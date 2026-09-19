from pathlib import Path

import pandas as pd


# -------------------------------------------------
# 1. Locate the processed NWS dataset
# -------------------------------------------------

INPUT_FILE = Path(
    "data/processed/nws/active_alerts.csv"
)


if not INPUT_FILE.exists():
    raise FileNotFoundError(
        f"Processed NWS file not found: {INPUT_FILE}"
    )


# -------------------------------------------------
# 2. Load dataset
# -------------------------------------------------

df = pd.read_csv(INPUT_FILE)


print("\n====================================")
print("CRISISOPS - NWS DATA PROFILE")
print("====================================")


# -------------------------------------------------
# 3. Dataset size
# -------------------------------------------------

print("\n1. DATASET SIZE")

print(f"Rows: {len(df)}")
print(f"Columns: {len(df.columns)}")


# -------------------------------------------------
# 4. Duplicate check
# -------------------------------------------------

print("\n2. DUPLICATE CHECK")

duplicate_alerts = df["alert_id"].duplicated().sum()

print(
    f"Duplicate alert IDs: {duplicate_alerts}"
)


# -------------------------------------------------
# 5. Missing-value analysis
# -------------------------------------------------

print("\n3. MISSING VALUES")

missing_summary = pd.DataFrame({
    "missing_count": df.isna().sum(),
    "missing_pct": (
        df.isna().mean() * 100
    ).round(2),
})


missing_summary = (
    missing_summary
    .sort_values(
        "missing_pct",
        ascending=False,
    )
)


print(missing_summary)


# -------------------------------------------------
# 6. Severity distribution
# -------------------------------------------------

print("\n4. SEVERITY DISTRIBUTION")

print(
    df["severity"]
    .value_counts(
        dropna=False
    )
)


# -------------------------------------------------
# 7. Urgency distribution
# -------------------------------------------------

print("\n5. URGENCY DISTRIBUTION")

print(
    df["urgency"]
    .value_counts(
        dropna=False
    )
)


# -------------------------------------------------
# 8. Certainty distribution
# -------------------------------------------------

print("\n6. CERTAINTY DISTRIBUTION")

print(
    df["certainty"]
    .value_counts(
        dropna=False
    )
)


# -------------------------------------------------
# 9. Status distribution
# -------------------------------------------------

print("\n7. STATUS DISTRIBUTION")

print(
    df["status"]
    .value_counts(
        dropna=False
    )
)


# -------------------------------------------------
# 10. Most common alert types
# -------------------------------------------------

print("\n8. TOP ALERT TYPES")

print(
    df["event"]
    .value_counts(
        dropna=False
    )
    .head(20)
)


# -------------------------------------------------
# 11. Geometry availability
# -------------------------------------------------

print("\n9. GEOMETRY AVAILABILITY")

has_geometry = df["geometry"].notna()

geometry_count = has_geometry.sum()

geometry_pct = (
    has_geometry.mean() * 100
)

print(
    f"Alerts with geometry: "
    f"{geometry_count}"
)

print(
    f"Geometry coverage: "
    f"{geometry_pct:.2f}%"
)


print("\nGeometry types:")

print(
    df["geometry_type"]
    .value_counts(
        dropna=False
    )
)


# -------------------------------------------------
# 12. Basic marine-area heuristic
# -------------------------------------------------

print("\n10. POSSIBLE MARINE ALERTS")


marine_keywords = (
    "waters|coastal|offshore|"
    "marine|harbor|lake"
)


possible_marine = (
    df["area_description"]
    .fillna("")
    .str.contains(
        marine_keywords,
        case=False,
        regex=True,
    )
)


marine_count = possible_marine.sum()

marine_pct = (
    possible_marine.mean() * 100
)


print(
    f"Possible marine alerts: "
    f"{marine_count}"
)

print(
    f"Approximate marine share: "
    f"{marine_pct:.2f}%"
)


# -------------------------------------------------
# 13. Date-quality checks
# -------------------------------------------------

print("\n11. TIME FIELD QUALITY")


date_columns = [
    "effective",
    "onset",
    "expires",
    "ends",
]


for column in date_columns:

    converted = pd.to_datetime(
        df[column],
        errors="coerce",
        utc=True,
    )

    invalid_count = converted.isna().sum()

    print(
        f"{column}: "
        f"{invalid_count} missing/invalid"
    )


# -------------------------------------------------
# 14. Check critical fields
# -------------------------------------------------

print("\n12. CRITICAL FIELD COMPLETENESS")


critical_fields = [
    "alert_id",
    "event",
    "severity",
    "urgency",
    "certainty",
    "area_description",
    "effective",
    "expires",
]


for column in critical_fields:

    complete_pct = (
        df[column]
        .notna()
        .mean()
        * 100
    )

    print(
        f"{column}: "
        f"{complete_pct:.2f}% complete"
    )


# -------------------------------------------------
# 15. Save profiling summary
# -------------------------------------------------

OUTPUT_FOLDER = Path(
    "data/processed/nws/profile"
)


OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


missing_summary.to_csv(
    OUTPUT_FOLDER
    / "missing_value_summary.csv"
)


print(
    "\nProfiling summary saved to:"
)

print(
    OUTPUT_FOLDER
    / "missing_value_summary.csv"
)


print("\n====================================")
print("PROFILE COMPLETE")
print("====================================")