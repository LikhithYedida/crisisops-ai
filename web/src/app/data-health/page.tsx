import Link from "next/link";

import type {
  ComponentType,
} from "react";

import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CircleDot,
  Clock,
  Database,
  Gauge,
  LayoutDashboard,
  MapPin,
  Radar,
  ShieldCheck,
  Siren,
} from "lucide-react";

import {
  DashboardRefreshButton,
} from "@/components/dashboard-refresh-button";

import {
  getDataHealth,
} from "@/lib/data-health";


export const dynamic =
  "force-dynamic";


/* ============================================================
   NAVIGATION
   ============================================================ */


const navItems = [
  {
    label:
      "Overview",

    href:
      "/",

    icon:
      LayoutDashboard,
  },

  {
    label:
      "County Prioritization",

    href:
      "/priority",

    icon:
      Siren,
  },

  {
    label:
      "County Intelligence",

    href:
      "/counties",

    icon:
      MapPin,
  },

  {
    label:
      "Data Health",

    href:
      "/data-health",

    icon:
      Gauge,
  },
];


/* ============================================================
   HELPERS
   ============================================================ */


function numericValue(
  value:
    | number
    | string
    | null
    | undefined,
) {

  const numeric =
    Number(
      value ?? 0,
    );


  return Number.isFinite(
    numeric,
  )
    ? numeric
    : 0;
}


function formatNumber(
  value:
    | number
    | string
    | null
    | undefined,
) {

  return new Intl.NumberFormat(
    "en-US",
  ).format(
    numericValue(
      value,
    ),
  );
}


function formatPercent(
  value:
    | number
    | string
    | null
    | undefined,

  decimals = 2,
) {

  return `${Number(
  numericValue(value).toFixed(decimals)
)}%`;
}


function normalizeTimestamp(
  value:
    | string
    | null
    | undefined,
) {

  if (!value) {
    return null;
  }


  const normalized =
    value
      .replace(
        " ",
        "T",
      )
      .replace(
        /(\.\d{3})\d+/,
        "$1",
      )
      .replace(
        /([+-]\d{2})$/,
        "$1:00",
      );


  const timestamp =
    new Date(
      normalized,
    );


  if (
    Number.isNaN(
      timestamp.getTime(),
    )
  ) {
    return null;
  }


  return timestamp;
}


function formatRelativeTime(
  value:
    | string
    | null
    | undefined,
) {

  const timestamp =
    normalizeTimestamp(
      value,
    );


  if (!timestamp) {
    return "Latest available";
  }


  const minutes =
    Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          timestamp.getTime()
        ) /
        60000,
      ),
    );


  if (
    minutes <
    1
  ) {
    return "Just now";
  }


  if (
    minutes <
    60
  ) {
    return `${minutes} min ago`;
  }


  const hours =
    Math.floor(
      minutes /
      60,
    );


  if (
    hours <
    24
  ) {
    return `${hours} hr${
      hours === 1
        ? ""
        : "s"
    } ago`;
  }


  const days =
    Math.floor(
      hours /
      24,
    );


  if (
    days <
    7
  ) {
    return `${days} day${
      days === 1
        ? ""
        : "s"
    } ago`;
  }


  return timestamp
    .toLocaleDateString(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric",
      },
    );
}


function formatDateTime(
  value:
    | string
    | null
    | undefined,
) {

  const timestamp =
    normalizeTimestamp(
      value,
    );


  if (!timestamp) {
    return "Not available";
  }


  return timestamp
    .toLocaleString(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric",

        year:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit",
      },
    );
}


function getStatusClasses(
  value:
    | string
    | null
    | undefined,
) {

  const status =
    String(
      value ?? "",
    )
      .trim()
      .toUpperCase();


  if (
    [
      "HEALTHY",
      "SUCCESS",
      "FRESH",
      "AVAILABLE",
    ].includes(
      status,
    )
  ) {
    return {
      badge:
        "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",

      dot:
        "bg-emerald-300",
    };
  }


  if (
    [
      "WARNING",
      "PARTIAL",
      "UNKNOWN",
    ].includes(
      status,
    )
  ) {
    return {
      badge:
        "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",

      dot:
        "bg-amber-300",
    };
  }


  if (
    [
      "FAILED",
      "CRITICAL",
      "MISSING",
      "STALE",
      "DEGRADED",
    ].includes(
      status,
    )
  ) {
    return {
      badge:
        "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",

      dot:
        "bg-rose-300",
    };
  }


  return {
    badge:
      "border-white/10 bg-white/[0.04] text-slate-300",

    dot:
      "bg-slate-400",
  };
}


