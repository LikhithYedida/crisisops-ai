from pathlib import Path

import pandas as pd
import requests


# -------------------------------------------------
# 1. OpenFEMA API configuration
# -------------------------------------------------

FEMA_URL = (
    "https://www.fema.gov/api/open/v2/"
    "DisasterDeclarationsSummaries"
)


OUTPUT_FOLDER = Path(
    "data/reference/fema"
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "county_disaster_declarations.csv"
)


EXCLUDED_FILE = (
    OUTPUT_FOLDER
    / "noncounty_disaster_declarations.csv"
)


# -------------------------------------------------
# 2. Pagination configuration
# -------------------------------------------------

PAGE_SIZE = 1000

skip = 0

all_records = []


print(
    "Requesting FEMA historical "
    "disaster declarations..."
)


# -------------------------------------------------
# 3. Download declarations page by page
# -------------------------------------------------

while True:

    params = {
        "$top": PAGE_SIZE,
        "$skip": skip,

        "$filter": (
            "declarationDate ge "
            "'2000-01-01T00:00:00.000Z'"
        ),
    }


    response = requests.get(
        FEMA_URL,
        params=params,
        timeout=60,
    )


    response.raise_for_status()


    payload = response.json()


    records = payload.get(
        "DisasterDeclarationsSummaries",
        [],
    )


    if not records:
        break


    all_records.extend(
        records
    )


    print(
        f"Downloaded {len(records)} records "
        f"starting at offset {skip}"
    )


    if len(records) < PAGE_SIZE:
        break


    skip += PAGE_SIZE


# -------------------------------------------------
# 4. Convert FEMA records to DataFrame
# -------------------------------------------------

df = pd.DataFrame(
    all_records
)


print(
    f"\nTotal FEMA rows received: "
    f"{len(df)}"
)


# -------------------------------------------------
# 5. Keep useful analytical columns
# -------------------------------------------------

keep_columns = [
    "disasterNumber",
    "femaDeclarationString",
    "state",
    "declarationType",
    "declarationDate",
    "incidentType",
    "incidentBeginDate",
    "incidentEndDate",
    "fipsStateCode",
    "fipsCountyCode",
    "designatedArea",
    "lastRefresh",
]


df = df[
    keep_columns
].copy()


# -------------------------------------------------
# 6. Rename columns
# -------------------------------------------------

df = df.rename(
    columns={
        "disasterNumber":
            "disaster_number",

        "femaDeclarationString":
            "fema_declaration",

        "declarationType":
            "declaration_type",

        "declarationDate":
            "declaration_date",

        "incidentType":
            "incident_type",

        "incidentBeginDate":
            "incident_begin_date",

        "incidentEndDate":
            "incident_end_date",

        "fipsStateCode":
            "state_fips",

        "fipsCountyCode":
            "county_code",

        "designatedArea":
            "designated_area",

        "lastRefresh":
            "last_refresh",
    }
)


# -------------------------------------------------
# 7. Protect geographic codes
# -------------------------------------------------

df["state_fips"] = (
    df["state_fips"]
    .astype("string")
    .str.zfill(2)
)


df["county_code"] = (
    df["county_code"]
    .astype("string")
    .str.zfill(3)
)


# -------------------------------------------------
# 8. Identify true county-level records
# -------------------------------------------------

valid_county = (
    df["state_fips"].notna()
    &
    df["county_code"].notna()
    &
    (df["county_code"] != "000")
)


county_df = df[
    valid_county
].copy()


excluded_df = df[
    ~valid_county
].copy()


# -------------------------------------------------
# 9. Create standard 5-digit county FIPS
# -------------------------------------------------

county_df["county_fips"] = (
    county_df["state_fips"]
    +
    county_df["county_code"]
)


# -------------------------------------------------
# 10. Convert date fields
# -------------------------------------------------

date_columns = [
    "declaration_date",
    "incident_begin_date",
    "incident_end_date",
    "last_refresh",
]


for column in date_columns:

    county_df[column] = pd.to_datetime(
        county_df[column],
        errors="coerce",
        utc=True,
    )


# -------------------------------------------------
# 11. Remove duplicate disaster-county rows
# -------------------------------------------------

before_dedup = len(
    county_df
)


county_df = (
    county_df
    .drop_duplicates(
        subset=[
            "disaster_number",
            "county_fips",
        ]
    )
)


duplicates_removed = (
    before_dedup
    - len(county_df)
)


# -------------------------------------------------
# 12. Quality checks
# -------------------------------------------------

print(
    f"County-level FEMA rows: "
    f"{len(county_df)}"
)


print(
    f"Excluded non-county rows: "
    f"{len(excluded_df)}"
)


print(
    f"Duplicate disaster-county rows removed: "
    f"{duplicates_removed}"
)


print(
    f"Unique counties represented: "
    f"{county_df['county_fips'].nunique()}"
)


print(
    "\nDeclaration types:"
)


print(
    county_df[
        "declaration_type"
    ]
    .value_counts()
)


print(
    "\nMost common incident types:"
)


print(
    county_df[
        "incident_type"
    ]
    .value_counts()
    .head(15)
)


print(
    "\nSample FEMA records:"
)


print(
    county_df[
        [
            "county_fips",
            "state",
            "designated_area",
            "disaster_number",
            "declaration_type",
            "incident_type",
            "declaration_date",
        ]
    ]
    .head(10)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# 13. Save files
# -------------------------------------------------

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


county_df.to_csv(
    OUTPUT_FILE,
    index=False,
)


excluded_df.to_csv(
    EXCLUDED_FILE,
    index=False,
)


print(
    "\nFEMA county history saved to:"
)


print(
    OUTPUT_FILE
)


print(
    "\nExcluded FEMA geography saved to:"
)


print(
    EXCLUDED_FILE
)


print("\n====================================")
print("FEMA INGESTION COMPLETE")
print("====================================")