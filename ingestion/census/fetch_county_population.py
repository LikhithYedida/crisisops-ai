from pathlib import Path

import pandas as pd
import requests
import os
from pathlib import Path
from dotenv import load_dotenv
# -------------------------------------------------
# Load secret environment variables
# -------------------------------------------------

load_dotenv()

CENSUS_API_KEY = os.getenv(
    "CENSUS_API_KEY"
)

if not CENSUS_API_KEY:
    raise ValueError(
        "CENSUS_API_KEY was not found. "
        "Add it to your .env file."
    )

# -------------------------------------------------
# 1. Census API configuration
# -------------------------------------------------

CENSUS_URL = (
    "https://api.census.gov/data/"
    "2024/acs/acs5"
)


PARAMS = {
    "get": "NAME,B01003_001E",
    "for": "county:*",
    "in": "state:*",
    "key": CENSUS_API_KEY,
}


OUTPUT_FOLDER = Path(
    "data/reference/census"
)


OUTPUT_FILE = (
    OUTPUT_FOLDER
    / "county_population.csv"
)


# -------------------------------------------------
# 2. Call Census API
# -------------------------------------------------

print(
    "Requesting U.S. county population "
    "data from Census ACS..."
)


response = requests.get(
    CENSUS_URL,
    params=PARAMS,
    timeout=60,
)


response.raise_for_status()


# -------------------------------------------------
# Validate Census response before parsing JSON
# -------------------------------------------------

content_type = response.headers.get(
    "Content-Type",
    ""
)


if "application/json" not in content_type:

    print(
        "\nCensus returned a non-JSON response."
    )

    print(
        f"Status code: {response.status_code}"
    )

    print(
        f"Content-Type: {content_type}"
    )

    print(
        "\nResponse preview:"
    )

    print(
        response.text[:500]
    )

    raise RuntimeError(
        "Census API did not return JSON."
    )


data = response.json()


# -------------------------------------------------
# 3. Convert response to DataFrame
# -------------------------------------------------

columns = data[0]

rows = data[1:]


df = pd.DataFrame(
    rows,
    columns=columns,
)


print(
    f"\nRows received: {len(df)}"
)


# -------------------------------------------------
# 4. Rename Census variables
# -------------------------------------------------

df = df.rename(
    columns={
        "NAME": "county_full_name",
        "B01003_001E": "population",
    }
)


# -------------------------------------------------
# 5. Create standard 5-digit county FIPS
# -------------------------------------------------

df["state"] = (
    df["state"]
    .astype("string")
    .str.zfill(2)
)


df["county"] = (
    df["county"]
    .astype("string")
    .str.zfill(3)
)


df["county_fips"] = (
    df["state"]
    + df["county"]
)


# -------------------------------------------------
# 6. Convert population to numeric
# -------------------------------------------------

df["population"] = pd.to_numeric(
    df["population"],
    errors="coerce",
)


# -------------------------------------------------
# 7. Quality checks
# -------------------------------------------------

print(
    f"Unique county FIPS: "
    f"{df['county_fips'].nunique()}"
)


print(
    f"Missing population values: "
    f"{df['population'].isna().sum()}"
)


print(
    f"Duplicate county FIPS: "
    f"{df['county_fips'].duplicated().sum()}"
)


print(
    "\nSample counties:"
)


print(
    df[
        [
            "county_fips",
            "county_full_name",
            "population",
        ]
    ]
    .head(10)
    .to_string(
        index=False
    )
)


# -------------------------------------------------
# 8. Save Census reference data
# -------------------------------------------------

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


df[
    [
        "county_fips",
        "county_full_name",
        "population",
    ]
].to_csv(
    OUTPUT_FILE,
    index=False,
)


print(
    "\nCensus population file saved to:"
)


print(
    OUTPUT_FILE
)