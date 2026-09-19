{{ config(
    materialized='table'
) }}


-- ============================================================
-- CRISISOPS
-- Intermediate County Context
--
-- Grain:
-- One row per county_fips
--
-- Combines:
-- 1. Census population exposure
-- 2. CDC social vulnerability
-- 3. FEMA historical disaster burden
-- ============================================================


with population_base as (

    select

        county_fips,

        county_full_name,

        safe_cast(
            population as int64
        ) as population_value

    from {{ ref('stg_county_population') }}

    where county_fips is not null

),


-- ============================================================
-- Population exposure score
--
-- Convert raw population into national percentile score.
-- ============================================================

population_scored as (

    select

        p.county_fips,

        p.county_full_name,

        p.population_value as population,

        round(
            100.0
            *
            percent_rank() over (
                order by p.population_value
            ),
            2
        ) as exposure_score

    from population_base p

),


-- ============================================================
-- CDC Social Vulnerability
-- ============================================================

svi_base as (

    select

        county_fips,

        state_name,

        state_abbr,

        county_name,

        safe_cast(
            svi_overall as float64
        ) as svi_overall,

        safe_cast(
            svi_socioeconomic as float64
        ) as svi_socioeconomic,

        safe_cast(
            svi_household as float64
        ) as svi_household,

        safe_cast(
            svi_minority_status as float64
        ) as svi_minority_status,

        safe_cast(
            svi_housing_transport as float64
        ) as svi_housing_transport,

        safe_cast(
            pct_below_150_poverty as float64
        ) as pct_below_150_poverty,

        safe_cast(
            pct_age_65_plus as float64
        ) as pct_age_65_plus,

        safe_cast(
            pct_disability as float64
        ) as pct_disability,

        safe_cast(
            pct_no_vehicle as float64
        ) as pct_no_vehicle,

        safe_cast(
            pct_limited_english as float64
        ) as pct_limited_english

    from {{ ref('stg_county_svi') }}

    where county_fips is not null

),


-- ============================================================
-- CDC vulnerability score
--
-- CDC SVI overall percentile is 0-1.
-- Convert it to a 0-100 model scale.
-- ============================================================

svi_scored as (

    select

        s.*,

        round(
            greatest(
                0.0,
                least(
                    100.0,
                    coalesce(
                        s.svi_overall,
                        0.0
                    )
                    * 100.0
                )
            ),
            2
        ) as vulnerability_score_model

    from svi_base s

),


-- ============================================================
-- FEMA historical disaster context
-- ============================================================

fema_history as (

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

        historical_burden_raw,

        history_score

    from {{ ref('int_fema_county_history') }}

),


-- ============================================================
-- Join all county context features
-- ============================================================

county_context_joined as (

    select

        p.county_fips,

        p.county_full_name,

        s.state_name,

        s.state_abbr,

        coalesce(
            s.county_name,
            p.county_full_name
        ) as county_name,

        p.population,

        p.exposure_score,

        coalesce(
            s.svi_overall,
            0.0
        ) as svi_overall,

        coalesce(
            s.svi_socioeconomic,
            0.0
        ) as svi_socioeconomic,

        coalesce(
            s.svi_household,
            0.0
        ) as svi_household,

        coalesce(
            s.svi_minority_status,
            0.0
        ) as svi_minority_status,

        coalesce(
            s.svi_housing_transport,
            0.0
        ) as svi_housing_transport,

        coalesce(
            s.pct_below_150_poverty,
            0.0
        ) as pct_below_150_poverty,

        coalesce(
            s.pct_age_65_plus,
            0.0
        ) as pct_age_65_plus,

        coalesce(
            s.pct_disability,
            0.0
        ) as pct_disability,

        coalesce(
            s.pct_no_vehicle,
            0.0
        ) as pct_no_vehicle,

        coalesce(
            s.pct_limited_english,
            0.0
        ) as pct_limited_english,

        coalesce(
            s.vulnerability_score_model,
            0.0
        ) as vulnerability_score_model,

        coalesce(
            f.fema_declarations_total,
            0
        ) as fema_declarations_total,

        coalesce(
            f.fema_declarations_10y,
            0
        ) as fema_declarations_10y,

        coalesce(
            f.major_disasters_10y,
            0
        ) as major_disasters_10y,

        coalesce(
            f.emergencies_10y,
            0
        ) as emergencies_10y,

        coalesce(
            f.fire_management_10y,
            0
        ) as fire_management_10y,

        coalesce(
            f.incident_types_10y,
            0
        ) as incident_types_10y,

        f.first_fema_declaration_at,

        f.latest_fema_declaration_at,

        coalesce(
            f.historical_burden_raw,
            0.0
        ) as historical_burden_raw,

        coalesce(
            f.history_score,
            0.0
        ) as history_score

    from population_scored p

    left join svi_scored s

        on p.county_fips
        =
        s.county_fips

    left join fema_history f

        on p.county_fips
        =
        f.county_fips

),


-- ============================================================
-- Composite community context score
--
-- Equal weighting:
--
-- Population Exposure = 33.33%
-- Vulnerability       = 33.33%
-- Disaster History    = 33.33%
--
-- Current live hazard is intentionally excluded here.
-- ============================================================

county_context_scored as (

    select

        *,

        round(
            (
                exposure_score
                +
                vulnerability_score_model
                +
                history_score
            )
            / 3.0,
            2
        ) as context_score

    from county_context_joined

)


-- ============================================================
-- Final output
-- ============================================================

select

    county_fips,

    county_full_name,

    state_name,

    state_abbr,

    county_name,

    population,

    exposure_score,

    svi_overall,

    svi_socioeconomic,

    svi_household,

    svi_minority_status,

    svi_housing_transport,

    pct_below_150_poverty,

    pct_age_65_plus,

    pct_disability,

    pct_no_vehicle,

    pct_limited_english,

    vulnerability_score_model,

    fema_declarations_total,

    fema_declarations_10y,

    major_disasters_10y,

    emergencies_10y,

    fire_management_10y,

    incident_types_10y,

    first_fema_declaration_at,

    latest_fema_declaration_at,

    historical_burden_raw,

    history_score,

    context_score

from county_context_scored