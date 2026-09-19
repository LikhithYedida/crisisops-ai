from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


# ============================================================
# CrisisOps production pipeline runner
# ============================================================
#
# Runs the same pipeline currently triggered by the local
# Next.js /api/refresh route, but independently from the web app.
#
# Intended execution:
#
#   Cloud Scheduler
#       ↓
#   Cloud Run Job
#       ↓
#   run_pipeline.py
#       ↓
#   BigQuery + dbt
#
# ============================================================


PROJECT_ROOT = Path(__file__).resolve().parents[1]

DBT_PROJECT_DIR = (
    PROJECT_ROOT
    / "dbt"
    / "crisisops"
)

DBT_PROFILES_DIR = (
    PROJECT_ROOT
    / "deployment"
)


@dataclass
class PipelineStep:
    name: str
    command: list[str]
    cwd: Path


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc,
    )


def timestamp() -> str:
    return (
        utc_now()
        .isoformat(
            timespec="seconds",
        )
    )


def log(
    message: str,
) -> None:

    print(
        f"[{timestamp()}] "
        f"[CrisisOps] "
        f"{message}",
        flush=True,
    )


def run_step(
    step: PipelineStep,
    dry_run: bool = False,
) -> float:

    display_command = " ".join(
        step.command,
    )

    log(
        f"Starting: {step.name}"
    )

    log(
        f"Command: {display_command}"
    )

    log(
        f"Working directory: {step.cwd}"
    )


    if dry_run:

        log(
            f"DRY RUN — skipped: {step.name}"
        )

        return 0.0


    started = time.monotonic()


    environment = {
        **os.environ,

        "PYTHONUNBUFFERED":
            "1",
    }


    result = subprocess.run(
        step.command,

        cwd=step.cwd,

        env=environment,

        text=True,

        stdout=sys.stdout,

        stderr=sys.stderr,

        check=False,
    )


    duration = (
        time.monotonic()
        - started
    )


    if result.returncode != 0:

        log(
            (
                f"FAILED: {step.name} "
                f"after {duration:.1f}s "
                f"(exit code "
                f"{result.returncode})"
            )
        )

        raise RuntimeError(
            (
                f"Pipeline step failed: "
                f"{step.name}"
            )
        )


    log(
        (
            f"Completed: {step.name} "
            f"in {duration:.1f}s"
        )
    )


    return duration


def build_pipeline() -> list[
    PipelineStep
]:

    return [

        # ====================================================
        # 1. Refresh live source data
        # ====================================================

        # ============================================================
# 1A. Fetch current NWS live data
# ============================================================

PipelineStep(
    name=(
        "Fetch current NWS alerts"
    ),

    command=[
        sys.executable,

        str(
            PROJECT_ROOT
            / "ingestion"
            / "nws"
            / "fetch_active_alerts.py"
        ),
    ],

    cwd=PROJECT_ROOT,
),

# ============================================================
# 1B. Load refreshed live data into BigQuery
# ============================================================

PipelineStep(
    name=(
        "Load live source data"
    ),

    command=[
        sys.executable,

        str(
            PROJECT_ROOT
            / "ingestion"
            / "bigquery"
            / "load_raw_tables.py"
        ),

        "--group",
        "live",
    ],

    cwd=PROJECT_ROOT,
),

# ============================================================
# 1B. Normalize current NWS alerts
# ============================================================

PipelineStep(
    name=(
        "Normalize NWS alerts"
    ),

    command=[
        sys.executable,

        str(
            PROJECT_ROOT
            / "processing"
            / "nws"
            / "normalize_alerts.py"
        ),
    ],

    cwd=PROJECT_ROOT,
),
# ============================================================
# 1C. Load refreshed live data into BigQuery
# ============================================================

PipelineStep(
    name=(
        "Load live source data"
    ),

    command=[
        sys.executable,

        str(
            PROJECT_ROOT
            / "ingestion"
            / "bigquery"
            / "load_raw_tables.py"
        ),

        "--group",
        "live",
    ],

    cwd=PROJECT_ROOT,
),
        # ====================================================
        # 2. Rebuild dbt models
        # ====================================================

        PipelineStep(
            name=(
                "Build dbt models"
            ),

            command=[
                "dbt",
                "run",

                "--project-dir",
                str(
                    DBT_PROJECT_DIR
                ),

                "--profiles-dir",
                str(
                    DBT_PROFILES_DIR
                ),
            ],

            cwd=PROJECT_ROOT,
        ),


        # ====================================================
        # 3. Run dbt tests
        # ====================================================

        PipelineStep(
            name=(
                "Run dbt validation tests"
            ),

            command=[
                "dbt",
                "test",

                "--project-dir",
                str(
                    DBT_PROJECT_DIR
                ),

                "--profiles-dir",
                str(
                    DBT_PROFILES_DIR
                ),
            ],

            cwd=PROJECT_ROOT,
        ),


        # ====================================================
        # 4. Capture dbt execution metadata
        # ====================================================

        PipelineStep(
            name=(
                "Capture dbt run metadata"
            ),

            command=[
                sys.executable,

                str(
                    PROJECT_ROOT
                    / "ingestion"
                    / "bigquery"
                    / "capture_dbt_run_metadata.py"
                ),
            ],

            cwd=PROJECT_ROOT,
        ),


        # ====================================================
        # 5. Capture ingestion metadata
        # ====================================================

        PipelineStep(
            name=(
                "Capture ingestion metadata"
            ),

            command=[
                sys.executable,

                str(
                    PROJECT_ROOT
                    / "ingestion"
                    / "bigquery"
                    / "capture_ingestion_metadata.py"
                ),
            ],

            cwd=PROJECT_ROOT,
        ),


        # ====================================================
        # 6. Rebuild monitoring marts
        # ====================================================

        PipelineStep(
            name=(
                "Rebuild data-health marts"
            ),

            command=[
                "dbt",
                "run",

                "--project-dir",
                str(
                    DBT_PROJECT_DIR
                ),

                "--profiles-dir",
                str(
                    DBT_PROFILES_DIR
                ),

                "--select",

                "stg_ingestion_metadata",

                "stg_dbt_run_metadata",

                "mart_source_freshness",

                "mart_pipeline_health",
            ],

            cwd=PROJECT_ROOT,
        ),

    ]


