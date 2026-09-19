{{ config(
    materialized='table'
) }}


with alert_zones as (

    select
        alert_id,
        zone_id,
        zone_type

    from {{ ref('stg_alert_zones') }}

    where lower(zone_type) = 'forecast'

),


normalized_alert_zones as (

    select
        alert_id,
        zone_id,
        zone_type,

        /*
        NWS forecast zones look like:

        AKZ846
        KSZ009
        OKZ043

        Our forecast-zone/county crosswalk uses:

        AK846
        KS009
        OK043

        Therefore remove the third character (Z).
        */

        concat(
            substr(zone_id, 1, 2),
            substr(zone_id, 4)
        ) as normalized_zone_id

    from alert_zones

),


zone_county_map as (

    select
        zone_county_key,
        state_zone,
        county_fips,
        state,
        zone_name,
        county_name,
        representative_latitude,
        representative_longitude

    from {{ ref('int_zone_county_map') }}

),


matched_zones as (

    select
        az.alert_id,
        az.zone_id,
        az.normalized_zone_id,

        zcm.state_zone,
        zcm.county_fips,
        zcm.state,
        zcm.county_name,
        zcm.zone_name,
        zcm.representative_latitude,
        zcm.representative_longitude

    from normalized_alert_zones az

    inner join zone_county_map zcm
        on az.normalized_zone_id = zcm.state_zone

),


alert_details as (

    select
        alert_id,
        event,
        severity,
        certainty,
        urgency,
        status,
        headline,
        effective_at,
        onset_at,
        expires_at,
        ends_at

    from {{ ref('stg_nws_alerts') }}

),


aggregated as (

    select

        mz.alert_id,
        mz.county_fips,

        any_value(mz.state) as state,
        any_value(mz.county_name) as county_name,

        count(
            distinct mz.zone_id
        ) as matched_zone_count,

        string_agg(
            distinct mz.zone_id,
            ', '
            order by mz.zone_id
        ) as matched_zone_ids,

        any_value(
            mz.representative_latitude
        ) as representative_latitude,

        any_value(
            mz.representative_longitude
        ) as representative_longitude

    from matched_zones mz

    group by
        mz.alert_id,
        mz.county_fips

),


final as (

    select

        concat(
            a.alert_id,
            '|',
            a.county_fips
        ) as alert_county_key,

        a.alert_id,

        d.event,
        d.severity,
        d.certainty,
        d.urgency,
        d.status,

        a.state,
        a.county_name,
        a.county_fips,

        a.matched_zone_count,
        a.matched_zone_ids,

        a.representative_latitude,
        a.representative_longitude,

        d.headline,

        d.effective_at,
        d.onset_at,
        d.expires_at,
        d.ends_at

    from aggregated a

    inner join alert_details d
        on a.alert_id = d.alert_id

)


select *
from final