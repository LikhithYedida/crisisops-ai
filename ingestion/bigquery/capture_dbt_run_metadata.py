from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from google.api_core.exceptions import NotFound
from google.cloud import bigquery


# ============================================================
# CrisisOps
# dbt Run Metadata Capture
#
# Purpose:
# Read dbt's run_results.json artifact after a dbt command and
# persist a compact operational summary into BigQuery.
#
# This allows CrisisOps to monitor:
#   - latest analytics build
#   - success / failure state
#   - models executed
#   - tests executed
#   - pass / warning / error counts
#   - execution time
#
# This table will eventually feed the System Health dashboard.
# ============================================================


PROJECT_ID = "crisisops-intelligence"
DATASET_ID = "crisisops_raw"
TABLE_ID = "dbt_run_metadata"

FULL_TABLE_ID = (
    f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
)


# ============================================================
# Resolve project paths
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

RUN_RESULTS_PATH = (
    PROJECT_ROOT
    / "dbt"
    / "crisisops"
    / "target"
    / "run_results.json"
)


# ============================================================
# BigQuery schema
# ============================================================

TABLE_SCHEMA = [

    bigquery.SchemaField(
        "invocation_id",
        "STRING",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "captured_at",
        "TIMESTAMP",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "invocation_started_at",
        "TIMESTAMP",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "artifact_generated_at",
        "TIMESTAMP",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "dbt_version",
        "STRING",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "command",
        "STRING",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "project_name",
        "STRING",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "target_name",
        "STRING",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "elapsed_time_seconds",
        "FLOAT",
        mode="NULLABLE",
    ),

    bigquery.SchemaField(
        "total_nodes",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "models_executed",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "tests_executed",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "seeds_executed",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "snapshots_executed",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "passed_nodes",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "warning_nodes",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "error_nodes",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "skipped_nodes",
        "INTEGER",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "pass_rate_pct",
        "FLOAT",
        mode="REQUIRED",
    ),

    bigquery.SchemaField(
        "run_status",
        "STRING",
        mode="REQUIRED",
    ),

]


# ============================================================
# Ensure destination table exists
# ============================================================

def ensure_table(
    client: bigquery.Client,
) -> None:

    try:

        client.get_table(
            FULL_TABLE_ID
        )

        print(
            f"Metadata table exists: "
            f"{FULL_TABLE_ID}"
        )

    except NotFound:

        table = bigquery.Table(
            FULL_TABLE_ID,
            schema=TABLE_SCHEMA,
        )

        client.create_table(
            table
        )

        print(
            f"Created metadata table: "
            f"{FULL_TABLE_ID}"
        )


# ============================================================
# Read dbt artifact
# ============================================================

def load_run_results() -> dict[str, Any]:

    if not RUN_RESULTS_PATH.exists():

        raise FileNotFoundError(
            "\nCould not find dbt run_results.json.\n"
            f"Expected location:\n{RUN_RESULTS_PATH}\n\n"
            "Run `dbt build` first."
        )


    with RUN_RESULTS_PATH.open(
        "r",
        encoding="utf-8",
    ) as file:

        return json.load(file)


# ============================================================
# Build run summary
# ============================================================

def build_summary(
    artifact: dict[str, Any],
) -> dict[str, Any]:

    metadata = artifact.get(
        "metadata",
        {},
    )

    args = artifact.get(
        "args",
        {},
    )

    results = artifact.get(
        "results",
        [],
    )


    invocation_id = metadata.get(
        "invocation_id"
    )

    if not invocation_id:

        raise ValueError(
            "dbt artifact does not contain "
            "metadata.invocation_id"
        )


    statuses = [

        str(
            result.get(
                "status",
                "unknown",
            )
        ).lower()

        for result in results

    ]


    unique_ids = [

        str(
            result.get(
                "unique_id",
                "",
            )
        )

        for result in results

    ]


    passed_statuses = {
        "success",
        "pass",
    }

    warning_statuses = {
        "warn",
        "warning",
    }

    error_statuses = {
        "error",
        "fail",
        "failed",
        "runtime error",
    }

    skipped_statuses = {
        "skip",
        "skipped",
    }


    passed_nodes = sum(
        status in passed_statuses
        for status in statuses
    )

    warning_nodes = sum(
        status in warning_statuses
        for status in statuses
    )

    error_nodes = sum(
        status in error_statuses
        for status in statuses
    )

    skipped_nodes = sum(
        status in skipped_statuses
        for status in statuses
    )


    total_nodes = len(
        results
    )


    models_executed = sum(
        unique_id.startswith("model.")
        for unique_id in unique_ids
    )

    tests_executed = sum(
        unique_id.startswith("test.")
        for unique_id in unique_ids
    )

    seeds_executed = sum(
        unique_id.startswith("seed.")
        for unique_id in unique_ids
    )

    snapshots_executed = sum(
        unique_id.startswith("snapshot.")
        for unique_id in unique_ids
    )


    if total_nodes > 0:

        pass_rate_pct = round(

            (
                passed_nodes
                /
                total_nodes
            )
            * 100,

            2,

        )

    else:

        pass_rate_pct = 0.0


    if error_nodes > 0:

        run_status = "FAILED"

    elif warning_nodes > 0:

        run_status = "WARNING"

    elif skipped_nodes > 0:

        run_status = "PARTIAL"

    else:

        run_status = "SUCCESS"


    command = (

        args.get("which")
        or args.get("command")
        or "unknown"

    )


    target_name = (

        args.get("target")
        or "default"

    )


    project_name = (

        args.get("project_name")
        or "crisisops"

    )


    return {

        "invocation_id":
            invocation_id,

        "captured_at":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "invocation_started_at":
            metadata.get(
                "invocation_started_at"
            ),

        "artifact_generated_at":
            metadata.get(
                "generated_at"
            ),

        "dbt_version":
            metadata.get(
                "dbt_version"
            ),

        "command":
            command,

        "project_name":
            project_name,

        "target_name":
            target_name,

        "elapsed_time_seconds":
            artifact.get(
                "elapsed_time"
            ),

        "total_nodes":
            total_nodes,

        "models_executed":
            models_executed,

        "tests_executed":
            tests_executed,

        "seeds_executed":
            seeds_executed,

        "snapshots_executed":
            snapshots_executed,

        "passed_nodes":
            passed_nodes,

        "warning_nodes":
            warning_nodes,

        "error_nodes":
            error_nodes,

        "skipped_nodes":
            skipped_nodes,

        "pass_rate_pct":
            pass_rate_pct,

        "run_status":
            run_status,

    }


