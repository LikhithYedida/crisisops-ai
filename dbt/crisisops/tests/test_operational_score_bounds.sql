-- ============================================================
-- CrisisOps
-- Test: Score Bounds
--
-- Every normalized model score must remain within 0–100.
-- Test succeeds when zero rows are returned.
-- ============================================================

select

    county_fips,
    county_full_name,

    hazard_score,
    exposure_score,
    vulnerability_score_model,
    history_score,
    context_score,
    operational_priority_score

from {{ ref('mart_county_operational_priority') }}

where

    hazard_score < 0
    or hazard_score > 100

    or exposure_score < 0
    or exposure_score > 100

    or vulnerability_score_model < 0
    or vulnerability_score_model > 100

    or history_score < 0
    or history_score > 100

    or context_score < 0
    or context_score > 100

    or operational_priority_score < 0
    or operational_priority_score > 100