function getReasonText(
  reasonCode:
    string,
) {

  switch (
    reasonCode
      .trim()
      .toUpperCase()
  ) {

    case "NO_COUNTY_CONTEXT":

      return "County-level context is unavailable for this geography, so CrisisOps leaves it unscored rather than estimating the missing inputs.";


    case "MISSING_POPULATION":

      return "Population data is unavailable for this geography, so the exposure component cannot be completed.";


    case "MISSING_EXPOSURE_SCORE":

      return "The population exposure score is unavailable, so a complete operational score cannot be produced.";


    case "MISSING_VULNERABILITY_SCORE":

      return "Social vulnerability data is unavailable, so the county-context portion of the score cannot be completed.";


    case "MISSING_HISTORY_SCORE":

      return "FEMA history is unavailable, so the historical component of the operational score cannot be completed.";


    case "MISSING_CONTEXT_SCORE":

      return "One or more county-context inputs are incomplete, so CrisisOps leaves this geography out of the ranked queue.";


    default:

      return "A required county-level input is unavailable, so this geography is not included in operational scoring.";
  }
}


/* ============================================================
   REUSABLE UI
   ============================================================ */


function SidebarMetric({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {

  return (
    <div className="flex items-center justify-between gap-4">

      <span className="text-[11px] text-slate-400">
        {label}
      </span>


      <span className="text-[11px] font-semibold text-slate-100">
        {value}
      </span>

    </div>
  );
}


function StatusBadge({
  value,
}: {
  value:
    string;
}) {

  const classes =
    getStatusClasses(
      value,
    );


  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${classes.badge}`}
    >

      <span
        className={`h-1.5 w-1.5 rounded-full ${classes.dot}`}
      />

      {value}

    </span>
  );
}


function HealthMetricCard({
  label,
  value,
  description,
  icon:
    Icon,
  iconClasses,
}: {
  label:
    string;

  value:
    string;

  description:
    string;

  icon:
    ComponentType<{
      className?:
        string;
    }>;

  iconClasses:
    string;
}) {

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a1722] p-5">

      <div className="flex items-start justify-between gap-4">

        <div>

          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </div>


          <div className="mt-5 text-[30px] font-bold tracking-tight text-white">
            {value}
          </div>


          <div className="mt-1.5 max-w-[240px] text-xs leading-5 text-slate-400">
            {description}
          </div>

        </div>


        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${iconClasses}`}
        >

          <Icon className="h-5 w-5" />

        </div>

      </div>

    </div>
  );
}


function PipelineMetric({
  label,
  value,
  description,
}: {
  label:
    string;

  value:
    string;

  description:
    string;
}) {

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#071018] p-4">

      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>


      <div className="mt-2 text-xl font-bold text-white">
        {value}
      </div>


      <div className="mt-1 text-[11px] leading-5 text-slate-400">
        {description}
      </div>

    </div>
  );
}


/* ============================================================
   PAGE
   ============================================================ */


