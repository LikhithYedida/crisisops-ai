{{ config(
    materialized='table'
) }}

with crosswalk as (

    select *
    from {{ ref('stg_zone_county_crosswalk') }}

),

relationship_grain as (

    select

        state_zone,
        county_fips,

        any_value(state) as state,
        any_value(zone) as zone,
        any_value(cwa) as cwa,
        any_value(zone_name) as zone_name,
        any_value(county_name) as county_name,

        count(*) as source_record_count,

        count(distinct time_zone) as time_zone_variants,
        count(distinct feature_area) as feature_area_variants,

        avg(latitude) as representative_latitude,
        avg(longitude) as representative_longitude

    from crosswalk

    where state_zone is not null
      and county_fips is not null

    group by
        state_zone,
        county_fips

),

final as (

    select

        concat(
            state_zone,
            '|',
            county_fips
        ) as zone_county_key,

        state_zone,
        county_fips,

        state,
        zone,
        cwa,
        zone_name,
        county_name,

        source_record_count,

        time_zone_variants,
        feature_area_variants,

        representative_latitude,
        representative_longitude,

        case
            when source_record_count > 1
            then true
            else false
        end as had_multiple_source_records,

        case
            when time_zone_variants > 1
              or feature_area_variants > 1
            then true
            else false
        end as has_metadata_variation

    from relationship_grain

)

select *
from final