from pathlib import Path
from io import StringIO

import pandas as pd
import requests


# -------------------------------------------------
# 1. Official NWS zone-county correlation file
# -------------------------------------------------

CROSSWALK_URL = (
    "https://www.weather.gov/source/gis/"
    "Shapefiles/County/bp16ap26.dbx"
)


OUTPUT_FOLDER = Path(
    "data/reference/nws"
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "forecast_zone_county_crosswalk.csv"
)


# -------------------------------------------------
# 2. Download the NWS reference file
# -------------------------------------------------

print(
    "Downloading NWS forecast-zone "
    "to county crosswalk..."
)


response = requests.get(
    CROSSWALK_URL,
    timeout=60,
)


response.raise_for_status()


print(
    "Download successful."
)


# -------------------------------------------------
# 3. Define column names
# -------------------------------------------------

columns = [
    "state",
    "zone",
    "cwa",
    "zone_name",
    "state_zone",
    "county_name",
    "county_fips",
    "time_zone",
    "feature_area",
    "latitude",
    "longitude",
]


# -------------------------------------------------
# 4. Read pipe-delimited data
# -------------------------------------------------

df = pd.read_csv(
    StringIO(response.text),
    sep="|",
    names=columns,
    dtype={
        "state": "string",
        "zone": "string",
        "state_zone": "string",
        "county_fips": "string",
    },
)


# -------------------------------------------------
# 5. Protect codes with leading zeroes
# -------------------------------------------------

df["zone"] = (
    df["zone"]
    .str.zfill(3)
)


df["county_fips"] = (
    df["county_fips"]
    .str.zfill(5)
)


# -------------------------------------------------
# 6. Basic data-quality checks
# -------------------------------------------------

print(
    f"\nRows received: {len(df)}"
)


print(
    f"Unique forecast zones: "
    f"{df['state_zone'].nunique()}"
)


print(
    f"Unique counties: "
    f"{df['county_fips'].nunique()}"
)


print(
    "\nMissing county FIPS:"
)


print(
    df["county_fips"]
    .isna()
    .sum()
)


print(
    "\nSample records:"
)


print(
    df[
        [
            "state_zone",
            "zone_name",
            "county_name",
            "county_fips",
        ]
    ]
    .head(10)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# 7. Save the clean reference table
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
    "\nCrosswalk saved to:"
)


print(
    OUTPUT_FILE
)