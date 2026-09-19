{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- County Operational Priority Mart
--
-- Grain:
-- One row per active, context-supported U.S. county
--
-- Purpose:
-- Combine:
--   1. Current NWS live hazard
--   2. Population exposure
--   3. Social vulnerability
--   4. FEMA historical disaster burden
--
-- Important:
-- Live NWS geographies that do not have valid U.S. county
-- context are intentionally excluded from this scored mart.
--
-- Example:
-- FM / Chuuk Lagoon can appear in NWS alerts, but does not
-- have the Census + CDC + FEMA county context required by
-- this U.S. county scoring model.
-- ============================================================


with live_hazard as (

    select

        county_fips,

        state,

        county_name,

        active_alerts,

        severe_or_extreme_alerts,

        hazard_score,

        hazard_level,

        dominant_event

    from {{ ref('int_county_live_hazard') }}

    where county_fips is not null

),


-- ============================================================
-- County analytical context
-- ============================================================

county_context as (

    select

        county_fips,

        county_full_name,

        population,

        exposure_score,

        vulnerability_score_model,

        history_score,

        context_score,

        fema_declarations_total,

        fema_declarations_10y,

        major_disasters_10y,

        emergencies_10y,

        fire_management_10y,

        incident_types_10y

    from {{ ref('int_county_context') }}

    where county_fips is not null

),


-- ============================================================
-- Join current hazard to county context
--
-- IMPORTANT:
-- INNER JOIN is intentional.
--
-- Only live-alert counties with complete U.S. county context
-- are eligible for the operational prioritization model.
-- ============================================================

eligible_counties as (

    select

        h.county_fips,

        h.state,

        h.county_name,

        c.county_full_name,

        c.population,

        h.active_alerts,

        h.severe_or_extreme_alerts,

        h.hazard_score,

        h.hazard_level,

        h.dominant_event,

        c.exposure_score,

        c.vulnerability_score_model,

        c.history_score,

        c.context_score,

        c.fema_declarations_total,

        c.fema_declarations_10y,

        c.major_disasters_10y,

        c.emergencies_10y,

        c.fire_management_10y,

        c.incident_types_10y

    from live_hazard h

    inner join county_context c
        on h.county_fips = c.county_fips

),


-- ============================================================
-- Weighted scoring components
--
-- Operational model:
--
-- Current Hazard          55%
-- Population Exposure     15%
-- Social Vulnerability    15%
-- Historical Burden       15%
--
-- Total                  100%
-- ============================================================

weighted_components as (

    select

        *,

        round(
            hazard_score * 0.55,
            4
        ) as hazard_contribution,

        round(
            exposure_score * 0.15,
            4
        ) as exposure_contribution,

        round(
            vulnerability_score_model * 0.15,
            4
        ) as vulnerability_contribution,

        round(
            history_score * 0.15,
            4
        ) as history_contribution

    from eligible_counties

),


-- ============================================================
-- Operational priority score
-- ============================================================

scored as (

    select

        *,

        round(
            hazard_contribution
            +
            exposure_contribution
            +
            vulnerability_contribution
            +
            history_contribution,
            2
        ) as operational_priority_score

    from weighted_components

),


-- ============================================================
-- Dominant risk driver
-- ============================================================

-- ============================================================
-- Explainability drivers
--
-- dominant_risk_driver:
-- Largest weighted contributor to the final operational score.
--
-- dominant_context_driver:
-- Strongest non-hazard factor amplifying operational risk.
-- ============================================================

with_driver as (

    select

        *,

        case

            when hazard_contribution
                >= exposure_contribution

             and hazard_contribution
                >= vulnerability_contribution

             and hazard_contribution
                >= history_contribution

                then 'Current Hazard'


            when exposure_contribution
                >= vulnerability_contribution

             and exposure_contribution
                >= history_contribution

                then 'Population Exposure'


            when vulnerability_contribution
                >= history_contribution

                then 'Social Vulnerability'


            else
                'Historical Disaster Burden'

        end as dominant_risk_driver,


        case

            when exposure_contribution
                >= vulnerability_contribution

             and exposure_contribution
                >= history_contribution

                then 'Population Exposure'

            when vulnerability_contribution
                >= history_contribution

                then 'Social Vulnerability'

            else
                'Historical Disaster Burden'

        end as dominant_context_driver,


        round(
            safe_divide(
                hazard_contribution,
                operational_priority_score
            ) * 100,
            2
        ) as hazard_share_pct,

        round(
            safe_divide(
                exposure_contribution,
                operational_priority_score
            ) * 100,
            2
        ) as exposure_share_pct,

        round(
            safe_divide(
                vulnerability_contribution,
                operational_priority_score
            ) * 100,
            2
        ) as vulnerability_share_pct,

        round(
            safe_divide(
                history_contribution,
                operational_priority_score
            ) * 100,
            2
        ) as history_share_pct

    from scored

),

-- ============================================================
-- Operational priority classification
--
-- CRITICAL requires:
--   score >= 80
--   AND at least one Severe/Extreme live alert
--
-- This prevents high community vulnerability alone from
-- producing a CRITICAL operational classification.
-- ============================================================

classified as (

    select

        *,

        case

            when operational_priority_score >= 80
                 and severe_or_extreme_alerts > 0
                then 'CRITICAL'

            when operational_priority_score >= 70
                then 'HIGH'

            when operational_priority_score >= 55
                then 'ELEVATED'

            when operational_priority_score >= 40
                then 'MODERATE'

            else 'LOW'

        end as operational_priority_level

    from with_driver

),


-- ============================================================
-- National operational rank
-- ============================================================

ranked as (

    select

        *,

        dense_rank() over (

            order by

                operational_priority_score desc,

                hazard_score desc,

                severe_or_extreme_alerts desc,

                active_alerts desc,

                county_fips

        ) as national_operational_rank

    from classified

),


-- ============================================================
-- Final output
-- ============================================================

final as (

    select

        county_fips,

        state,

        county_name,

        county_full_name,

        population,

        active_alerts,

        severe_or_extreme_alerts,

        dominant_event,

        hazard_score,

        hazard_level,

        exposure_score,

        vulnerability_score_model,

        history_score,

        context_score,

        operational_priority_score,

        operational_priority_level,

        national_operational_rank,

        dominant_risk_driver,
        
        dominant_context_driver,

        hazard_share_pct,

        exposure_share_pct,

        vulnerability_share_pct,

        history_share_pct,

        hazard_contribution,

        exposure_contribution,

        vulnerability_contribution,

        history_contribution,

        fema_declarations_total,

        fema_declarations_10y,

        major_disasters_10y,

        emergencies_10y,

        fire_management_10y,

        incident_types_10y

    from ranked

)


select *
from final