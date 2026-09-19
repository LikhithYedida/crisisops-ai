-- ============================================================
-- CrisisOps
-- County Intelligence Reconciliation
-- ============================================================

with intelligence as (

    select *
    from {{ ref('mart_county_intelligence') }}

),

queue as (

    select *
    from {{ ref('mart_priority_queue') }}

),

intelligence_summary as (

    select
        count(*) as intelligence_counties,
        count(distinct county_fips) as intelligence_unique_counties
    from intelligence

),

queue_summary as (

    select
        count(*) as queue_counties
    from queue

),

invalid_share_totals as (

    select count(*) as invalid_counties

    from intelligence

    where abs(
        (
            hazard_share_pct
            + exposure_share_pct
            + vulnerability_share_pct
            + history_share_pct
        ) - 100
    ) > 0.05

),

invalid_ranks as (

    select count(*) as invalid_counties

    from intelligence

    where national_operational_rank < 1

       or national_operational_rank
          > national_active_scored_counties

)

select *

from intelligence_summary i

cross join queue_summary q

cross join invalid_share_totals s

cross join invalid_ranks r

where

    i.intelligence_counties != q.queue_counties

    or i.intelligence_unique_counties != i.intelligence_counties

    or s.invalid_counties > 0

    or r.invalid_counties > 0