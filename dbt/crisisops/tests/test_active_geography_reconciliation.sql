-- ============================================================
-- CrisisOps
-- Test: Active Geography Reconciliation
--
-- Every county-level active hazard must exist in exactly one:
--
-- 1. Scored operational priority mart
-- OR
-- 2. Unscored active geography audit mart
--
-- Test succeeds when zero rows are returned.
-- ============================================================

with live_hazard as (

    select
        county_fips

    from {{ ref('int_county_live_hazard') }}

),


scored as (

    select
        county_fips

    from {{ ref('mart_county_operational_priority') }}

),


unscored as (

    select
        county_fips

    from {{ ref('mart_unscored_active_geographies') }}

),


accounted_for as (

    select county_fips
    from scored

    union all

    select county_fips
    from unscored

),


missing as (

    select
        h.county_fips

    from live_hazard h

    left join accounted_for a
        on h.county_fips = a.county_fips

    where a.county_fips is null

),


duplicates as (

    select
        county_fips

    from accounted_for

    group by
        county_fips

    having count(*) != 1

)


select
    county_fips,
    'MISSING_FROM_OUTPUTS' as reconciliation_error
from missing

union all

select
    county_fips,
    'MULTIPLE_OUTPUT_ASSIGNMENTS' as reconciliation_error
from duplicates