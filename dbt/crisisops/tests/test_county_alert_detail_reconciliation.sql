-- ============================================================
-- CrisisOps
-- County Alert Detail Reconciliation
-- ============================================================

with alert_detail as (

    select *
    from {{ ref('mart_county_alert_detail') }}

),

county_intelligence as (

    select county_fips
    from {{ ref('mart_county_intelligence') }}

),

invalid_county_mappings as (

    select
        a.alert_county_key

    from alert_detail a

    left join county_intelligence c
        on a.county_fips = c.county_fips

    where c.county_fips is null

),

invalid_severity_flags as (

    select
        alert_county_key

    from alert_detail

    where is_severe_or_extreme
          != (
              upper(severity) in ('SEVERE', 'EXTREME')
          )

),

invalid_severity_sort as (

    select
        alert_county_key

    from alert_detail

    where alert_severity_sort_order
          != case

                 when upper(severity) = 'EXTREME' then 1

                 when upper(severity) = 'SEVERE' then 2

                 when upper(severity) = 'MODERATE' then 3

                 when upper(severity) = 'MINOR' then 4

                 else 5

             end

),

duplicate_alert_county_keys as (

    select
        alert_county_key

    from alert_detail

    group by alert_county_key

    having count(*) > 1

)

select
    'INVALID_COUNTY_MAPPING' as failure_type,
    alert_county_key

from invalid_county_mappings

union all

select
    'INVALID_SEVERITY_FLAG',
    alert_county_key

from invalid_severity_flags

union all

select
    'INVALID_SEVERITY_SORT',
    alert_county_key

from invalid_severity_sort

union all

select
    'DUPLICATE_ALERT_COUNTY_KEY',
    alert_county_key

from duplicate_alert_county_keys