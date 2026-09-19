from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from google.cloud import bigquery


# ============================================================
# CrisisOps
# BigQuery Ingestion Metadata Capture
#
# Purpose:
# Capture operational metadata for the raw source tables:
#
# - whether the table exists
# - row count
# - storage size
# - BigQuery last-modified timestamp
# - age of the loaded data
# - source-specific freshness thresholds
#
# This gives CrisisOps an auditable source-health layer without
# changing the existing analytical/scoring models.
# ============================================================


PROJECT_ID = "crisisops-intelligence"
RAW_DATASET = "crisisops_raw"

METADATA_TABLE = "ingestion_metadata"

FULL_METADATA_TABLE = (
    f"{PROJECT_ID}.{RAW_DATASET}.{METADATA_TABLE}"
)


# ============================================================
# Freshness SLAs
#
# These are CrisisOps operational refresh expectations.
# They are NOT claims about how often the source agency itself
# publishes new official data.
#
# Values are expressed in minutes.
# ============================================================

SOURCE_CONFIG: dict[str, dict[str, Any]] = {

    "active_alerts": {
        "source_name": "NWS Active Alerts",
        "source_category": "LIVE",
        "warn_after_minutes": 60,
        "error_after_minutes": 180,
    },

    "alert_zones": {
        "source_name": "NWS Alert Zones",
        "source_category": "LIVE",
        "warn_after_minutes": 60,
        "error_after_minutes": 180,
    },

    "forecast_zone_county_crosswalk": {
        "source_name": "NWS Zone-County Crosswalk",
        "source_category": "REFERENCE",
        "warn_after_minutes": 43200,      # 30 days
        "error_after_minutes": 129600,    # 90 days
    },

    "county_population": {
        "source_name": "Census County Population",
        "source_category": "REFERENCE",
        "warn_after_minutes": 64800,      # 45 days
        "error_after_minutes": 172800,    # 120 days
    },

    "county_svi": {
        "source_name": "CDC Social Vulnerability Index",
        "source_category": "REFERENCE",
        "warn_after_minutes": 64800,      # 45 days
        "error_after_minutes": 172800,    # 120 days
    },

    "fema_declarations": {
        "source_name": "FEMA Disaster Declarations",
        "source_category": "HISTORICAL",
        "warn_after_minutes": 10080,      # 7 days
        "error_after_minutes": 20160,     # 14 days
    },

}


# ============================================================
# Metadata table
# ============================================================

METADATA_SCHEMA = [

    bigquery.SchemaField(
        "capture_id",
        "STRING",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "captured_at",
        "TIMESTAMP",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "source_name",
        "STRING",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "source_category",
        "STRING",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "target_table",
        "STRING",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "table_status",
        "STRING",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "loaded_at",
        "TIMESTAMP",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "row_count",
        "INTEGER",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "size_bytes",
        "INTEGER",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "warn_after_minutes",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "error_after_minutes",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "freshness_age_minutes_at_capture",
        "FLOAT",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "freshness_status_at_capture",
        "STRING",
        mode="REQUIRED",
    ),

]


def ensure_metadata_table(
    client: bigquery.Client,
) -> None:

    table_ref = bigquery.Table(
        FULL_METADATA_TABLE,
        schema=METADATA_SCHEMA,
    )

    try:

        client.get_table(
            FULL_METADATA_TABLE
        )

        print(
            f"Metadata table exists: "
            f"{FULL_METADATA_TABLE}"
        )

    except Exception:

        client.create_table(
            table_ref
        )

        print(
            f"Created metadata table: "
            f"{FULL_METADATA_TABLE}"
        )


# ============================================================
# Read BigQuery physical table metadata
# ============================================================

def fetch_raw_table_metadata(
    client: bigquery.Client,
) -> dict[str, dict[str, Any]]:

    sql = f"""
        select

            table_id,

            row_count,

            size_bytes,

            timestamp_millis(
                creation_time
            ) as created_at,

            timestamp_millis(
                last_modified_time
            ) as loaded_at

        from
            `{PROJECT_ID}.{RAW_DATASET}.__TABLES__`
    """

    query_job = client.query(
        sql
    )

    results: dict[str, dict[str, Any]] = {}

    for row in query_job.result():

        results[row.table_id] = {

            "row_count": row.row_count,

            "size_bytes": row.size_bytes,

            "created_at": row.created_at,

            "loaded_at": row.loaded_at,

        }

    return results


# ============================================================
# Calculate freshness
# ============================================================

