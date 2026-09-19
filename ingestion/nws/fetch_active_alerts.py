from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests


# ============================================================
# CrisisOps
# National Weather Service - Active Alerts Ingestion
#
# Purpose:
# Fetch the current nationwide NWS active-alert feed and persist
# the untouched GeoJSON response into the raw data layer.
#
# Downstream:
# processing/nws/normalize_alerts.py
#     -> data/processed/nws/active_alerts.csv
#     -> data/processed/nws/alert_zones.csv
# ============================================================


PROJECT_ROOT = Path(__file__).resolve().parents[2]

RAW_OUTPUT_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "nws"
)

NWS_ACTIVE_ALERTS_URL = (
    "https://api.weather.gov/alerts/active"
)

NWS_USER_AGENT = os.getenv(
    "NWS_USER_AGENT",
    (
        "CrisisOps/1.0 "
        "(U.S. disaster intelligence portfolio project)"
    ),
)


def fetch_active_alerts() -> dict:
    """
    Retrieve the current nationwide NWS active-alert collection.
    """

    print()
    print("=" * 60)
    print("CRISISOPS - NWS ACTIVE ALERT INGESTION")
    print("=" * 60)

    print(
        f"\nRequesting: {NWS_ACTIVE_ALERTS_URL}"
    )

    response = requests.get(
        NWS_ACTIVE_ALERTS_URL,
        headers={
            "User-Agent": NWS_USER_AGENT,
            "Accept": "application/geo+json",
        },
        timeout=90,
    )

    response.raise_for_status()

    payload = response.json()

    features = payload.get(
        "features",
        [],
    )

    if not isinstance(features, list):
        raise RuntimeError(
            "NWS response did not contain a valid features array."
        )

    print(
        f"Active alert features received: {len(features):,}"
    )

    return payload


def save_raw_alerts(
    payload: dict,
) -> Path:
    """
    Persist the raw NWS GeoJSON response using a sortable UTC
    timestamp so normalize_alerts.py can locate the newest file.
    """

    RAW_OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    timestamp = datetime.now(
        timezone.utc
    ).strftime(
        "%Y%m%d_%H%M%S"
    )

    output_path = (
        RAW_OUTPUT_DIR
        / f"active_alerts_{timestamp}.geojson"
    )

    with output_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            payload,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print(
        f"Raw alert file written: {output_path}"
    )

    return output_path


def main() -> int:
    try:
        payload = fetch_active_alerts()

        output_path = save_raw_alerts(
            payload
        )

        features = payload.get(
            "features",
            [],
        )

        print()
        print("-" * 60)
        print("NWS INGESTION COMPLETE")
        print("-" * 60)

        print(
            f"Alerts captured: {len(features):,}"
        )

        print(
            f"Output: {output_path}"
        )

        print()

        return 0

    except requests.RequestException as error:
        print(
            (
                "\nNWS request failed: "
                f"{error}"
            ),
            file=sys.stderr,
        )

        return 1

    except Exception as error:
        print(
            (
                "\nNWS ingestion failed: "
                f"{error}"
            ),
            file=sys.stderr,
        )

        return 1


if __name__ == "__main__":
    raise SystemExit(
        main()
    )