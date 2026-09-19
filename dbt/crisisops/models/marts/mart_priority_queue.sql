{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- Priority Queue Serving Mart
--
-- Grain:
-- One row per scored, currently affected U.S. county
--
-- Purpose:
-- Provide a frontend-ready operational queue for CrisisOps.
--
-- This model does NOT recalculate risk.
-- It consumes the validated county operational priority mart
-- and translates analytical results into operational queue
-- fields for sorting, filtering, drill-down, and explanation.
-- ============================================================


with county_priority as (

    select *

    from {{ ref('mart_county_operational_priority') }}

),


-- ============================================================
-- Operational queue fields
-- ============================================================

queue_enriched as (

    select

        -- ----------------------------------------------------
        -- Identity
        -- ----------------------------------------------------

        county_fips,

        county_full_name,

        county_name,

        state,

        population,


        -- ----------------------------------------------------
        -- National prioritization
        -- ----------------------------------------------------

        national_operational_rank,

        operational_priority_score,

        operational_priority_level,


        -- ----------------------------------------------------
        -- Explicit priority ordering for UI sorting
        -- ----------------------------------------------------

        case operational_priority_level

            when 'CRITICAL' then 1
            when 'HIGH' then 2
            when 'ELEVATED' then 3
            when 'MODERATE' then 4
            when 'LOW' then 5

            else 99

        end as priority_sort_order,


        -- ----------------------------------------------------
        -- Operational attention state
        --
        -- This does not replace the analytical priority level.
        -- It provides simpler action-oriented UI grouping.
        -- ----------------------------------------------------

        case

            when operational_priority_level = 'CRITICAL'
                then 'IMMEDIATE'

            when operational_priority_level = 'HIGH'
                then 'PRIORITY'

            when operational_priority_level = 'ELEVATED'
                then 'MONITOR'

            else
                'AWARENESS'

        end as attention_status,


        -- ----------------------------------------------------
        -- Current hazard
        -- ----------------------------------------------------

        dominant_event,

        hazard_score,

        hazard_level,

        active_alerts,

        severe_or_extreme_alerts,


        -- ----------------------------------------------------
        -- Useful operational flags
        -- ----------------------------------------------------

        severe_or_extreme_alerts > 0
            as has_severe_or_extreme_alert,

        operational_priority_level in ('CRITICAL', 'HIGH')
            as is_high_priority,

        national_operational_rank <= 10
            as is_top_10,

        national_operational_rank <= 25
            as is_top_25,


        -- ----------------------------------------------------
        -- Community context
        -- ----------------------------------------------------

        exposure_score,

        vulnerability_score_model,

        history_score,

        context_score,

        dominant_context_driver,


        -- ----------------------------------------------------
        -- Explainability
        -- ----------------------------------------------------

        dominant_risk_driver,

        hazard_contribution,

        exposure_contribution,

        vulnerability_contribution,

        history_contribution,

        hazard_share_pct,

        exposure_share_pct,

        vulnerability_share_pct,

        history_share_pct,


        -- ----------------------------------------------------
        -- Historical disaster context
        -- ----------------------------------------------------

        fema_declarations_total,

        fema_declarations_10y,

        major_disasters_10y,

        emergencies_10y,

        fire_management_10y,

        incident_types_10y,


        -- ----------------------------------------------------
        -- Human-readable risk explanation
        --
        -- Intended for a queue preview / tooltip.
        -- Detailed explanation remains available through
        -- component contribution fields.
        -- ----------------------------------------------------

        concat(
            dominant_event,
            ' is the current operational hazard; ',
            dominant_context_driver,
            ' is the strongest community context amplifier.'
        ) as priority_explanation,


        -- ----------------------------------------------------
        -- Queue generation timestamp
        -- ----------------------------------------------------

        current_timestamp() as queue_generated_at

    from county_priority

),


-- ============================================================
-- Final output
-- ============================================================

final as (

    select *

    from queue_enriched

)


select *
from final