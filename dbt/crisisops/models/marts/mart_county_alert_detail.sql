{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- County Alert Detail Serving Mart
--
-- Grain:
-- One row per active NWS alert + scored county combination
--
-- Purpose:
-- Provide the alert-level child dataset behind County
-- Intelligence.
--
-- Architecture:
--
-- stg_nws_alerts
--        +
-- int_alert_counties
--        +
-- mart_county_intelligence
--        ↓
-- mart_county_alert_detail
--
-- Important:
-- Geographic alert-to-county resolution is intentionally
-- inherited from int_alert_counties. This mart does not
-- duplicate NWS zone-to-county mapping logic.
-- ============================================================


with alert_counties as (

    select

        alert_county_key,

        alert_id,

        event,

        severity,

        certainty,

        urgency,

        status,

        state,

        county_name,

        county_fips,

        matched_zone_count,

        matched_zone_ids,

        representative_latitude,

        representative_longitude,

        headline,

        effective_at,

        onset_at,

        expires_at,

        ends_at

    from {{ ref('int_alert_counties') }}

    where county_fips is not null

),


-- ============================================================
-- Full NWS alert detail
-- ============================================================

nws_alerts as (

    select

        alert_id,

        event,

        severity,

        certainty,

        urgency,

        status,

        message_type,

        category,

        sender,

        sender_name,

        area_description,

        headline,

        description,

        instruction,

        response,

        sent_at,

        effective_at,

        onset_at,

        expires_at,

        ends_at,

        geometry_type,

        affected_zone_count,

        is_actual_alert,

        has_geometry

    from {{ ref('stg_nws_alerts') }}

    where alert_id is not null

      and is_actual_alert = true

),


-- ============================================================
-- Current scored county intelligence
--
-- Restricts this product-facing alert mart to counties that
-- are currently included in the validated operational model.
-- ============================================================

county_intelligence as (

    select

        county_fips,

        county_full_name,

        population,

        national_operational_rank,

        operational_priority_score,

        operational_priority_level,

        attention_status,

        dominant_context_driver,

        response_posture

    from {{ ref('mart_county_intelligence') }}

),


-- ============================================================
-- Combine resolved county-alert relationships with full
-- alert content
-- ============================================================

alert_detail as (

    select

        ac.alert_county_key,

        ac.alert_id,

        ac.county_fips,

        ci.county_full_name,

        ac.county_name,

        ac.state,

        ci.population,


        -- ----------------------------------------------------
        -- County operational context
        -- ----------------------------------------------------

        ci.national_operational_rank,

        ci.operational_priority_score,

        ci.operational_priority_level,

        ci.attention_status,

        ci.dominant_context_driver,

        ci.response_posture,


        -- ----------------------------------------------------
        -- Alert identity and classification
        -- ----------------------------------------------------

        coalesce(
            a.event,
            ac.event
        ) as event,

        coalesce(
            a.severity,
            ac.severity
        ) as severity,

        coalesce(
            a.certainty,
            ac.certainty
        ) as certainty,

        coalesce(
            a.urgency,
            ac.urgency
        ) as urgency,

        coalesce(
            a.status,
            ac.status
        ) as status,

        a.message_type,

        a.category,

        a.response,


        -- ----------------------------------------------------
        -- Public-facing alert content
        -- ----------------------------------------------------

        coalesce(
            a.headline,
            ac.headline
        ) as headline,

        a.description,

        a.instruction,

        a.area_description,


        -- ----------------------------------------------------
        -- NWS source metadata
        -- ----------------------------------------------------

        a.sender,

        a.sender_name,

        a.sent_at,


        -- ----------------------------------------------------
        -- Alert timing
        -- ----------------------------------------------------

        coalesce(
            a.effective_at,
            ac.effective_at
        ) as effective_at,

        coalesce(
            a.onset_at,
            ac.onset_at
        ) as onset_at,

        coalesce(
            a.expires_at,
            ac.expires_at
        ) as expires_at,

        coalesce(
            a.ends_at,
            ac.ends_at
        ) as ends_at,


        -- ----------------------------------------------------
        -- Alert geography / mapping traceability
        -- ----------------------------------------------------

        ac.matched_zone_count,

        ac.matched_zone_ids,

        ac.representative_latitude,

        ac.representative_longitude,

        a.geometry_type,

        a.affected_zone_count,

        a.has_geometry,


        -- ----------------------------------------------------
        -- Operational alert flags
        -- ----------------------------------------------------

        upper(
            coalesce(
                a.severity,
                ac.severity,
                ''
            )
        ) in ('SEVERE', 'EXTREME')
            as is_severe_or_extreme,

        case

            when upper(
                coalesce(
                    a.severity,
                    ac.severity,
                    ''
                )
            ) = 'EXTREME'
                then 1

            when upper(
                coalesce(
                    a.severity,
                    ac.severity,
                    ''
                )
            ) = 'SEVERE'
                then 2

            when upper(
                coalesce(
                    a.severity,
                    ac.severity,
                    ''
                )
            ) = 'MODERATE'
                then 3

            when upper(
                coalesce(
                    a.severity,
                    ac.severity,
                    ''
                )
            ) = 'MINOR'
                then 4

            else 5

        end as alert_severity_sort_order,


        -- ----------------------------------------------------
        -- Human-readable alert summary
        -- ----------------------------------------------------

        concat(
            coalesce(
                a.event,
                ac.event,
                'Weather Alert'
            ),
            ' affecting ',
            ci.county_full_name,
            '. Severity: ',
            coalesce(
                a.severity,
                ac.severity,
                'Unknown'
            ),
            '. Urgency: ',
            coalesce(
                a.urgency,
                ac.urgency,
                'Unknown'
            ),
            '.'
        ) as alert_summary,


        current_timestamp()
            as alert_detail_generated_at

    from alert_counties ac

    inner join nws_alerts a
        on ac.alert_id = a.alert_id

    inner join county_intelligence ci
        on ac.county_fips = ci.county_fips

),


-- ============================================================
-- Final output
-- ============================================================

final as (

    select *

    from alert_detail

)


select *
from final