-- ============================================================
-- CrisisOps
-- Test: Operational Priority Formula
--
-- Expected formula:
--
-- 55% Current Hazard
-- 15% Population Exposure
-- 15% Social Vulnerability
-- 15% Historical Disaster Burden
--
-- Test succeeds when this query returns zero rows.
-- ============================================================

select

    county_fips,
    county_full_name,

    hazard_score,
    exposure_score,
    vulnerability_score_model,
    history_score,

    operational_priority_score,

    round(
        (
            hazard_score * 0.55
            +
            exposure_score * 0.15
            +
            vulnerability_score_model * 0.15
            +
            history_score * 0.15
        ),
        2
    ) as expected_operational_priority_score

from {{ ref('mart_county_operational_priority') }}

where abs(
    operational_priority_score
    -
    round(
        (
            hazard_score * 0.55
            +
            exposure_score * 0.15
            +
            vulnerability_score_model * 0.15
            +
            history_score * 0.15
        ),
        2
    )
) > 0.02