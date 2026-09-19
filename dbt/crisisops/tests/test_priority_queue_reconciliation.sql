-- ============================================================
-- CrisisOps
-- Priority Queue Reconciliation Test
--
-- Confirms that the serving queue preserves the validated
-- analytical county population and operational classification.
--
-- Returns rows only when an inconsistency exists.
-- ============================================================

with queue as (

    select *
    from {{ ref('mart_priority_queue') }}

),

priority as (

    select *
    from {{ ref('mart_county_operational_priority') }}

),

queue_summary as (

    select

        count(*) as queue_counties,

        countif(is_high_priority) as queue_high_priority,

        countif(is_top_10) as queue_top_10,

        countif(is_top_25) as queue_top_25

    from queue

),

priority_summary as (

    select

        count(*) as priority_counties,

        countif(
            operational_priority_level in ('CRITICAL', 'HIGH')
        ) as priority_high_priority

    from priority

)

select *

from queue_summary q

cross join priority_summary p

where

    q.queue_counties != p.priority_counties

    or q.queue_high_priority != p.priority_high_priority

    or q.queue_top_10 > 10

    or q.queue_top_25 > 25