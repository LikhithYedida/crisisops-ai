from pathlib import Path

import pandas as pd
import requests


# -------------------------------------------------
# 1. CDC SVI county API
# -------------------------------------------------

SVI_URL = (
    "https://onemap.cdc.gov/onemapservices/rest/services/"
    "SVI/CDC_ATSDR_Social_Vulnerability_Index_2022_USA/"
    "FeatureServer/1/query"
)


OUTPUT_FOLDER = Path(
    "data/reference/cdc"
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "county_svi_2022.csv"
)


# -------------------------------------------------
# 2. Fields we want from CDC
# -------------------------------------------------

FIELDS = [
    "STCNTY",
    "STATE",
    "ST_ABBR",
    "COUNTY",

    "RPL_THEMES",
    "RPL_THEME1",
    "RPL_THEME2",
    "RPL_THEME3",
    "RPL_THEME4",

    "EP_POV150",
    "EP_AGE65",
    "EP_DISABL",
    "EP_NOVEH",
    "EP_LIMENG",
]


# -------------------------------------------------
# 3. Pagination settings
# -------------------------------------------------

PAGE_SIZE = 2000

offset = 0

all_rows = []


print(
    "Requesting county-level CDC Social "
    "Vulnerability Index data..."
)


# -------------------------------------------------
# 4. Request pages until no data remain
# -------------------------------------------------

while True:

    params = {
        "where": "1=1",
        "outFields": ",".join(FIELDS),
        "returnGeometry": "false",
        "f": "json",
        "resultOffset": offset,
        "resultRecordCount": PAGE_SIZE,
    }


    response = requests.get(
        SVI_URL,
        params=params,
        timeout=60,
    )


    response.raise_for_status()


    payload = response.json()


    features = payload.get(
        "features",
        []
    )


    if not features:
        break


    rows = [
        feature["attributes"]
        for feature in features
    ]


    all_rows.extend(
        rows
    )


    print(
        f"Downloaded {len(rows)} records "
        f"starting at offset {offset}"
    )


    # If fewer than PAGE_SIZE records came back,
    # we reached the final page.
    if len(rows) < PAGE_SIZE:
        break


    offset += PAGE_SIZE


# -------------------------------------------------
# 5. Convert to DataFrame
# -------------------------------------------------

df = pd.DataFrame(
    all_rows
)


print(
    f"\nRows received: {len(df)}"
)


# -------------------------------------------------
# 6. Rename fields to readable names
# -------------------------------------------------

df = df.rename(
    columns={
        "STCNTY": "county_fips",
        "STATE": "state_name",
        "ST_ABBR": "state_abbr",
        "COUNTY": "county_name",

        "RPL_THEMES": "svi_overall",
        "RPL_THEME1": "svi_socioeconomic",
        "RPL_THEME2": "svi_household",
        "RPL_THEME3": "svi_minority_status",
        "RPL_THEME4": "svi_housing_transport",

        "EP_POV150": "pct_below_150_poverty",
        "EP_AGE65": "pct_age_65_plus",
        "EP_DISABL": "pct_disability",
        "EP_NOVEH": "pct_no_vehicle",
        "EP_LIMENG": "pct_limited_english",
    }
)


# -------------------------------------------------
# 7. Standardize county FIPS
# -------------------------------------------------

df["county_fips"] = (
    df["county_fips"]
    .astype("string")
    .str.zfill(5)
)


# -------------------------------------------------
# 8. Replace CDC missing-value sentinel values
# -------------------------------------------------

numeric_columns = [
    "svi_overall",
    "svi_socioeconomic",
    "svi_household",
    "svi_minority_status",
    "svi_housing_transport",
    "pct_below_150_poverty",
    "pct_age_65_plus",
    "pct_disability",
    "pct_no_vehicle",
    "pct_limited_english",
]


for column in numeric_columns:

    df[column] = pd.to_numeric(
        df[column],
        errors="coerce",
    )


    # CDC datasets can use negative numbers
    # such as -999 as missing-data sentinels.
    df.loc[
        df[column] < 0,
        column
    ] = pd.NA


# -------------------------------------------------
# 9. Quality checks
# -------------------------------------------------

print(
    f"Unique county FIPS: "
    f"{df['county_fips'].nunique()}"
)


print(
    f"Duplicate county FIPS: "
    f"{df['county_fips'].duplicated().sum()}"
)


print(
    f"Missing overall SVI: "
    f"{df['svi_overall'].isna().sum()}"
)


print(
    "\nSVI overall summary:"
)


print(
    df["svi_overall"]
    .describe()
)


print(
    "\nSample counties:"
)


print(
    df[
        [
            "county_fips",
            "county_name",
            "state_abbr",
            "svi_overall",
            "pct_age_65_plus",
            "pct_disability",
            "pct_no_vehicle",
        ]
    ]
    .head(10)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# 10. Save dataset
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
    "\nCDC SVI file saved to:"
)


print(
    OUTPUT_FILE
)