-- ============================================================
-- CrisisOps
-- Test: Operational Priority Classification
--
-- Expected thresholds:
--
-- CRITICAL:
-- score >= 80 AND Severe/Extreme alert exists
--
-- HIGH:
-- score >= 70, unless promoted to CRITICAL
--
-- ELEVATED:
-- 55 <= score < 70
--
-- MODERATE:
-- 40 <= score < 55
--
-- LOW:
-- score < 40
--
-- Test succeeds when zero rows are returned.
-- ============================================================

select

    county_fips,
    county_full_name,

    operational_priority_score,
    operational_priority_level,

    severe_or_extreme_alerts

from {{ ref('mart_county_operational_priority') }}

where not (

    (
        operational_priority_score >= 80
        and severe_or_extreme_alerts > 0
        and operational_priority_level = 'CRITICAL'
    )

    or

    (
        operational_priority_score >= 70
        and not (
            operational_priority_score >= 80
            and severe_or_extreme_alerts > 0
        )
        and operational_priority_level = 'HIGH'
    )

    or

    (
        operational_priority_score >= 55
        and operational_priority_score < 70
        and operational_priority_level = 'ELEVATED'
    )

    or

    (
        operational_priority_score >= 40
        and operational_priority_score < 55
        and operational_priority_level = 'MODERATE'
    )

    or

    (
        operational_priority_score < 40
        and operational_priority_level = 'LOW'
    )

)