-- ============================================================
-- CrisisOps
-- Test: CRITICAL Guardrail
--
-- A county must never receive CRITICAL operational priority
-- unless at least one Severe or Extreme alert is active.
--
-- Test succeeds when zero rows are returned.
-- ============================================================

select

    county_fips,
    county_full_name,

    operational_priority_score,
    operational_priority_level,

    severe_or_extreme_alerts,

    hazard_score,
    dominant_event

from {{ ref('mart_county_operational_priority') }}

where

    operational_priority_level = 'CRITICAL'

    and severe_or_extreme_alerts <= 0