def calculate_freshness(
    loaded_at: datetime | None,
    captured_at: datetime,
    warn_after_minutes: int,
    error_after_minutes: int,
    table_status: str,
) -> tuple[float | None, str]:

    if table_status != "AVAILABLE":

        return None, "MISSING"


    if loaded_at is None:

        return None, "UNKNOWN"


    if loaded_at.tzinfo is None:

        loaded_at = loaded_at.replace(
            tzinfo=timezone.utc
        )


    age_minutes = (

        captured_at
        -
        loaded_at

    ).total_seconds() / 60


    age_minutes = max(
        age_minutes,
        0.0,
    )


    if age_minutes > error_after_minutes:

        status = "STALE"

    elif age_minutes > warn_after_minutes:

        status = "WARNING"

    else:

        status = "FRESH"


    return round(
        age_minutes,
        2,
    ), status


# ============================================================
# Build snapshot rows
# ============================================================

def build_metadata_rows(
    table_metadata: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:

    captured_at = datetime.now(
        timezone.utc
    )

    capture_id = str(
        uuid.uuid4()
    )

    rows: list[dict[str, Any]] = []


    for target_table, config in SOURCE_CONFIG.items():

        physical_metadata = table_metadata.get(
            target_table
        )


        if physical_metadata is None:

            table_status = "MISSING"

            loaded_at = None
            row_count = None
            size_bytes = None

        else:

            table_status = "AVAILABLE"

            loaded_at = physical_metadata[
                "loaded_at"
            ]

            row_count = physical_metadata[
                "row_count"
            ]

            size_bytes = physical_metadata[
                "size_bytes"
            ]


        age_minutes, freshness_status = (
            calculate_freshness(

                loaded_at=loaded_at,

                captured_at=captured_at,

                warn_after_minutes=config[
                    "warn_after_minutes"
                ],

                error_after_minutes=config[
                    "error_after_minutes"
                ],

                table_status=table_status,

            )
        )


        rows.append({

            "capture_id":
                capture_id,

            "captured_at":
                captured_at.isoformat(),

            "source_name":
                config["source_name"],

            "source_category":
                config["source_category"],

            "target_table":
                target_table,

            "table_status":
                table_status,

            "loaded_at":
                (
                    loaded_at.isoformat()
                    if loaded_at is not None
                    else None
                ),

            "row_count":
                row_count,

            "size_bytes":
                size_bytes,

            "warn_after_minutes":
                config[
                    "warn_after_minutes"
                ],

            "error_after_minutes":
                config[
                    "error_after_minutes"
                ],

            "freshness_age_minutes_at_capture":
                age_minutes,

            "freshness_status_at_capture":
                freshness_status,

        })


    return rows


# ============================================================
# Store metadata snapshot
# ============================================================

def insert_metadata_rows(
    client: bigquery.Client,
    rows: list[dict[str, Any]],
) -> None:

    errors = client.insert_rows_json(

        FULL_METADATA_TABLE,

        rows,

    )


    if errors:

        raise RuntimeError(
            f"BigQuery metadata insert failed: {errors}"
        )


# ============================================================
# Console summary
# ============================================================

def print_summary(
    rows: list[dict[str, Any]],
) -> None:

    print()
    print("=" * 90)

    print(
        "CRISISOPS SOURCE FRESHNESS SNAPSHOT"
    )

    print("=" * 90)

    for row in rows:

        loaded_at = (
            row["loaded_at"]
            or "NOT AVAILABLE"
        )

        age = row[
            "freshness_age_minutes_at_capture"
        ]

        if age is None:

            age_text = "N/A"

        elif age < 60:

            age_text = (
                f"{age:.1f} minutes"
            )

        elif age < 1440:

            age_text = (
                f"{age / 60:.1f} hours"
            )

        else:

            age_text = (
                f"{age / 1440:.1f} days"
            )


        print()

        print(
            f"Source:  "
            f"{row['source_name']}"
        )

        print(
            f"Table:   "
            f"{row['target_table']}"
        )

        print(
            f"Rows:    "
            f"{row['row_count']}"
        )

        print(
            f"Loaded:  "
            f"{loaded_at}"
        )

        print(
            f"Age:     "
            f"{age_text}"
        )

        print(
            f"Status:  "
            f"{row['freshness_status_at_capture']}"
        )


    print()
    print("=" * 90)

    print(
        f"Captured {len(rows)} "
        f"source metadata records."
    )

    print("=" * 90)


# ============================================================
# Main
# ============================================================

def main() -> None:

    print()
    print(
        "Starting CrisisOps ingestion "
        "metadata capture..."
    )

    client = bigquery.Client(
        project=PROJECT_ID
    )


    ensure_metadata_table(
        client
    )


    raw_metadata = fetch_raw_table_metadata(
        client
    )


    metadata_rows = build_metadata_rows(
        raw_metadata
    )


    insert_metadata_rows(
        client,
        metadata_rows,
    )


    print_summary(
        metadata_rows
    )


    print()

    print(
        "Ingestion metadata capture "
        "completed successfully."
    )


if __name__ == "__main__":

    main()