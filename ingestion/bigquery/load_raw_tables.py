from pathlib import Path

import pandas as pd
from google.cloud import bigquery


# ============================================================
# 1. GOOGLE CLOUD CONFIGURATION
# ============================================================

PROJECT_ID = "crisisops-intelligence"
DATASET_ID = "crisisops_raw"


# ============================================================
# 2. RAW DATASETS TO LOAD
# ============================================================

TABLES = {
    "active_alerts": Path(
        "data/processed/nws/active_alerts.csv"
    ),

    "alert_zones": Path(
        "data/processed/nws/alert_zones.csv"
    ),

    "forecast_zone_county_crosswalk": Path(
        "data/reference/nws/"
        "forecast_zone_county_crosswalk.csv"
    ),

    "county_population": Path(
        "data/reference/census/"
        "county_population.csv"
    ),

    "county_svi": Path(
        "data/reference/cdc/"
        "county_svi_2022.csv"
    ),

    "fema_declarations": Path(
        "data/reference/fema/"
        "county_disaster_declarations.csv"
    ),
}


# ============================================================
# 3. CREATE BIGQUERY CLIENT
# ============================================================

client = bigquery.Client(
    project=PROJECT_ID
)


print("\n========================================")
print("CRISISOPS - BIGQUERY RAW LOAD")
print("========================================")

print(
    f"\nProject: {PROJECT_ID}"
)

print(
    f"Dataset: {DATASET_ID}"
)


# ============================================================
# 4. LOAD EACH SOURCE TABLE
# ============================================================

load_results = []


for table_name, file_path in TABLES.items():

    print(
        "\n----------------------------------------"
    )

    print(
        f"Loading: {table_name}"
    )

    print(
        f"Source: {file_path}"
    )


    # --------------------------------------------------------
    # Verify file exists
    # --------------------------------------------------------

    if not file_path.exists():

        print(
            "STATUS: SKIPPED - FILE NOT FOUND"
        )

        load_results.append(
            {
                "table_name": table_name,
                "status": "FILE_NOT_FOUND",
                "rows": 0,
                "columns": 0,
            }
        )

        continue


    # --------------------------------------------------------
    # Read raw data as strings
    # --------------------------------------------------------
    #
    # Important:
    #
    # Raw warehouse layer preserves source values.
    # We will perform type casting inside dbt staging.
    #
    # This also protects geographic identifiers such
    # as FIPS codes from losing leading zeros.

    df = pd.read_csv(
        file_path,
        dtype="string",
        keep_default_na=False,
    )


    print(
        f"Rows read: {len(df):,}"
    )

    print(
        f"Columns read: {len(df.columns)}"
    )


    # --------------------------------------------------------
    # Normalize column names
    # --------------------------------------------------------

    df.columns = [
        column.strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")

        for column in df.columns
    ]


    # --------------------------------------------------------
    # Convert pandas missing values to Python None
    # --------------------------------------------------------

    df = df.replace(
        {
            pd.NA: None,
            "": None,
        }
    )


    # --------------------------------------------------------
    # Build BigQuery schema
    # --------------------------------------------------------
    #
    # RAW layer intentionally uses STRING columns.
    #
    # dbt staging models will later cast fields into:
    #
    # INT64
    # FLOAT64
    # BOOL
    # TIMESTAMP
    # DATE
    #
    # where appropriate.

    schema = [
        bigquery.SchemaField(
            column,
            "STRING",
            mode="NULLABLE",
        )

        for column in df.columns
    ]


    # --------------------------------------------------------
    # Target table
    # --------------------------------------------------------

    table_id = (
        f"{PROJECT_ID}."
        f"{DATASET_ID}."
        f"{table_name}"
    )


    # --------------------------------------------------------
    # BigQuery load configuration
    # --------------------------------------------------------

    job_config = (
        bigquery.LoadJobConfig(
            schema=schema,
            write_disposition=(
                bigquery.WriteDisposition.WRITE_TRUNCATE
            ),
        )
    )


    # --------------------------------------------------------
    # Upload
    # --------------------------------------------------------

    load_job = (
        client.load_table_from_dataframe(
            df,
            table_id,
            job_config=job_config,
        )
    )


    load_job.result()


    # --------------------------------------------------------
    # Validate uploaded table
    # --------------------------------------------------------

    table = client.get_table(
        table_id
    )


    print(
        f"BigQuery rows: {table.num_rows:,}"
    )

    print(
        f"BigQuery columns: "
        f"{len(table.schema)}"
    )

    print(
        "STATUS: SUCCESS"
    )


    load_results.append(
        {
            "table_name": table_name,
            "status": "SUCCESS",
            "rows": table.num_rows,
            "columns": len(table.schema),
        }
    )


# ============================================================
# 5. LOAD SUMMARY
# ============================================================

results_df = pd.DataFrame(
    load_results
)


print(
    "\n========================================"
)

print(
    "BIGQUERY RAW LOAD SUMMARY"
)

print(
    "========================================"
)


print(
    results_df.to_string(
        index=False
    )
)


successful_tables = (
    results_df[
        "status"
    ]
    .eq(
        "SUCCESS"
    )
    .sum()
)


print(
    f"\nSuccessful tables: "
    f"{successful_tables}/{len(TABLES)}"
)


# ============================================================
# 6. FINAL STATUS
# ============================================================

if successful_tables == len(TABLES):

    print(
        "\nALL RAW TABLES LOADED SUCCESSFULLY"
    )

else:

    print(
        "\nRAW LOAD COMPLETED WITH SKIPPED TABLES"
    )


print(
    "\n========================================"
)

print(
    "BIGQUERY RAW LOAD COMPLETE"
)

print(
    "========================================"
)