{{ config(
    materialized='view'
) }}

with source as (

    select *
    from {{ source(
        'crisisops_raw',
        'fema_declarations'
    ) }}

),

cleaned as (

    select

        safe_cast(
            nullif(trim(disaster_number), '')
            as int64
        ) as disaster_number,

        nullif(
            trim(fema_declaration),
            ''
        ) as fema_declaration,

        upper(
            nullif(trim(state), '')
        ) as state,

        nullif(
            trim(declaration_type),
            ''
        ) as declaration_type,

        safe_cast(
            nullif(trim(declaration_date), '')
            as timestamp
        ) as declaration_at,

        nullif(
            trim(incident_type),
            ''
        ) as incident_type,

        safe_cast(
            nullif(trim(incident_begin_date), '')
            as timestamp
        ) as incident_begin_at,

        safe_cast(
            nullif(trim(incident_end_date), '')
            as timestamp
        ) as incident_end_at,

        lpad(
            nullif(trim(state_fips), ''),
            2,
            '0'
        ) as state_fips,

        lpad(
            nullif(trim(county_code), ''),
            3,
            '0'
        ) as county_code,

        nullif(
            trim(designated_area),
            ''
        ) as designated_area,

        safe_cast(
            nullif(trim(last_refresh), '')
            as timestamp
        ) as last_refresh_at,

        lpad(
            nullif(trim(county_fips), ''),
            5,
            '0'
        ) as county_fips

    from source

)

select *
from cleaned