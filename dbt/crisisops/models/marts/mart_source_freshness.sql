{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- Mart: Source Freshness
--
-- Grain:
-- One row per monitored source table.
--
-- Purpose:
-- Provide the latest known operational health state of every
-- CrisisOps source for dashboards, monitoring, and audits.
-- ============================================================


with metadata as (

    select *
    from {{ ref('stg_ingestion_metadata') }}

),


latest_capture as (

    select

        *,

        row_number() over (

            partition by target_table

            order by
                captured_at desc

        ) as freshness_rank

    from metadata

),


current_source_health as (

    select

        source_name,
        source_category,
        target_table,

        table_status,

        loaded_at,
        captured_at,

        row_count,
        size_bytes,

        warn_after_minutes,
        error_after_minutes,

        freshness_age_minutes_at_capture
            as freshness_age_minutes,

        freshness_status_at_capture
            as freshness_status,

        round(
            freshness_age_minutes_at_capture / 60,
            2
        ) as freshness_age_hours,

        round(
            freshness_age_minutes_at_capture / 1440,
            2
        ) as freshness_age_days,

        case

            when freshness_status_at_capture = 'FRESH'
                then 1

            when freshness_status_at_capture = 'WARNING'
                then 2

            when freshness_status_at_capture = 'STALE'
                then 3

            when freshness_status_at_capture = 'UNKNOWN'
                then 4

            when freshness_status_at_capture = 'MISSING'
                then 5

            else 6

        end as health_severity_rank,

        case

            when freshness_status_at_capture = 'FRESH'
                then true

            else false

        end as is_fresh,

        case

            when freshness_status_at_capture
                in ('STALE', 'MISSING', 'UNKNOWN')
                then true

            else false

        end as requires_attention

    from latest_capture

    where freshness_rank = 1

)


select *
from current_source_health