# ============================================================
# Prevent duplicate artifact insertion
# ============================================================

def invocation_exists(
    client: bigquery.Client,
    invocation_id: str,
) -> bool:

    sql = f"""
        select
            count(*) as record_count

        from `{FULL_TABLE_ID}`

        where invocation_id = @invocation_id
    """


    job_config = bigquery.QueryJobConfig(

        query_parameters=[

            bigquery.ScalarQueryParameter(
                "invocation_id",
                "STRING",
                invocation_id,
            )

        ]

    )


    result = client.query(

        sql,

        job_config=job_config,

    ).result()


    row = next(
        iter(result)
    )


    return (
        row.record_count > 0
    )


# ============================================================
# Store run metadata
# ============================================================

def insert_summary(
    client: bigquery.Client,
    summary: dict[str, Any],
) -> bool:

    if invocation_exists(

        client,

        summary[
            "invocation_id"
        ],

    ):

        print()
        print(
            "This dbt invocation has already "
            "been captured."
        )

        print(
            f"Invocation ID: "
            f"{summary['invocation_id']}"
        )

        return False


    errors = client.insert_rows_json(

        FULL_TABLE_ID,

        [summary],

    )


    if errors:

        raise RuntimeError(
            f"BigQuery insert failed: {errors}"
        )


    return True


# ============================================================
# Console summary
# ============================================================

def print_summary(
    summary: dict[str, Any],
) -> None:

    print()
    print("=" * 72)

    print(
        "CRISISOPS DBT RUN SUMMARY"
    )

    print("=" * 72)

    print(
        f"Invocation ID:      "
        f"{summary['invocation_id']}"
    )

    print(
        f"Command:            "
        f"{summary['command']}"
    )

    print(
        f"dbt version:        "
        f"{summary['dbt_version']}"
    )

    print(
        f"Run status:         "
        f"{summary['run_status']}"
    )

    print(
        f"Total resources:    "
        f"{summary['total_nodes']}"
    )

    print(
        f"Models executed:    "
        f"{summary['models_executed']}"
    )

    print(
        f"Tests executed:     "
        f"{summary['tests_executed']}"
    )

    print(
        f"Passed:             "
        f"{summary['passed_nodes']}"
    )

    print(
        f"Warnings:           "
        f"{summary['warning_nodes']}"
    )

    print(
        f"Errors:             "
        f"{summary['error_nodes']}"
    )

    print(
        f"Skipped:            "
        f"{summary['skipped_nodes']}"
    )

    print(
        f"Pass rate:          "
        f"{summary['pass_rate_pct']}%"
    )

    elapsed = summary[
        "elapsed_time_seconds"
    ]

    if elapsed is not None:

        print(
            f"Execution time:     "
            f"{round(elapsed, 2)} seconds"
        )


    print("=" * 72)


# ============================================================
# Main
# ============================================================

def main() -> None:

    print()
    print(
        "Capturing latest dbt run metadata..."
    )


    artifact = load_run_results()


    summary = build_summary(
        artifact
    )


    client = bigquery.Client(
        project=PROJECT_ID
    )


    ensure_table(
        client
    )


    inserted = insert_summary(
        client,
        summary,
    )


    print_summary(
        summary
    )


    if inserted:

        print()
        print(
            "dbt run metadata captured "
            "successfully."
        )


if __name__ == "__main__":

    main()