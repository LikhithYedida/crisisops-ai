{{ config(
    materialized='view'
) }}

with source as (

    select *
    from {{ source(
        'crisisops_raw',
        'county_svi'
    ) }}

),

cleaned as (

    select

        lpad(
            nullif(trim(county_fips), ''),
            5,
            '0'
        ) as county_fips,

        nullif(
            trim(state_name),
            ''
        ) as state_name,

        upper(
            nullif(trim(state_abbr), '')
        ) as state_abbr,

        nullif(
            trim(county_name),
            ''
        ) as county_name,


        safe_cast(
            nullif(trim(svi_overall), '')
            as float64
        ) as svi_overall,

        safe_cast(
            nullif(trim(svi_socioeconomic), '')
            as float64
        ) as svi_socioeconomic,

        safe_cast(
            nullif(trim(svi_household), '')
            as float64
        ) as svi_household,

        safe_cast(
            nullif(trim(svi_minority_status), '')
            as float64
        ) as svi_minority_status,

        safe_cast(
            nullif(trim(svi_housing_transport), '')
            as float64
        ) as svi_housing_transport,


        safe_cast(
            nullif(trim(pct_below_150_poverty), '')
            as float64
        ) as pct_below_150_poverty,

        safe_cast(
            nullif(trim(pct_age_65_plus), '')
            as float64
        ) as pct_age_65_plus,

        safe_cast(
            nullif(trim(pct_disability), '')
            as float64
        ) as pct_disability,

        safe_cast(
            nullif(trim(pct_no_vehicle), '')
            as float64
        ) as pct_no_vehicle,

        safe_cast(
            nullif(trim(pct_limited_english), '')
            as float64
        ) as pct_limited_english

    from source

)

select *
from cleaned