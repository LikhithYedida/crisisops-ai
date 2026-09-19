{{ config(
    materialized='view'
) }}


-- ============================================================
-- CrisisOps
-- Staging: Ingestion Metadata
--
-- Grain:
-- One row per source table per metadata capture.
--
-- Purpose:
-- Standardize the raw operational metadata captured from
-- BigQuery before it is used by monitoring / health marts.
-- ============================================================


with source as (

    select *
    from {{ source('crisisops_raw', 'ingestion_metadata') }}

),


renamed as (

    select

        cast(capture_id as string)
            as capture_id,

        safe_cast(captured_at as timestamp)
            as captured_at,

        cast(source_name as string)
            as source_name,

        cast(source_category as string)
            as source_category,

        cast(target_table as string)
            as target_table,

        cast(table_status as string)
            as table_status,

        safe_cast(loaded_at as timestamp)
            as loaded_at,

        safe_cast(row_count as int64)
            as row_count,

        safe_cast(size_bytes as int64)
            as size_bytes,

        safe_cast(warn_after_minutes as int64)
            as warn_after_minutes,

        safe_cast(error_after_minutes as int64)
            as error_after_minutes,

        safe_cast(
            freshness_age_minutes_at_capture
            as float64
        ) as freshness_age_minutes_at_capture,

        cast(
            freshness_status_at_capture
            as string
        ) as freshness_status_at_capture

    from source

)


select *
from renamed