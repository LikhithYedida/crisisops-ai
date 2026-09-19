{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- National Situation Mart
--
-- Grain:
-- One row representing the current national operating picture
--
-- Purpose:
-- Supply national-level operational KPIs for the CrisisOps
-- National Situation interface.
--
-- Important metric distinction:
--
-- unique_active_nws_alerts
--     Unique actual NWS alert IDs currently in the live feed.
--
-- county_alert_impacts
--     Sum of alert occurrences across scored counties.
--     One NWS alert affecting multiple counties contributes
--     multiple county-level impacts.
-- ============================================================


-- ============================================================
-- County operational priority
-- ============================================================

with county_priority as (

    select *

    from {{ ref('mart_county_operational_priority') }}

),


-- ============================================================
-- Alert-level NWS data
--
-- stg_nws_alerts is one row per NWS alert.
-- is_actual_alert excludes test/exercise/non-operational alerts.
-- ============================================================

nws_alerts as (

    select

        alert_id,

        event,

        severity,

        is_actual_alert

    from {{ ref('stg_nws_alerts') }}

    where alert_id is not null

),


-- ============================================================
-- Unique NWS alert metrics
-- ============================================================

alert_metrics as (

    select

        count(
            distinct case
                when is_actual_alert
                then alert_id
            end
        ) as unique_active_nws_alerts,

        count(
            distinct case
                when is_actual_alert
                     and upper(severity) in ('SEVERE', 'EXTREME')
                then alert_id
            end
        ) as unique_severe_or_extreme_nws_alerts

    from nws_alerts

),


-- ============================================================
-- Core national county-level operating metrics
-- ============================================================

national_metrics as (

    select

        count(*) as active_scored_counties,

        count(distinct state) as affected_states,

        -- Geographic alert footprint.
        -- These are NOT unique NWS alerts.
        sum(active_alerts) as county_alert_impacts,

        sum(
            severe_or_extreme_alerts
        ) as severe_or_extreme_county_alert_impacts,

        sum(population) as population_exposed,

        countif(
            operational_priority_level = 'CRITICAL'
        ) as critical_counties,

        countif(
            operational_priority_level = 'HIGH'
        ) as high_priority_counties,

        countif(
            operational_priority_level = 'ELEVATED'
        ) as elevated_priority_counties,

        countif(
            operational_priority_level = 'MODERATE'
        ) as moderate_priority_counties,

        countif(
            operational_priority_level = 'LOW'
        ) as low_priority_counties,

        countif(
            operational_priority_level in ('CRITICAL', 'HIGH')
        ) as critical_or_high_counties,

        round(
            avg(operational_priority_score),
            2
        ) as avg_operational_priority_score,

        round(
            max(operational_priority_score),
            2
        ) as highest_operational_priority_score,

        round(
            avg(hazard_score),
            2
        ) as avg_hazard_score

    from county_priority

),


-- ============================================================
-- Highest-priority county
-- ============================================================

top_county as (

    select

        county_fips as top_county_fips,

        county_full_name as top_county_name,

        state as top_county_state,

        dominant_event as top_county_event,

        operational_priority_score
            as top_county_priority_score,

        operational_priority_level
            as top_county_priority_level,

        dominant_context_driver
            as top_county_context_driver,

        national_operational_rank
            as top_county_national_rank

    from county_priority

    order by

        national_operational_rank,

        county_fips

    limit 1

),


-- ============================================================
-- County-level hazard distribution
--
-- A county is assigned its dominant active hazard.
-- ============================================================

hazard_distribution as (

    select

        dominant_event,

        count(*) as affected_counties,

        sum(population) as affected_population,

        sum(active_alerts) as county_alert_impacts

    from county_priority

    where dominant_event is not null

    group by dominant_event

),


-- ============================================================
-- Leading operational hazard
--
-- Defined as the dominant hazard affecting the greatest
-- number of scored counties.
-- ============================================================

leading_hazard as (

    select

        dominant_event as leading_hazard,

        affected_counties
            as leading_hazard_counties,

        affected_population
            as leading_hazard_population,

        county_alert_impacts
            as leading_hazard_county_alert_impacts

    from hazard_distribution

    order by

        affected_counties desc,

        affected_population desc,

        dominant_event

    limit 1

),


-- ============================================================
-- State-level operational distribution
-- ============================================================

state_distribution as (

    select

        state,

        count(*) as active_counties,

        sum(population) as population_exposed,

        sum(active_alerts) as county_alert_impacts,

        countif(
            operational_priority_level in ('CRITICAL', 'HIGH')
        ) as critical_or_high_counties

    from county_priority

    group by state

),


-- ============================================================
-- Most affected state
--
-- Ranked primarily by active scored counties, then exposed
-- population.
-- ============================================================

top_state as (

    select

        state
            as most_affected_state,

        active_counties
            as most_affected_state_counties,

        population_exposed
            as most_affected_state_population,

        county_alert_impacts
            as most_affected_state_county_alert_impacts,

        critical_or_high_counties
            as most_affected_state_critical_or_high_counties

    from state_distribution

    order by

        active_counties desc,

        population_exposed desc,

        state

    limit 1

),


-- ============================================================
-- Context-amplifier distribution
-- ============================================================

context_driver_summary as (

    select

        countif(
            dominant_context_driver = 'Population Exposure'
        ) as exposure_driven_counties,

        countif(
            dominant_context_driver = 'Social Vulnerability'
        ) as vulnerability_driven_counties,

        countif(
            dominant_context_driver =
                'Historical Disaster Burden'
        ) as history_driven_counties

    from county_priority

),


-- ============================================================
-- Final national operating picture
-- ============================================================

final as (

    select

        current_timestamp()
            as situation_generated_at,


        -- ----------------------------------------------------
        -- Alert-level KPIs
        -- ----------------------------------------------------

        a.unique_active_nws_alerts,

        a.unique_severe_or_extreme_nws_alerts,


        -- ----------------------------------------------------
        -- Geographic operating footprint
        -- ----------------------------------------------------

        n.active_scored_counties,

        n.affected_states,

        n.county_alert_impacts,

        n.severe_or_extreme_county_alert_impacts,

        n.population_exposed,


        -- ----------------------------------------------------
        -- Priority distribution
        -- ----------------------------------------------------

        n.critical_counties,

        n.high_priority_counties,

        n.elevated_priority_counties,

        n.moderate_priority_counties,

        n.low_priority_counties,

        n.critical_or_high_counties,


        -- ----------------------------------------------------
        -- National score summary
        -- ----------------------------------------------------

        n.avg_operational_priority_score,

        n.highest_operational_priority_score,

        n.avg_hazard_score,


        -- ----------------------------------------------------
        -- Highest-priority county
        -- ----------------------------------------------------

        tc.top_county_fips,

        tc.top_county_name,

        tc.top_county_state,

        tc.top_county_event,

        tc.top_county_priority_score,

        tc.top_county_priority_level,

        tc.top_county_context_driver,

        tc.top_county_national_rank,


        -- ----------------------------------------------------
        -- Leading hazard
        -- ----------------------------------------------------

        lh.leading_hazard,

        lh.leading_hazard_counties,

        lh.leading_hazard_population,

        lh.leading_hazard_county_alert_impacts,


        -- ----------------------------------------------------
        -- State operating picture
        -- ----------------------------------------------------

        ts.most_affected_state,

        ts.most_affected_state_counties,

        ts.most_affected_state_population,

        ts.most_affected_state_county_alert_impacts,

        ts.most_affected_state_critical_or_high_counties,


        -- ----------------------------------------------------
        -- Context amplifiers
        -- ----------------------------------------------------

        cd.exposure_driven_counties,

        cd.vulnerability_driven_counties,

        cd.history_driven_counties

    from national_metrics n

    cross join alert_metrics a

    cross join top_county tc

    cross join leading_hazard lh

    cross join top_state ts

    cross join context_driver_summary cd

)


select *
from final