export default async function DataHealthPage() {

  const data =
    await getDataHealth();


  const pipeline =
    data.pipeline;


  const sources =
    data.sources;


  const unscoredGeographies =
    data.unscoredGeographies;


  /* ------------------------------------------------------------
     Missing pipeline state
     ------------------------------------------------------------ */

  if (!pipeline) {

    return (
      <main className="min-h-screen bg-[#071018] text-slate-100">

        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-8">

          <div className="w-full rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] p-8 text-center">

            <AlertTriangle className="mx-auto h-8 w-8 text-rose-300" />


            <div className="mt-4 text-lg font-semibold text-white">
              Data health status is unavailable
            </div>


            <div className="mt-2 text-sm leading-6 text-slate-400">
              CrisisOps could not find a current pipeline health record.
            </div>


            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
            >
              Return to Overview
            </Link>

          </div>

        </div>

      </main>
    );
  }


  const systemClasses =
    getStatusClasses(
      pipeline
        .overall_system_status,
    );


  const coverage =
    numericValue(
      pipeline
        .scoring_coverage_pct,
    );


  const coverageWidth =
    Math.min(
      100,
      Math.max(
        0,
        coverage,
      ),
    );


  const sourcesNeedingAttention =
    sources.filter(
      (
        source,
      ) =>
        source
          .requires_attention,
    );


  const healthy =
    pipeline
      .overall_system_status
      .toUpperCase() ===
    "HEALTHY";


  return (
    <main className="min-h-screen bg-[#071018] text-slate-100">

      <div className="flex min-h-screen">


        {/* ======================================================
            SIDEBAR
            ====================================================== */}

        <aside className="hidden w-[270px] flex-col border-r border-white/10 bg-[#08131d] xl:flex">

          <div className="border-b border-white/10 px-6 py-6">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">

                <Radar className="h-5 w-5 text-cyan-300" />

              </div>


              <div>

                <div className="text-[16px] font-bold tracking-[0.16em] text-white">
                  CRISISOPS
                </div>


                <div className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-slate-400">
                  U.S. HAZARD INTELLIGENCE
                </div>

              </div>

            </div>

          </div>


          <div className="px-4 py-6">

            <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Navigation
            </div>


            <nav className="space-y-1">

              {navItems.map(
                (
                  item,
                ) => {

                  const Icon =
                    item.icon;


                  const isActive =
                    item.href ===
                    "/data-health";


                  return (
                    <Link
                      key={
                        item.label
                      }
                      href={
                        item.href
                      }
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                        isActive
                          ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                          : "border border-transparent text-slate-300 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >

                      <Icon
                        className={`h-4 w-4 ${
                          isActive
                            ? "text-cyan-300"
                            : "text-slate-400"
                        }`}
                      />


                      <span>
                        {item.label}
                      </span>


                      {isActive && (

                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />

                      )}

                    </Link>
                  );
                },
              )}

            </nav>

          </div>


          <div className="mt-auto p-4">

            <div
              className={`rounded-2xl border p-4 ${
                healthy
                  ? "border-emerald-400/15 bg-emerald-400/[0.05]"
                  : "border-amber-400/15 bg-amber-400/[0.05]"
              }`}
            >

              <div
                className={`flex items-center gap-2 text-xs font-semibold ${
                  healthy
                    ? "text-emerald-300"
                    : "text-amber-300"
                }`}
              >

                <ShieldCheck className="h-4 w-4" />


                DATA SYSTEMS{" "}
                {
                  pipeline
                    .overall_system_status
                }

              </div>


              <div className="mt-4 space-y-3">

                <SidebarMetric
                  label="Data Sources"
                  value={`${pipeline.fresh_sources} / ${pipeline.monitored_sources} Fresh`}
                />


                <SidebarMetric
                  label="Scoring Coverage"
                  value={formatPercent(
                    pipeline
                      .scoring_coverage_pct,
                  )}
                />


                <SidebarMetric
                  label="Latest Build"
                  value={
                    pipeline
                      .latest_dbt_run_status
                  }
                />

              </div>

            </div>

          </div>

        </aside>


        {/* ======================================================
            MAIN
            ====================================================== */}

        <section className="min-w-0 flex-1">


          {/* ====================================================
              HEADER
              ==================================================== */}

          <header className="flex h-[74px] items-center justify-between border-b border-white/10 bg-[#08131d]/95 px-5 md:px-8">

            <div>

              <div className="text-sm font-semibold text-slate-100">
                CrisisOps
              </div>


              <div className="mt-1 text-xs text-slate-400">
                U.S. Hazard Intelligence and County Prioritization
              </div>

            </div>


            <div className="flex items-center gap-3">

              <div
                className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:flex ${systemClasses.badge}`}
              >

                <CircleDot
                  className={`h-3 w-3 fill-current`}
                />


                {
                  pipeline
                    .overall_system_status
                }

              </div>


              <div className="hidden text-right md:block">

                <div className="text-[11px] font-medium text-slate-400">
                  Health checked
                </div>


                <div className="text-xs font-semibold text-slate-200">
                  {formatRelativeTime(
                    pipeline
                      .health_evaluated_at,
                  )}
                </div>

              </div>


              <DashboardRefreshButton />


              <details className="group relative">

                <summary
                  aria-label="Data health status"
                  title="Data health status"
                  className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-400/25 hover:bg-cyan-400/[0.06] hover:text-cyan-200 [&::-webkit-details-marker]:hidden"
                >

                  <BellRing className="h-4 w-4" />

                </summary>


                <div className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722] shadow-2xl shadow-black/40">

                  <div className="border-b border-white/10 px-4 py-3">

                    <div className="text-sm font-semibold text-white">
                      Data Health Status
                    </div>


                    <div className="mt-1 text-[11px] text-slate-400">
                      Current pipeline and coverage conditions
                    </div>

                  </div>


                  <div className="space-y-4 p-4">

                    <SidebarMetric
                      label="System Status"
                      value={
                        pipeline
                          .overall_system_status
                      }
                    />


                    <SidebarMetric
                      label="Sources Needing Attention"
                      value={String(
                        pipeline
                          .sources_requiring_attention,
                      )}
                    />


                    <SidebarMetric
                      label="Coverage Exceptions"
                      value={String(
                        pipeline
                          .unscored_geographies,
                      )}
                    />


                    <SidebarMetric
                      label="Latest Build"
                      value={
                        pipeline
                          .latest_dbt_run_status
                      }
                    />

                  </div>


                  <div className="border-t border-white/10 bg-[#071018]/60 px-4 py-3 text-[10px] leading-4 text-slate-500">
                    This status reflects the latest available CrisisOps pipeline, source-freshness, and scoring-coverage checks.
                  </div>

                </div>

              </details>

            </div>

          </header>


          {/* ====================================================
              PAGE CONTENT
              ==================================================== */}

          <div className="mx-auto max-w-[1680px] px-5 py-7 md:px-8">


            {/* ==================================================
                PAGE TITLE
                ================================================== */}

            <div className="mb-7">

              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">

                <Activity className="h-3.5 w-3.5" />

                DATA RELIABILITY & PIPELINE STATUS

              </div>


              <h1 className="text-3xl font-bold tracking-tight text-white md:text-[34px]">
                Data Health
              </h1>


              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-300">
                Check whether the data feeding CrisisOps is current, whether the latest build completed successfully, and where county scoring coverage is incomplete.
              </p>

            </div>


            {/* ==================================================
                KPI CARDS
                ================================================== */}

            <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">

              <HealthMetricCard
                label="System Status"
                value={
                  pipeline
                    .overall_system_status
                }
                description={
                  healthy
                    ? "Pipeline, source freshness, and scoring coverage are operating normally."
                    : "One or more data-health checks currently require review."
                }
                icon={
                  ShieldCheck
                }
                iconClasses={
                  healthy
                    ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
                    : "border-amber-400/20 bg-amber-400/[0.08] text-amber-300"
                }
              />


              <HealthMetricCard
                label="Source Freshness"
                value={`${pipeline.fresh_sources} / ${pipeline.monitored_sources}`}
                description={
                  pipeline.sources_requiring_attention ===
                  0
                    ? "All monitored sources currently meet their freshness checks."
                    : `${pipeline.sources_requiring_attention} source${
                        pipeline.sources_requiring_attention ===
                        1
                          ? ""
                          : "s"
                      } currently require attention.`
                }
                icon={
                  Database
                }
                iconClasses="border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300"
              />


              <HealthMetricCard
                label="VALIDATION PASS RATE"
                value={formatPercent(
                  pipeline
                    .latest_dbt_pass_rate_pct,
                  0,
                )}
                description={`All checks in the latest dbt run. ${pipeline.latest_dbt_run_status}.`}
                icon={
                  CheckCircle2
                }
                iconClasses="border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
              />


              <HealthMetricCard
                label="Scoring Coverage"
                value={formatPercent(
                  pipeline
                    .scoring_coverage_pct,
                )}
                description={`${formatNumber(
                  pipeline
                    .scored_geographies,
                )} of ${formatNumber(
                  pipeline
                    .total_active_geographies,
                )} active geographies received a complete score.`}
                icon={
                  Gauge
                }
                iconClasses="border-blue-400/20 bg-blue-400/[0.08] text-blue-300"
              />

            </section>


            {/* ==================================================
                PIPELINE HEALTH + COVERAGE
                ================================================== */}

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">


              {/* ------------------------------------------------
                  PIPELINE HEALTH
                  ------------------------------------------------ */}

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722]">

                <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center">

                  <div>

                    <div className="flex items-center gap-2 text-sm font-semibold text-white">

                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />

                      Latest Pipeline Run

                    </div>


                    <div className="mt-1 text-xs text-slate-400">
                      Latest dbt run and validation results
                    </div>

                  </div>


                  <StatusBadge
                    value={
                      pipeline
                        .latest_dbt_run_status
                    }
                  />

                </div>


                <div className="p-5">

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

                    <PipelineMetric
                      label="Run Result"
                      value={
                        pipeline
                          .latest_dbt_run_status
                      }
                      description="Overall result of the latest dbt run"
                    />


                    <PipelineMetric
                      label="Pass Rate"
                      value={formatPercent(
                        pipeline
                          .latest_dbt_pass_rate_pct,
                        0,
                      )}
                      description="Share of validation checks that passed"
                    />


                    <PipelineMetric
                      label="Resources Checked"
                      value={formatNumber(
                        pipeline
                          .latest_dbt_total_resources,
                      )}
                      description="Resources included in the latest dbt run"
                    />


                    <PipelineMetric
                      label="Tests Executed"
                      value={formatNumber(
                        pipeline
                          .latest_dbt_tests_executed,
                      )}
                      description="Data-quality tests executed in the latest run"
                    />

                  </div>


                  <div className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#071018] p-4 md:flex-row md:items-center">

                    <div className="flex items-start gap-3">

                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">

                        <Clock className="h-4 w-4 text-slate-300" />

                      </div>


                      <div>

                        <div className="text-xs font-semibold text-slate-200">
                          Latest dbt run
                        </div>


                        <div className="mt-1 text-xs text-slate-400">
                          {formatDateTime(
                            pipeline
                              .latest_dbt_run_at,
                          )}
                        </div>

                      </div>

                    </div>


                    <div className="text-left md:text-right">

                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        Health evaluated
                      </div>


                      <div className="mt-1 text-xs font-semibold text-slate-300">
                        {formatRelativeTime(
                          pipeline
                            .health_evaluated_at,
                        )}
                      </div>

                    </div>

                  </div>

                </div>

              </div>


              {/* ------------------------------------------------
                  SCORING COVERAGE
                  ------------------------------------------------ */}

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722]">

                <div className="border-b border-white/10 px-5 py-4">

                  <div className="flex items-center gap-2 text-sm font-semibold text-white">

                    <Gauge className="h-4 w-4 text-cyan-300" />

                    Scoring Coverage

                  </div>


                  <div className="mt-1 text-xs text-slate-400">
                    Active geographies with complete operational scoring
                  </div>

                </div>


                <div className="p-5">

                  <div className="flex items-end justify-between gap-4">

                    <div>

                      <div className="text-[34px] font-bold tracking-tight text-white">
                        {formatPercent(
                          pipeline
                            .scoring_coverage_pct,
                        )}
                      </div>


                      <div className="mt-1 text-xs text-slate-400">
                        National active-hazard coverage
                      </div>

                    </div>


                    <div className="text-right">

                      <div className="text-sm font-bold text-slate-100">
                        {formatNumber(
                          pipeline
                            .scored_geographies,
                        )}
                      </div>


                      <div className="text-[10px] text-slate-500">
                        scored
                      </div>

                    </div>

                  </div>


                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">

                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{
                        width:
                          `${coverageWidth}%`,
                      }}
                    />

                  </div>


                  <div className="mt-5 grid grid-cols-3 gap-3">

                    <div className="rounded-xl border border-white/[0.07] bg-[#071018] p-3">

                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                        Active
                      </div>


                      <div className="mt-1 text-lg font-bold text-white">
                        {formatNumber(
                          pipeline
                            .total_active_geographies,
                        )}
                      </div>

                    </div>


                    <div className="rounded-xl border border-white/[0.07] bg-[#071018] p-3">

                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                        Scored
                      </div>


                      <div className="mt-1 text-lg font-bold text-emerald-300">
                        {formatNumber(
                          pipeline
                            .scored_geographies,
                        )}
                      </div>

                    </div>


                    <div className="rounded-xl border border-white/[0.07] bg-[#071018] p-3">

                      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                        Excluded
                      </div>


                      <div
                        className={`mt-1 text-lg font-bold ${
                          pipeline
                            .unscored_geographies >
                          0
                            ? "text-amber-300"
                            : "text-emerald-300"
                        }`}
                      >
                        {formatNumber(
                          pipeline
                            .unscored_geographies,
                        )}
                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </section>


            {/* ==================================================
                SOURCE FRESHNESS
                ================================================== */}

            <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722]">

              <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center">

                <div>

                  <div className="flex items-center gap-2 text-sm font-semibold text-white">

                    <Database className="h-4 w-4 text-cyan-300" />

                    Source Freshness

                  </div>


                  <div className="mt-1 text-xs text-slate-400">
                    Freshness status for each source feeding CrisisOps
                  </div>

                </div>


                <div className="flex items-center gap-2">

                  <span className="text-xs text-slate-400">
                    {pipeline.fresh_sources} of {pipeline.monitored_sources} fresh
                  </span>


                  {pipeline
                    .sources_requiring_attention ===
                  0 ? (

                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />

                  ) : (

                    <AlertTriangle className="h-4 w-4 text-amber-300" />

                  )}

                </div>

              </div>


              <div className="overflow-x-auto">

                <table className="w-full min-w-[900px] border-collapse">

                  <thead>

                    <tr className="border-b border-white/10 bg-[#071018]/40">

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Source
                      </th>


                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Type
                      </th>


                      <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Rows
                      </th>


                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Last Loaded
                      </th>


                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Table
                      </th>


                      <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Status
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {sources.map(
                      (
                        source,
                      ) => (

                        <tr
                          key={
                            source
                              .target_table
                          }
                          className="border-b border-white/[0.07] last:border-b-0"
                        >

                          <td className="px-5 py-4">

                            <div className="font-semibold text-slate-100">
                              {
                                source
                                  .source_name
                              }
                            </div>

                          </td>


                          <td className="px-5 py-4">

                            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">

                              {
                                source
                                  .source_category
                              }

                            </span>

                          </td>


                          <td className="px-5 py-4 text-right text-sm font-semibold text-slate-200">

                            {formatNumber(
                              source
                                .row_count,
                            )}

                          </td>


                          <td className="px-5 py-4">

                            <div className="text-sm text-slate-300">

                              {formatRelativeTime(
                                source
                                  .loaded_at,
                              )}

                            </div>


                            <div className="mt-1 text-[10px] text-slate-500">

                              {formatDateTime(
                                source
                                  .loaded_at,
                              )}

                            </div>

                          </td>


                          <td className="px-5 py-4">

                            <div className="font-mono text-[11px] text-slate-400">

                              {
                                source
                                  .target_table
                              }

                            </div>

                          </td>


                          <td className="px-5 py-4 text-right">

                            <StatusBadge
                              value={
                                source
                                  .freshness_status
                              }
                            />

                          </td>

                        </tr>

                      ),
                    )}

                  </tbody>

                </table>

              </div>


              {sourcesNeedingAttention.length ===
                0 && (

                <div className="flex items-center gap-2 border-t border-white/10 bg-emerald-400/[0.025] px-5 py-3 text-xs text-emerald-200">

                  <CheckCircle2 className="h-4 w-4" />

                  No monitored source currently requires attention.

                </div>

              )}

            </section>


            {/* ==================================================
                COVERAGE EXCEPTIONS
                ================================================== */}

            <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722]">

              <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center">

                <div>

                  <div className="flex items-center gap-2 text-sm font-semibold text-white">

                    <AlertTriangle
                      className={`h-4 w-4 ${
                        unscoredGeographies.length >
                        0
                          ? "text-amber-300"
                          : "text-emerald-300"
                      }`}
                    />

                    Coverage Exceptions

                  </div>


                  <div className="mt-1 text-xs text-slate-400">
                    Active geographies that could not receive a complete operational score
                  </div>

                </div>


                <div className="rounded-lg border border-white/10 bg-[#071018] px-3 py-2">

                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    Current Count
                  </div>


                  <div
                    className={`mt-0.5 text-lg font-bold ${
                      unscoredGeographies.length >
                      0
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {
                      unscoredGeographies
                        .length
                    }
                  </div>

                </div>

              </div>


              {unscoredGeographies.length ===
              0 ? (

                <div className="p-5">

                  <div className="flex items-start gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">

                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />


                    <div>

                      <div className="text-sm font-semibold text-white">
                        All active geographies are fully scored
                      </div>


                      <div className="mt-1 text-xs leading-5 text-slate-400">
                        No active geography is currently blocked by missing county-context data.
                      </div>

                    </div>

                  </div>

                </div>

              ) : (

                <div className="divide-y divide-white/[0.07]">

                  {unscoredGeographies.map(
                    (
                      geography,
                    ) => (

                      <div
                        key={
                          geography
                            .county_fips
                        }
                        className="p-5"
                      >

                        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <div className="text-base font-semibold text-white">

                                {
                                  geography
                                    .county_name
                                }
                                ,{" "}
                                {
                                  geography
                                    .state
                                }

                              </div>


                              <span className="rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-300">

                                Score not produced

                              </span>

                            </div>


                            <div className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">

                              {getReasonText(
                                geography
                                  .reason_code,
                              )}

                            </div>


                            <div className="mt-4 flex flex-wrap gap-2">

                              <span className="rounded-lg border border-white/10 bg-[#071018] px-3 py-2 text-xs text-slate-300">

                                Current hazard:{" "}

                                <span className="font-semibold text-white">
                                  {
                                    geography
                                      .dominant_event
                                  }
                                </span>

                              </span>


                              <span className="rounded-lg border border-white/10 bg-[#071018] px-3 py-2 text-xs text-slate-300">

                                Hazard level:{" "}

                                <span className="font-semibold text-white">
                                  {
                                    geography
                                      .hazard_level
                                  }
                                </span>

                              </span>


                              <span className="rounded-lg border border-white/10 bg-[#071018] px-3 py-2 text-xs text-slate-300">

                                Active alerts:{" "}

                                <span className="font-semibold text-white">
                                  {
                                    geography
                                      .active_alerts
                                  }
                                </span>

                              </span>

                            </div>

                          </div>


                          <div className="shrink-0 rounded-xl border border-white/[0.08] bg-[#071018] px-4 py-3 lg:min-w-[210px]">

                            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                              Reason Code
                            </div>


                            <div className="mt-1 font-mono text-xs font-semibold text-amber-200">
                              {
                                geography
                                  .reason_code
                              }
                            </div>


                            <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                              Detected
                            </div>


                            <div className="mt-1 text-xs text-slate-300">
                              {formatDateTime(
                                geography
                                  .exception_detected_at,
                              )}
                            </div>

                          </div>

                        </div>

                      </div>

                    ),
                  )}

                </div>

              )}

            </section>


            {/* ==================================================
                SYSTEM CHECK SUMMARY
                ================================================== */}

            <section className="mt-5 rounded-2xl border border-white/10 bg-[#0a1722] p-5">

              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">

                <div className="flex items-start gap-3">

                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      healthy
                        ? "border-emerald-400/20 bg-emerald-400/[0.08]"
                        : "border-amber-400/20 bg-amber-400/[0.08]"
                    }`}
                  >

                    <ShieldCheck
                      className={`h-5 w-5 ${
                        healthy
                          ? "text-emerald-300"
                          : "text-amber-300"
                      }`}
                    />

                  </div>


                  <div>

                    <div className="text-sm font-semibold text-white">
                      Reliability Summary
                    </div>


                    <div className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">

                      {healthy
                        ? `The latest build completed successfully, all ${pipeline.monitored_sources} monitored sources are fresh, and ${formatPercent(
                            pipeline.scoring_coverage_pct,
                          )} of active geographies have complete scoring.`
                        : "One or more health checks currently require review before relying on the dashboard for operational prioritization."}

                    </div>

                  </div>

                </div>


                <div className="shrink-0">

                  <StatusBadge
                    value={
                      pipeline
                        .overall_system_status
                    }
                  />

                </div>

              </div>

            </section>


            {/* ==================================================
                FOOTER
                ================================================== */}

            <footer className="py-8 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">

              CRISISOPS • DATA HEALTH & PIPELINE MONITORING

            </footer>

          </div>

        </section>

      </div>

    </main>
  );
}