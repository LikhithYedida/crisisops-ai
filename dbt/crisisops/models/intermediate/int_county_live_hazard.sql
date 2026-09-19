{{ config(
    materialized='table'
) }}


-- ============================================================
-- CRISISOPS
-- County-Level Live Hazard Features
--
-- Grain:
-- One row per currently affected U.S. county.
--
-- Purpose:
-- Converts active NWS alert/county relationships into a
-- transparent operational hazard score.
-- ============================================================


with alerts as (

    select

        alert_id,
        county_fips,
        state,
        county_name,

        event,
        severity,
        certainty,
        urgency,
        status,

        headline,

        matched_zone_count,

        representative_latitude,
        representative_longitude,

        safe_cast(effective_at as timestamp) as effective_at,
        safe_cast(onset_at as timestamp) as onset_at,
        safe_cast(expires_at as timestamp) as expires_at,
        safe_cast(ends_at as timestamp) as ends_at

    from {{ ref('int_alert_counties') }}

),


-- ============================================================
-- 1. Translate NWS classifications into numeric risk features
-- ============================================================

scored_alerts as (

    select

        *,

        case
            when upper(severity) = 'EXTREME' then 100
            when upper(severity) = 'SEVERE' then 85
            when upper(severity) = 'MODERATE' then 60
            when upper(severity) = 'MINOR' then 35
            else 20
        end as severity_score,


        case
            when upper(urgency) = 'IMMEDIATE' then 100
            when upper(urgency) = 'EXPECTED' then 80
            when upper(urgency) = 'FUTURE' then 50
            when upper(urgency) = 'PAST' then 10
            else 30
        end as urgency_score,


        case
            when upper(certainty) = 'OBSERVED' then 100
            when upper(certainty) = 'LIKELY' then 80
            when upper(certainty) = 'POSSIBLE' then 55
            when upper(certainty) = 'UNLIKELY' then 25
            else 40
        end as certainty_score

    from alerts

),


-- ============================================================
-- 2. Build alert-level operational hazard score
--
-- Severity  = 60%
-- Urgency   = 25%
-- Certainty = 15%
--
-- Severity intentionally receives the highest weight because
-- CrisisOps is designed for operational prioritization.
-- ============================================================

alert_risk as (

    select

        *,

        round(
            (
                severity_score * 0.60
                +
                urgency_score * 0.25
                +
                certainty_score * 0.15
            ),
            2
        ) as alert_hazard_score

    from scored_alerts

),


-- ============================================================
-- 3. Aggregate current hazard conditions by county
-- ============================================================

county_aggregation as (

    select

        county_fips,

        any_value(state) as state,
        any_value(county_name) as county_name,

        any_value(
            representative_latitude
        ) as representative_latitude,

        any_value(
            representative_longitude
        ) as representative_longitude,


        count(
            distinct alert_id
        ) as active_alerts,


        countif(
            upper(severity) in (
                'SEVERE',
                'EXTREME'
            )
        ) as severe_or_extreme_alerts,


        countif(
            upper(urgency) = 'IMMEDIATE'
        ) as immediate_alerts,


        countif(
            upper(certainty) = 'OBSERVED'
        ) as observed_alerts,


        max(
            alert_hazard_score
        ) as maximum_alert_hazard_score,


        avg(
            alert_hazard_score
        ) as average_alert_hazard_score,


        max(
            severity_score
        ) as maximum_severity_score,


        max(
            urgency_score
        ) as maximum_urgency_score,


        max(
            certainty_score
        ) as maximum_certainty_score,


        min(
            effective_at
        ) as earliest_alert_effective_at,


        max(
            expires_at
        ) as latest_alert_expiration_at

    from alert_risk

    group by county_fips

),


-- ============================================================
-- 4. Identify dominant/currently most important alert
-- ============================================================

dominant_alert as (

    select

        county_fips,

        dominant.event as dominant_event,
        dominant.severity as dominant_severity,
        dominant.urgency as dominant_urgency,
        dominant.certainty as dominant_certainty,
        dominant.headline as dominant_headline,
        dominant.alert_id as dominant_alert_id,
        dominant.alert_hazard_score as dominant_alert_score

    from (

        select

            county_fips,

            array_agg(

                struct(
                    alert_id,
                    event,
                    severity,
                    urgency,
                    certainty,
                    headline,
                    alert_hazard_score
                )

                order by
                    alert_hazard_score desc,
                    effective_at desc

                limit 1

            )[offset(0)] as dominant

        from alert_risk

        group by county_fips

    )

),


-- ============================================================
-- 5. Add alert-volume pressure
--
-- Multiple simultaneous alerts increase operational complexity.
-- The adjustment is deliberately capped so alert volume cannot
-- overwhelm actual severity.
-- ============================================================

county_scores as (

    select

        c.*,

        d.dominant_event,
        d.dominant_severity,
        d.dominant_urgency,
        d.dominant_certainty,
        d.dominant_headline,
        d.dominant_alert_id,
        d.dominant_alert_score,


        least(
            10.0,
            greatest(
                0.0,
                (c.active_alerts - 1) * 2.5
            )
        ) as alert_volume_adjustment,


        least(
            100.0,

            c.maximum_alert_hazard_score

            +

            least(
                10.0,
                greatest(
                    0.0,
                    (c.active_alerts - 1) * 2.5
                )
            )

        ) as raw_hazard_score

    from county_aggregation c

    left join dominant_alert d
        using (county_fips)

),


-- ============================================================
-- 6. Final county hazard classification
-- ============================================================

final as (

    select

        county_fips,
        state,
        county_name,

        representative_latitude,
        representative_longitude,

        active_alerts,
        severe_or_extreme_alerts,
        immediate_alerts,
        observed_alerts,

        round(
            maximum_alert_hazard_score,
            2
        ) as maximum_alert_hazard_score,

        round(
            average_alert_hazard_score,
            2
        ) as average_alert_hazard_score,

        round(
            alert_volume_adjustment,
            2
        ) as alert_volume_adjustment,

        round(
            raw_hazard_score,
            2
        ) as hazard_score,


        case

            when (
                raw_hazard_score >= 85
                and severe_or_extreme_alerts > 0
            )
                then 'EXTREME'

            when raw_hazard_score >= 70
                then 'SEVERE'

            when raw_hazard_score >= 50
                then 'MODERATE'

            when raw_hazard_score >= 30
                then 'MINOR'

            else 'LOW'

        end as hazard_level,


        dominant_event,
        dominant_severity,
        dominant_urgency,
        dominant_certainty,
        dominant_headline,
        dominant_alert_id,
        dominant_alert_score,

        maximum_severity_score,
        maximum_urgency_score,
        maximum_certainty_score,

        earliest_alert_effective_at,
        latest_alert_expiration_at

    from county_scores

)


select *
from final