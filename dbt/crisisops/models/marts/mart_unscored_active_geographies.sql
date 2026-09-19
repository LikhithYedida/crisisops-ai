{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- Mart: Unscored Active Geographies
--
-- Grain:
-- One row per active county/county-equivalent that cannot
-- receive a complete operational priority score.
--
-- Purpose:
-- Preserve active NWS-affected geographies that are missing
-- Census / CDC / FEMA contextual information instead of
-- silently dropping them from the operational mart.
--
-- Example:
-- Chuuk Lagoon, FM can have an active NWS alert but may not
-- exist in the county-context dataset used for scoring.
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

),


county_context as (

    select

        county_fips,
        county_full_name,

        population,
        exposure_score,
        vulnerability_score_model,
        history_score,
        context_score

    from {{ ref('int_county_context') }}

),


joined as (

    select

        h.county_fips,
        h.state,
        h.county_name,

        h.active_alerts,
        h.severe_or_extreme_alerts,

        h.hazard_score,
        h.hazard_level,
        h.dominant_event,

        c.county_full_name,

        c.population,
        c.exposure_score,
        c.vulnerability_score_model,
        c.history_score,
        c.context_score,

        case
            when c.county_fips is null
                then 'NO_COUNTY_CONTEXT'

            when c.population is null
                then 'MISSING_POPULATION'

            when c.exposure_score is null
                then 'MISSING_EXPOSURE_SCORE'

            when c.vulnerability_score_model is null
                then 'MISSING_VULNERABILITY_SCORE'

            when c.history_score is null
                then 'MISSING_HISTORY_SCORE'

            when c.context_score is null
                then 'MISSING_CONTEXT_SCORE'

            else null
        end as reason_code

    from live_hazard h

    left join county_context c

        on h.county_fips = c.county_fips

),


exceptions as (

    select

        county_fips,

        state,
        county_name,

        county_full_name,

        active_alerts,
        severe_or_extreme_alerts,

        hazard_score,
        hazard_level,
        dominant_event,

        population,
        exposure_score,
        vulnerability_score_model,
        history_score,
        context_score,

        reason_code,

        true as scoring_blocked,

        current_timestamp() as exception_detected_at

    from joined

    where
        reason_code is not null

)


select
    *
from exceptions