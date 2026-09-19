{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- County Intelligence Serving Mart
--
-- Grain:
-- One row per scored, currently affected U.S. county
--
-- Purpose:
-- Provide the drill-down intelligence layer behind a selected
-- county in the CrisisOps interface.
--
-- Important:
-- This model does NOT recalculate operational priority.
-- It consumes the validated Priority Queue and National
-- Situation marts and adds comparison / explanation fields.
-- ============================================================


with priority_queue as (

    select *

    from {{ ref('mart_priority_queue') }}

),


national_situation as (

    select

        active_scored_counties,

        avg_operational_priority_score,

        highest_operational_priority_score

    from {{ ref('mart_national_situation') }}

),


-- ============================================================
-- County intelligence enrichment
-- ============================================================

county_enriched as (

    select

        -- ----------------------------------------------------
        -- Identity
        -- ----------------------------------------------------

        q.county_fips,

        q.county_full_name,

        q.county_name,

        q.state,

        q.population,


        -- ----------------------------------------------------
        -- Operational standing
        -- ----------------------------------------------------

        q.national_operational_rank,

        n.active_scored_counties
            as national_active_scored_counties,

        q.operational_priority_score,

        q.operational_priority_level,

        q.attention_status,

        q.priority_sort_order,


        -- ----------------------------------------------------
        -- National comparison
        -- ----------------------------------------------------

        n.avg_operational_priority_score
            as national_avg_priority_score,

        n.highest_operational_priority_score
            as national_highest_priority_score,

        round(
            q.operational_priority_score
            - n.avg_operational_priority_score,
            2
        ) as priority_score_vs_national_avg,

        round(
            safe_divide(
                q.national_operational_rank,
                n.active_scored_counties
            ) * 100,
            2
        ) as national_rank_position_pct,


        -- ----------------------------------------------------
        -- Current hazard intelligence
        -- ----------------------------------------------------

        q.dominant_event,

        q.hazard_score,

        q.hazard_level,

        q.active_alerts,

        q.severe_or_extreme_alerts,

        q.has_severe_or_extreme_alert,


        -- ----------------------------------------------------
        -- Community context
        -- ----------------------------------------------------

        q.exposure_score,

        q.vulnerability_score_model,

        q.history_score,

        q.context_score,

        q.dominant_context_driver,

        q.dominant_risk_driver,


        -- ----------------------------------------------------
        -- Explainability - weighted contribution points
        -- ----------------------------------------------------

        q.hazard_contribution,

        q.exposure_contribution,

        q.vulnerability_contribution,

        q.history_contribution,


        -- ----------------------------------------------------
        -- Explainability - share of final score
        -- ----------------------------------------------------

        q.hazard_share_pct,

        q.exposure_share_pct,

        q.vulnerability_share_pct,

        q.history_share_pct,


        -- ----------------------------------------------------
        -- FEMA historical context
        -- ----------------------------------------------------

        q.fema_declarations_total,

        q.fema_declarations_10y,

        q.major_disasters_10y,

        q.emergencies_10y,

        q.fire_management_10y,

        q.incident_types_10y,


        -- ----------------------------------------------------
        -- Operational flags
        -- ----------------------------------------------------

        q.is_high_priority,

        q.is_top_10,

        q.is_top_25,


        -- ----------------------------------------------------
        -- Primary explanation
        -- ----------------------------------------------------

        q.priority_explanation,


        -- ----------------------------------------------------
        -- Hazard explanation
        -- ----------------------------------------------------

                concat(
            q.dominant_event,
            ' is the current dominant hazard for this county with a hazard score of ',
            cast(round(q.hazard_score, 2) as string),
            ' and a ',
            q.hazard_level,
            ' hazard classification.'
        ) as hazard_explanation,

                concat(
            q.dominant_context_driver,
            ' is the strongest non-hazard amplifier, contributing ',
            cast(
                round(
                    case

                        when q.dominant_context_driver =
                            'Population Exposure'
                            then q.exposure_share_pct

                        when q.dominant_context_driver =
                            'Social Vulnerability'
                            then q.vulnerability_share_pct

                        when q.dominant_context_driver =
                            'Historical Disaster Burden'
                            then q.history_share_pct

                        else null

                    end,
                    2
                ) as string
            ),
            '% of the operational priority score.'
        ) as context_explanation,


        -- ----------------------------------------------------
        -- National-rank explanation
        -- ----------------------------------------------------

        concat(
            q.county_full_name,
            ' is ranked #',
            cast(q.national_operational_rank as string),
            ' of ',
            cast(n.active_scored_counties as string),
            ' currently scored counties nationwide.'
        ) as rank_explanation,


        -- ----------------------------------------------------
        -- Historical context explanation
        -- ----------------------------------------------------

        concat(
            'FEMA history includes ',
            cast(q.fema_declarations_10y as string),
            ' declarations in the last 10 years, including ',
            cast(q.major_disasters_10y as string),
            ' Major Disaster declarations and ',
            cast(q.emergencies_10y as string),
            ' Emergency declarations.'
        ) as history_explanation,


        -- ----------------------------------------------------
        -- Response posture
        --
        -- UI-oriented interpretation only.
        -- Does not modify analytical priority.
        -- ----------------------------------------------------

        case

            when q.attention_status = 'IMMEDIATE'
                then 'Immediate operational review recommended'

            when q.attention_status = 'PRIORITY'
                then 'Prioritize for operational review'

            when q.attention_status = 'MONITOR'
                then 'Maintain active monitoring'

            else
                'Maintain situational awareness'

        end as response_posture,


        -- ----------------------------------------------------
        -- County intelligence snapshot timestamp
        -- ----------------------------------------------------

        current_timestamp()
            as intelligence_generated_at

    from priority_queue q

    cross join national_situation n

),


-- ============================================================
-- Final output
-- ============================================================

final as (

    select *

    from county_enriched

)


select *
from final