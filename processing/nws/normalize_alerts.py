import json
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd


# -------------------------------------------------
# 1. Folder configuration
# -------------------------------------------------

RAW_FOLDER = Path("data/raw/nws")

PROCESSED_FOLDER = Path(
    "data/processed/nws"
)


# -------------------------------------------------
# 2. Find newest raw NWS file
# -------------------------------------------------

raw_files = list(
    RAW_FOLDER.glob(
        "active_alerts_*.geojson"
    )
)


if not raw_files:
    raise FileNotFoundError(
        "No raw NWS alert files found."
    )


latest_file = max(
    raw_files,
    key=lambda file: file.stat().st_mtime,
)


print(
    f"Reading raw file:\n{latest_file}"
)


# -------------------------------------------------
# 3. Load GeoJSON
# -------------------------------------------------

with open(
    latest_file,
    "r",
    encoding="utf-8",
) as file:

    raw_data = json.load(file)


features = raw_data.get(
    "features",
    [],
)


print(
    f"\nRaw alerts found: {len(features)}"
)


# -------------------------------------------------
# 4. Storage containers
# -------------------------------------------------

alert_rows = []

zone_rows = []


# -------------------------------------------------
# 5. Process every alert
# -------------------------------------------------

for feature in features:

    properties = feature.get(
        "properties",
        {},
    )

    geometry = feature.get(
        "geometry"
    )

    alert_id = feature.get(
        "id"
    )


    # ---------------------------------------------
    # Geographic information
    # ---------------------------------------------

    affected_zones = properties.get(
        "affectedZones",
        []
    ) or []


    geocode = properties.get(
        "geocode",
        {}
    ) or {}


    ugc_codes = geocode.get(
        "UGC",
        []
    ) or []


    same_codes = geocode.get(
        "SAME",
        []
    ) or []


    # ---------------------------------------------
    # Main alert record
    # ---------------------------------------------

    alert_row = {

        "alert_id": alert_id,

        "event": properties.get(
            "event"
        ),

        "severity": properties.get(
            "severity"
        ),

        "certainty": properties.get(
            "certainty"
        ),

        "urgency": properties.get(
            "urgency"
        ),

        "status": properties.get(
            "status"
        ),

        "message_type": properties.get(
            "messageType"
        ),

        "category": properties.get(
            "category"
        ),

        "sender": properties.get(
            "sender"
        ),

        "sender_name": properties.get(
            "senderName"
        ),

        "area_description": properties.get(
            "areaDesc"
        ),

        "headline": properties.get(
            "headline"
        ),

        "description": properties.get(
            "description"
        ),

        "instruction": properties.get(
            "instruction"
        ),

        "response": properties.get(
            "response"
        ),

        "sent": properties.get(
            "sent"
        ),

        "effective": properties.get(
            "effective"
        ),

        "onset": properties.get(
            "onset"
        ),

        "expires": properties.get(
            "expires"
        ),

        "ends": properties.get(
            "ends"
        ),

        "geometry_type": (
            geometry.get("type")
            if geometry
            else None
        ),

        "geometry": (
            json.dumps(geometry)
            if geometry
            else None
        ),

        "ugc_codes": "|".join(
            ugc_codes
        ),

        "same_codes": "|".join(
            same_codes
        ),

        "affected_zone_count": len(
            affected_zones
        ),

        "is_actual_alert": (
            properties.get("status")
            == "Actual"
        ),

        "has_geometry": (
            geometry is not None
        ),
    }


    alert_rows.append(
        alert_row
    )


    # ---------------------------------------------
    # Create one row per affected zone
    # ---------------------------------------------

    for zone_url in affected_zones:

        parsed = urlparse(
            zone_url
        )

        path_parts = [
            part
            for part
            in parsed.path.split("/")
            if part
        ]


        zone_type = None

        zone_id = None


        # Typical format:
        # /zones/{zone_type}/{zone_id}

        if len(path_parts) >= 3:

            zone_type = path_parts[-2]

            zone_id = path_parts[-1]


        zone_rows.append({

            "alert_id": alert_id,

            "zone_id": zone_id,

            "zone_type": zone_type,

            "zone_url": zone_url,
        })


# -------------------------------------------------
# 6. Create DataFrames
# -------------------------------------------------

alerts_df = pd.DataFrame(
    alert_rows
)


zones_df = pd.DataFrame(
    zone_rows
)


# -------------------------------------------------
# 7. Convert timestamp columns
# -------------------------------------------------

date_columns = [
    "sent",
    "effective",
    "onset",
    "expires",
    "ends",
]


for column in date_columns:

    alerts_df[column] = pd.to_datetime(
        alerts_df[column],
        errors="coerce",
        utc=True,
    )


# -------------------------------------------------
# 8. Remove duplicate alerts
# -------------------------------------------------

alerts_before = len(
    alerts_df
)


alerts_df = alerts_df.drop_duplicates(
    subset=["alert_id"]
)


alerts_removed = (
    alerts_before
    - len(alerts_df)
)


# -------------------------------------------------
# 9. Remove duplicate alert-zone relationships
# -------------------------------------------------

zones_before = len(
    zones_df
)


if not zones_df.empty:

    zones_df = zones_df.drop_duplicates(
        subset=[
            "alert_id",
            "zone_id",
            "zone_type",
        ]
    )


zones_removed = (
    zones_before
    - len(zones_df)
)


# -------------------------------------------------
# 10. Save processed files
# -------------------------------------------------

PROCESSED_FOLDER.mkdir(
    parents=True,
    exist_ok=True,
)


alerts_output = (
    PROCESSED_FOLDER
    / "active_alerts.csv"
)


zones_output = (
    PROCESSED_FOLDER
    / "alert_zones.csv"
)


alerts_df.to_csv(
    alerts_output,
    index=False,
)


zones_df.to_csv(
    zones_output,
    index=False,
)


# -------------------------------------------------
# 11. Quality summary
# -------------------------------------------------

print(
    f"\nProcessed alerts: "
    f"{len(alerts_df)}"
)


print(
    f"Duplicate alerts removed: "
    f"{alerts_removed}"
)


print(
    f"Affected-zone relationships: "
    f"{len(zones_df)}"
)


print(
    f"Duplicate zone relationships removed: "
    f"{zones_removed}"
)


print(
    "\nZone type distribution:"
)


if not zones_df.empty:

    print(
        zones_df["zone_type"]
        .value_counts(
            dropna=False
        )
    )


print(
    "\nActual vs non-actual alerts:"
)


print(
    alerts_df[
        "is_actual_alert"
    ].value_counts(
        dropna=False
    )
)


print(
    "\nAlerts with geometry:"
)


print(
    alerts_df[
        "has_geometry"
    ].value_counts(
        dropna=False
    )
)


print(
    "\nProcessed files saved:"
)


print(
    alerts_output
)


print(
    zones_output
)