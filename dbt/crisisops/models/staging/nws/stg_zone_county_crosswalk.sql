{{ config(
    materialized='view'
) }}

with source as (

    select *
    from {{ source(
        'crisisops_raw',
        'forecast_zone_county_crosswalk'
    ) }}

),

cleaned as (

    select

        upper(
            nullif(trim(state), '')
        ) as state,

        nullif(
            trim(zone),
            ''
        ) as zone,

        upper(
            nullif(trim(cwa), '')
        ) as cwa,

        nullif(
            trim(zone_name),
            ''
        ) as zone_name,

        upper(
            nullif(trim(state_zone), '')
        ) as state_zone,

        nullif(
            trim(county_name),
            ''
        ) as county_name,

        lpad(
            nullif(trim(county_fips), ''),
            5,
            '0'
        ) as county_fips,

        nullif(
            trim(time_zone),
            ''
        ) as time_zone,

        nullif(
            trim(feature_area),
            ''
        ) as feature_area,

        safe_cast(
            nullif(trim(latitude), '')
            as float64
        ) as latitude,

        safe_cast(
            nullif(trim(longitude), '')
            as float64
        ) as longitude

    from source

),

-- Remove ONLY records that are identical
-- across every normalized source field.
--
-- We deliberately do NOT deduplicate on
-- state_zone + county_fips because some
-- relationships have differing metadata.
deduplicated as (

    select distinct *
    from cleaned

),

final as (

    select

        *,

        concat(
            state_zone,
            '|',
            county_fips
        ) as zone_county_key

    from deduplicated

)

select *
from final