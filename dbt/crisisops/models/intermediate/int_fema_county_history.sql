{{ config(
    materialized='table'
) }}


-- ============================================================
-- CrisisOps
-- Intermediate FEMA County History
--
-- Grain:
-- One row per county_fips
--
-- Purpose:
-- Create county-level historical disaster burden features
-- from FEMA disaster declarations.
-- ============================================================


with fema_declarations as (

    select

        county_fips,

        disaster_number,

        declaration_type,

        incident_type,

        safe_cast(
            declaration_at as date
        ) as declaration_at

    from {{ ref('stg_fema_declarations') }}

    where county_fips is not null

),


-- ============================================================
-- Aggregate FEMA history to county grain
-- ============================================================

county_history as (

    select

        county_fips,

        -- Total distinct FEMA disasters in available history
        count(
            distinct disaster_number
        ) as fema_declarations_total,


        -- FEMA declarations in trailing 10 years
        count(
            distinct if(
                declaration_at
                    >= date_sub(
                        current_date(),
                        interval 10 year
                    ),
                disaster_number,
                null
            )
        ) as fema_declarations_10y,


        -- Major Disaster declarations
        count(
            distinct if(
                declaration_at
                    >= date_sub(
                        current_date(),
                        interval 10 year
                    )
                and upper(declaration_type) = 'DR',
                disaster_number,
                null
            )
        ) as major_disasters_10y,


        -- Emergency declarations
        count(
            distinct if(
                declaration_at
                    >= date_sub(
                        current_date(),
                        interval 10 year
                    )
                and upper(declaration_type) = 'EM',
                disaster_number,
                null
            )
        ) as emergencies_10y,


        -- Fire Management Assistance declarations
        count(
            distinct if(
                declaration_at
                    >= date_sub(
                        current_date(),
                        interval 10 year
                    )
                and upper(declaration_type) = 'FM',
                disaster_number,
                null
            )
        ) as fire_management_10y,


        -- Number of distinct incident categories
        -- experienced during the last 10 years
        count(
            distinct if(
                declaration_at
                    >= date_sub(
                        current_date(),
                        interval 10 year
                    ),
                incident_type,
                null
            )
        ) as incident_types_10y,


        min(
            declaration_at
        ) as first_fema_declaration_at,


        max(
            declaration_at
        ) as latest_fema_declaration_at

    from fema_declarations

    group by
        county_fips

),


-- ============================================================
-- Build historical burden score
--
-- Major disasters receive the largest weight.
-- Emergency declarations receive moderate weight.
-- Fire-management declarations receive a smaller weight.
--
-- Lifetime declaration count also contributes slightly so
-- counties with persistent long-term exposure are represented.
-- ============================================================

burden_features as (

    select

        *,

        (
            major_disasters_10y * 3.0
            +
            emergencies_10y * 2.0
            +
            fire_management_10y * 1.0
            +
            incident_types_10y * 1.5
            +
            ln(
                fema_declarations_total + 1
            ) * 2.0
        ) as historical_burden_raw

    from county_history

),


-- ============================================================
-- Normalize historical burden nationally
--
-- PERCENT_RANK converts the raw burden into a comparable
-- 0-100 national historical disaster risk score.
-- ============================================================

scored as (

    select

        *,

        round(
            100
            *
            percent_rank() over (
                order by historical_burden_raw
            ),
            2
        ) as history_score

    from burden_features

)


-- ============================================================
-- Final output
-- ============================================================

select

    county_fips,

    fema_declarations_total,

    fema_declarations_10y,

    major_disasters_10y,

    emergencies_10y,

    fire_management_10y,

    incident_types_10y,

    first_fema_declaration_at,

    latest_fema_declaration_at,

    round(
        historical_burden_raw,
        2
    ) as historical_burden_raw,

    history_score

from scored