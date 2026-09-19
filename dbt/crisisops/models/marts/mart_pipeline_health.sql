{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- Mart: Pipeline Health
--
-- Grain:
-- Exactly one row describing the latest CrisisOps system state.
--
-- Combines:
--   1. Latest dbt analytics-build result
--   2. Current source freshness
--   3. Operational scoring coverage
--
-- Purpose:
-- Power the public-facing System Health section of CrisisOps
-- with real operational metadata rather than hard-coded labels.
-- ============================================================


with dbt_runs as (

    select *
    from {{ ref('stg_dbt_run_metadata') }}

),


latest_dbt_run as (

    select
        *

    from dbt_runs

    qualify row_number() over (

        order by
            artifact_generated_at desc,
            captured_at desc

    ) = 1

),


source_health as (

    select *
    from {{ ref('mart_source_freshness') }}

),


source_summary as (

    select

        count(*) as monitored_sources,

        countif(
            freshness_status = 'FRESH'
        ) as fresh_sources,

        countif(
            freshness_status = 'WARNING'
        ) as warning_sources,

        countif(
            freshness_status = 'STALE'
        ) as stale_sources,

        countif(
            freshness_status = 'MISSING'
        ) as missing_sources,

        countif(
            freshness_status = 'UNKNOWN'
        ) as unknown_sources,

        countif(
            requires_attention
        ) as sources_requiring_attention,

        max(
            health_severity_rank
        ) as worst_source_health_rank,

        min(
            loaded_at
        ) as oldest_source_loaded_at,

        max(
            captured_at
        ) as latest_freshness_capture_at

    from source_health

),


scored_geographies as (

    select

        count(*) as scored_geographies

    from {{ ref('mart_county_operational_priority') }}

),


unscored_geographies as (

    select

        count(*) as unscored_geographies

    from {{ ref('mart_unscored_active_geographies') }}

),


combined as (

    select

        -- ----------------------------------------------------
        -- Analytics build metadata
        -- ----------------------------------------------------

        d.invocation_id
            as latest_dbt_invocation_id,

        d.artifact_generated_at
            as latest_dbt_run_at,

        d.dbt_version,

        d.command
            as latest_dbt_command,

        d.run_status
            as latest_dbt_run_status,

        d.elapsed_time_seconds
            as latest_dbt_elapsed_seconds,

        d.total_nodes
            as latest_dbt_total_resources,

        d.models_executed
            as latest_dbt_models_executed,

        d.tests_executed
            as latest_dbt_tests_executed,

        d.passed_nodes
            as latest_dbt_passed_nodes,

        d.warning_nodes
            as latest_dbt_warning_nodes,

        d.error_nodes
            as latest_dbt_error_nodes,

        d.skipped_nodes
            as latest_dbt_skipped_nodes,

        d.pass_rate_pct
            as latest_dbt_pass_rate_pct,


        -- ----------------------------------------------------
        -- Source freshness
        -- ----------------------------------------------------

        s.monitored_sources,

        s.fresh_sources,

        s.warning_sources,

        s.stale_sources,

        s.missing_sources,

        s.unknown_sources,

        s.sources_requiring_attention,

        s.oldest_source_loaded_at,

        s.latest_freshness_capture_at,


        -- ----------------------------------------------------
        -- Scoring coverage
        -- ----------------------------------------------------

        sg.scored_geographies,

        ug.unscored_geographies,

        (
            sg.scored_geographies
            +
            ug.unscored_geographies
        ) as total_active_geographies,

        round(

            safe_divide(

                sg.scored_geographies,

                sg.scored_geographies
                +
                ug.unscored_geographies

            ) * 100,

            2

        ) as scoring_coverage_pct,


        -- ----------------------------------------------------
        -- Overall platform status
        -- ----------------------------------------------------

        case

            when d.run_status = 'FAILED'
                then 'CRITICAL'

            when d.error_nodes > 0
                then 'CRITICAL'

            when s.missing_sources > 0
                then 'CRITICAL'

            when s.stale_sources > 0
                then 'DEGRADED'

            when s.unknown_sources > 0
                then 'DEGRADED'

            when s.warning_sources > 0
                then 'WARNING'

            when d.run_status in (
                'WARNING',
                'PARTIAL'
            )
                then 'WARNING'

            else 'HEALTHY'

        end as overall_system_status,


        current_timestamp()
            as health_evaluated_at

    from latest_dbt_run d

    cross join source_summary s

    cross join scored_geographies sg

    cross join unscored_geographies ug

)


select *
from combined