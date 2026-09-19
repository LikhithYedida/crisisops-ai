{{ config(
    materialized='view'
) }}

with source as (

    select *
    from {{ source(
        'crisisops_raw',
        'county_population'
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
            trim(county_full_name),
            ''
        ) as county_full_name,

        safe_cast(
            nullif(trim(population), '')
            as int64
        ) as population

    from source

)

select *
from cleaned