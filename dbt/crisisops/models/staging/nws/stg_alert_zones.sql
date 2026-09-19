{{ config(
    materialized='view'
) }}

with source as (

    select *
    from {{ source('crisisops_raw', 'alert_zones') }}

),

cleaned as (

    select

        nullif(trim(alert_id), '') as alert_id,

        nullif(trim(zone_id), '') as zone_id,

        lower(
            nullif(trim(zone_type), '')
        ) as zone_type,

        nullif(trim(zone_url), '') as zone_url,

        concat(
            coalesce(nullif(trim(alert_id), ''), ''),
            '|',
            coalesce(nullif(trim(zone_id), ''), '')
        ) as alert_zone_key

    from source

)

select *
from cleaned