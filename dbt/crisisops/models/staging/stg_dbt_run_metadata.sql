{{ config(
    materialized='view'
) }}


-- ============================================================
-- CrisisOps
-- Staging: dbt Run Metadata
--
-- Grain:
-- One row per captured dbt invocation.
--
-- Purpose:
-- Standardize dbt execution metadata captured from
-- target/run_results.json for operational monitoring.
-- ============================================================


with source as (

    select *
    from {{ source('crisisops_raw', 'dbt_run_metadata') }}

),


renamed as (

    select

        cast(invocation_id as string)
            as invocation_id,

        safe_cast(captured_at as timestamp)
            as captured_at,

        safe_cast(invocation_started_at as timestamp)
            as invocation_started_at,

        safe_cast(artifact_generated_at as timestamp)
            as artifact_generated_at,

        cast(dbt_version as string)
            as dbt_version,

        cast(command as string)
            as command,

        cast(project_name as string)
            as project_name,

        cast(target_name as string)
            as target_name,

        safe_cast(elapsed_time_seconds as float64)
            as elapsed_time_seconds,

        safe_cast(total_nodes as int64)
            as total_nodes,

        safe_cast(models_executed as int64)
            as models_executed,

        safe_cast(tests_executed as int64)
            as tests_executed,

        safe_cast(seeds_executed as int64)
            as seeds_executed,

        safe_cast(snapshots_executed as int64)
            as snapshots_executed,

        safe_cast(passed_nodes as int64)
            as passed_nodes,

        safe_cast(warning_nodes as int64)
            as warning_nodes,

        safe_cast(error_nodes as int64)
            as error_nodes,

        safe_cast(skipped_nodes as int64)
            as skipped_nodes,

        safe_cast(pass_rate_pct as float64)
            as pass_rate_pct,

        cast(run_status as string)
            as run_status

    from source

)


select *
from renamed