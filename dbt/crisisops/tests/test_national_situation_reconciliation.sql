-- ============================================================
-- CrisisOps
-- National Situation Reconciliation Test
--
-- Returns rows only when national summary metrics fail
-- internal reconciliation.
-- ============================================================

with national as (

    select *

    from {{ ref('mart_national_situation') }}

)

select *

from national

where

    -- Priority levels must account for every scored county.
    (
        critical_counties
        + high_priority_counties
        + elevated_priority_counties
        + moderate_priority_counties
        + low_priority_counties
    ) != active_scored_counties

    or

    -- Combined HIGH + CRITICAL KPI must reconcile.
    critical_or_high_counties
        != critical_counties + high_priority_counties

    or

    -- Context-driver categories must account for every
    -- scored county.
    (
        exposure_driven_counties
        + vulnerability_driven_counties
        + history_driven_counties
    ) != active_scored_counties

    or

    -- Severe/Extreme unique alerts cannot exceed all alerts.
    unique_severe_or_extreme_nws_alerts
        > unique_active_nws_alerts

    or

    -- Severe/Extreme geographic impacts cannot exceed
    -- all geographic alert impacts.
    severe_or_extreme_county_alert_impacts
        > county_alert_impacts

    or

    -- CRITICAL/HIGH counties cannot exceed all counties.
    critical_or_high_counties
        > active_scored_counties