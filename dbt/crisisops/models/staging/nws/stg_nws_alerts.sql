{{ config(
    materialized='view'
) }}


with source as (

    select *
    from {{ source('crisisops_raw', 'active_alerts') }}

),


cleaned as (

    select

        -- =========================================
        -- ALERT IDENTIFIERS
        -- =========================================

        nullif(
            trim(alert_id),
            ''
        ) as alert_id,


        -- =========================================
        -- ALERT CLASSIFICATION
        -- =========================================

        nullif(
            trim(event),
            ''
        ) as event,

        nullif(
            trim(severity),
            ''
        ) as severity,

        nullif(
            trim(certainty),
            ''
        ) as certainty,

        nullif(
            trim(urgency),
            ''
        ) as urgency,

        nullif(
            trim(status),
            ''
        ) as status,

        nullif(
            trim(message_type),
            ''
        ) as message_type,

        nullif(
            trim(category),
            ''
        ) as category,


        -- =========================================
        -- SOURCE / SENDER INFORMATION
        -- =========================================

        nullif(
            trim(sender),
            ''
        ) as sender,

        nullif(
            trim(sender_name),
            ''
        ) as sender_name,


        -- =========================================
        -- HUMAN-READABLE ALERT CONTENT
        -- =========================================

        nullif(
            trim(area_description),
            ''
        ) as area_description,

        nullif(
            trim(headline),
            ''
        ) as headline,

        nullif(
            trim(description),
            ''
        ) as description,

        nullif(
            trim(instruction),
            ''
        ) as instruction,

        nullif(
            trim(response),
            ''
        ) as response,


        -- =========================================
        -- TIME FIELDS
        -- =========================================

        safe_cast(
            nullif(
                trim(sent),
                ''
            )
            as timestamp
        ) as sent_at,

        safe_cast(
            nullif(
                trim(effective),
                ''
            )
            as timestamp
        ) as effective_at,

        safe_cast(
            nullif(
                trim(onset),
                ''
            )
            as timestamp
        ) as onset_at,

        safe_cast(
            nullif(
                trim(expires),
                ''
            )
            as timestamp
        ) as expires_at,

        safe_cast(
            nullif(
                trim(ends),
                ''
            )
            as timestamp
        ) as ends_at,


        -- =========================================
        -- GEOGRAPHY
        -- =========================================

        nullif(
            trim(geometry_type),
            ''
        ) as geometry_type,

        nullif(
            trim(geometry),
            ''
        ) as geometry_raw,

        nullif(
            trim(ugc_codes),
            ''
        ) as ugc_codes_raw,

        nullif(
            trim(same_codes),
            ''
        ) as same_codes_raw,


        -- =========================================
        -- ALERT METRICS
        -- =========================================

        safe_cast(
            nullif(
                trim(affected_zone_count),
                ''
            )
            as int64
        ) as affected_zone_count,


        -- =========================================
        -- BOOLEAN FLAGS
        -- =========================================

        case

            when lower(
                trim(is_actual_alert)
            ) in (
                'true',
                '1',
                'yes'
            )
                then true

            when lower(
                trim(is_actual_alert)
            ) in (
                'false',
                '0',
                'no'
            )
                then false

            else null

        end as is_actual_alert,


        case

            when lower(
                trim(has_geometry)
            ) in (
                'true',
                '1',
                'yes'
            )
                then true

            when lower(
                trim(has_geometry)
            ) in (
                'false',
                '0',
                'no'
            )
                then false

            else null

        end as has_geometry


    from source

)


select *
from cleaned