def parse_args() -> argparse.Namespace:

    parser = argparse.ArgumentParser(
        description=(
            "Run the CrisisOps "
            "production data pipeline."
        ),
    )


    parser.add_argument(
        "--dry-run",

        action="store_true",

        help=(
            "Print each pipeline step "
            "without executing it."
        ),
    )


    return parser.parse_args()


def main() -> int:

    args = parse_args()


    started_at = utc_now()

    total_started = (
        time.monotonic()
    )


    log(
        "========================================"
    )

    log(
        "CrisisOps pipeline starting"
    )

    log(
        (
            "Google Cloud project: "
            f"{os.getenv(
                'GOOGLE_CLOUD_PROJECT',
                'crisisops-intelligence',
            )}"
        )
    )

    log(
        (
            "dbt dataset: "
            f"{os.getenv(
                'DBT_DATASET',
                'crisisops_staging',
            )}"
        )
    )

    log(
        (
            "Mode: "
            + (
                "DRY RUN"
                if args.dry_run
                else "EXECUTE"
            )
        )
    )

    log(
        "========================================"
    )


    completed_steps: list[
        tuple[str, float]
    ] = []


    try:

        for step in build_pipeline():

            duration = run_step(
                step,
                dry_run=args.dry_run,
            )

            completed_steps.append(
                (
                    step.name,
                    duration,
                )
            )


    except Exception as error:

        elapsed = (
            time.monotonic()
            - total_started
        )


        log(
            "========================================"
        )

        log(
            "PIPELINE FAILED"
        )

        log(
            f"Reason: {error}"
        )

        log(
            (
                f"Elapsed time: "
                f"{elapsed:.1f}s"
            )
        )

        log(
            (
                "Steps completed: "
                f"{len(completed_steps)}"
            )
        )

        log(
            "========================================"
        )


        return 1


    finished_at = utc_now()

    elapsed = (
        time.monotonic()
        - total_started
    )


    log(
        "========================================"
    )

    log(
        "PIPELINE COMPLETED SUCCESSFULLY"
    )

    log(
        (
            "Started: "
            f"{started_at.isoformat()}"
        )
    )

    log(
        (
            "Finished: "
            f"{finished_at.isoformat()}"
        )
    )

    log(
        (
            "Duration: "
            f"{elapsed:.1f}s"
        )
    )

    log(
        (
            "Steps completed: "
            f"{len(completed_steps)}"
        )
    )


    for (
        step_name,
        step_duration,
    ) in completed_steps:

        log(
            (
                f"✓ {step_name}: "
                f"{step_duration:.1f}s"
            )
        )


    log(
        "========================================"
    )


    return 0


if __name__ == "__main__":

    raise SystemExit(
        main()
    )