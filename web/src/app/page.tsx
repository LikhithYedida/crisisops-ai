import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { CountyRiskMap } from "@/components/county-risk-map";
import { DashboardRefreshButton } from "@/components/dashboard-refresh-button";

import {
  Activity,
  AlertTriangle,
  BellRing,
  ChevronRight,
  CircleDot,
  Database,
  Gauge,
  LayoutDashboard,
  Map,
  MapPin,
  Radar,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";

import { getDashboardData } from "@/lib/dashboard-data";


export const dynamic = "force-dynamic";


function formatMillions(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString();
}


function countyDisplayName(value: string) {
  return value.split(",")[0]?.trim() ?? value;
}


function formatRefreshTime(value: string) {
  const normalized = value
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d{2})$/, "$1:00");

  const timestamp = new Date(normalized);

  if (Number.isNaN(timestamp.getTime())) {
    return "Latest available";
  }

  const minutes =
    Math.max(
      0,
      Math.floor(
        (Date.now() - timestamp.getTime()) / 60000
      )
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }

  return timestamp.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}


const navItems = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "County Prioritization",
    href: "/priority",
    icon: Siren,
  },
  {
    label: "County Intelligence",
    href: "/counties",
    icon: MapPin,
  },
  {
    label: "Data Health",
    href: "/data-health",
    icon: Gauge,
  },
];


export default async function Home() {

  const data = await getDashboardData();

  const national = data.national;
  const pipeline = data.pipeline;
  const priorityCounties = data.priorityCounties;

  const topCounty = priorityCounties[0];


  return (
    <main className="min-h-screen bg-[#071018] text-slate-100">

      <div className="flex min-h-screen">

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

              {navItems.map((item) => {

                const Icon = item.icon;
                const isActive = item.href === "/";

                return (
                  <Link
                    key={item.label}
                    href={item.href}
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

                    <span>{item.label}</span>

                    {isActive && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    )}

                  </Link>
                );
              })}

            </nav>

          </div>


          <div className="mt-auto p-4">

            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">

              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">

                <ShieldCheck className="h-4 w-4" />

                DATA SYSTEMS {pipeline.overall_system_status}

              </div>

              <div className="mt-4 space-y-3">

                <SidebarMetric
                  label="Data Sources"
                  value={`${pipeline.fresh_sources} / ${pipeline.monitored_sources} Fresh`}
                />

                <SidebarMetric
                  label="County Coverage"
                  value={`${pipeline.scoring_coverage_pct}%`}
                />

                <SidebarMetric
                  label="Latest Data Build"
                  value={pipeline.latest_dbt_run_status}
                />

              </div>

            </div>

          </div>

        </aside>


        <section className="min-w-0 flex-1">

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

              <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs font-semibold text-emerald-300 sm:flex">

                <CircleDot className="h-3 w-3 fill-emerald-300" />

                LIVE

              </div>


              <div className="hidden text-right md:block">

                <div className="text-[11px] font-medium text-slate-400">
                  Data updated
                </div>

                <div className="text-xs font-semibold text-slate-200">
                  {formatRefreshTime(
                    national.situation_generated_at
                  )}
                </div>

              </div>
                  <DashboardRefreshButton />

              <details className="group relative">

  <summary
    title="View operational alerts"
    aria-label="View operational alerts"
    className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-400/25 hover:bg-cyan-400/[0.06] hover:text-cyan-200 [&::-webkit-details-marker]:hidden"
  >
    <BellRing className="h-4 w-4" />
  </summary>

  <div className="absolute right-0 top-12 z-50 w-[330px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722] shadow-2xl shadow-black/40">

    <div className="border-b border-white/10 px-4 py-3">

      <div className="text-sm font-semibold text-white">
        Operational Alerts
      </div>

      <div className="mt-1 text-[11px] text-slate-400">
        Current conditions that may need attention
      </div>

    </div>


    <div className="space-y-1 p-2">

      {/* HIGH PRIORITY COUNTIES */}
      <div className="rounded-xl px-3 py-3 hover:bg-white/[0.035]">

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="text-xs font-semibold text-slate-200">
              High-priority counties
            </div>

            <div className="mt-1 text-[11px] leading-5 text-slate-400">
              Counties currently ranked High based on live hazard conditions and community context.
            </div>

          </div>

          <div className="text-sm font-bold text-orange-300">
            {national.high_priority_counties}
          </div>

        </div>

      </div>


      {/* SEVERE / EXTREME ALERTS */}
      <div className="rounded-xl px-3 py-3 hover:bg-white/[0.035]">

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="text-xs font-semibold text-slate-200">
              Severe or Extreme alerts
            </div>

            <div className="mt-1 text-[11px] leading-5 text-slate-400">
              Active NWS alerts currently classified as Severe or Extreme.
            </div>

          </div>

          <div className="text-sm font-bold text-amber-300">
            {national.unique_severe_or_extreme_nws_alerts}
          </div>

        </div>

      </div>


      {/* CRITICAL COUNTIES */}
      <div className="rounded-xl px-3 py-3 hover:bg-white/[0.035]">

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="text-xs font-semibold text-slate-200">
              Critical counties
            </div>

            <div className="mt-1 text-[11px] leading-5 text-slate-400">
              Counties currently in the highest operational priority category.
            </div>

          </div>

          <div
            className={`text-sm font-bold ${
              national.critical_counties > 0
                ? "text-red-300"
                : "text-emerald-300"
            }`}
          >
            {national.critical_counties}
          </div>

        </div>

      </div>


      {/* SCORING COVERAGE */}
      <div className="rounded-xl px-3 py-3 hover:bg-white/[0.035]">

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="text-xs font-semibold text-slate-200">
              County scoring coverage
            </div>

            <div className="mt-1 text-[11px] leading-5 text-slate-400">
              Share of affected geographies with enough data to receive an operational score.
            </div>

          </div>

          <div className="text-sm font-bold text-cyan-300">
            {pipeline.scoring_coverage_pct}%
          </div>

        </div>

      </div>

    </div>


    <div className="border-t border-white/10 bg-[#071018]/60 px-4 py-3 text-[10px] leading-4 text-slate-500">
      Alerts summarize the latest available CrisisOps data. They do not replace official emergency guidance.
    </div>

  </div>

</details>

            </div>

          </header>


          <div className="mx-auto max-w-[1680px] px-5 py-7 md:px-8">

            <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

              <div>

                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">

                  <Activity className="h-3.5 w-3.5" />

                  Live U.S. Operational Intelligence

                </div>


                <h1 className="text-3xl font-bold tracking-tight text-white md:text-[34px]">
                  U.S. Hazard Intelligence Overview
                </h1>


                <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-300">
                  Track active hazards, identify counties requiring attention,
                    and understand the factors driving operational priority.
                </p>

              </div>


              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-medium text-slate-300">

                <Database className="h-4 w-4 text-cyan-300" />

                <span>
                  {national.unique_active_nws_alerts} active NWS alerts
                </span>

                <span className="text-slate-500">•</span>

                <span>
                  {national.active_scored_counties} affected counties
                </span>

              </div>

            </div>


            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <KpiCard
                label="Active NWS Alerts"
                value={national.unique_active_nws_alerts.toLocaleString()}
                detail={`${national.unique_severe_or_extreme_nws_alerts} classified Severe or Extreme`}
                icon={AlertTriangle}
                accent="amber"
              />

              <KpiCard
                label="Population Exposed"
                value={formatMillions(national.population_exposed)}
                detail={`Across ${national.affected_states} affected states`}
                icon={Users}
                accent="cyan"
              />

              <KpiCard
                label="Affected Counties"
                value={national.active_scored_counties.toLocaleString()}
                detail={`${national.county_alert_impacts.toLocaleString()} county-alert impacts`}
                icon={MapPin}
                accent="blue"
              />

              <KpiCard
                label="High Priority Counties"
                value={national.high_priority_counties.toLocaleString()}
                detail={`${national.critical_counties} counties currently Critical`}
                icon={Siren}
                accent="red"
              />

            </div>


            <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.65fr)_minmax(420px,0.75fr)]">

              <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722]">

                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

                  <div>

                    <div className="flex items-center gap-2 text-sm font-semibold text-white">

                      <Map className="h-4 w-4 text-cyan-300" />

                      Operational Priority Map

                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      Live county prioritization based on hazard and community context
                    </div>

                  </div>


                  <div className="hidden items-center gap-4 text-[11px] font-medium text-slate-300 md:flex">

                    <LegendDot label="Critical" tone="critical" />
                    <LegendDot label="High" tone="high" />
                    <LegendDot label="Elevated" tone="elevated" />
                    <LegendDot label="Moderate" tone="moderate" />
                    <LegendDot label="Low" tone="low" />

                  </div>

                </div>


                <div className="relative min-h-[470px] overflow-hidden bg-[#08131d]">

                  <CountyRiskMap />

                  <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-white/10 bg-[#071018]/95 px-4 py-3">

                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Most Common Hazard
                    </div>

                    <div className="mt-1.5 text-sm font-semibold text-white">
                      {national.leading_hazard}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-400">
                      Affecting {national.leading_hazard_counties.toLocaleString()} counties
                    </div>

                  </div>

                  <div className="absolute bottom-4 right-4 z-10 rounded-xl border border-white/10 bg-[#071018]/95 px-4 py-3">

                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Most Affected State
                    </div>

                    <div className="mt-1.5 text-sm font-semibold text-white">
                      {national.most_affected_state}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-400">
                      {national.most_affected_state_counties.toLocaleString()} affected counties
                    </div>

                  </div>

                </div>

              </section>


              {topCounty && (

                <section className="rounded-2xl border border-white/10 bg-[#0a1722]">

                  <div className="border-b border-white/10 px-5 py-4">

                    <div className="flex items-center gap-2 text-sm font-semibold text-white">

                      <Siren className="h-4 w-4 text-red-300" />

                      Highest Priority County

                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      County currently requiring the most attention
                    </div>

                  </div>


                  <div className="p-5">

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                          National Rank #{topCounty.national_operational_rank}
                        </div>

                        <div className="mt-2 text-2xl font-bold text-white">
                          {countyDisplayName(topCounty.county_full_name)}
                        </div>

                        <div className="mt-1 text-sm font-medium text-slate-400">
                          {topCounty.state}
                        </div>

                      </div>


                      <div className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-2.5 text-center">

                        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-300">
                          {topCounty.operational_priority_level}
                        </div>

                        <div className="mt-1 text-xl font-bold text-white">
                          {Number(topCounty.operational_priority_score).toFixed(2)}
                        </div>

                      </div>

                    </div>


                    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.035] p-4">

                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Current Hazard
                      </div>

                      <div className="mt-2 text-sm font-semibold text-white">
                        {topCounty.dominant_event}
                      </div>

                      <div className="mt-1.5 text-xs text-slate-300">

                        Hazard Severity:{" "}

                        <span className="font-bold text-amber-300">
                          {topCounty.hazard_level}
                        </span>

                      </div>

                    </div>


                    <div className="mt-6">

                      <div className="mb-4">

                        <div className="text-sm font-semibold text-white">
                          Why this county ranks high
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Share of the overall priority score
                        </div>

                      </div>


                      <Contribution
                        label="Current Hazard"
                        value={Number(topCounty.hazard_share_pct)}
                      />

                      <Contribution
                        label="Social Vulnerability"
                        value={Number(topCounty.vulnerability_share_pct)}
                      />

                      <Contribution
                        label="Population Exposure"
                        value={Number(topCounty.exposure_share_pct)}
                      />

                      <Contribution
                        label="Disaster History"
                        value={Number(topCounty.history_share_pct)}
                      />

                    </div>


                    <div className="mt-6 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] p-4">

                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                        Strongest Community Risk Factor
                      </div>

                      <div className="mt-2 text-sm font-semibold text-white">
                        {topCounty.dominant_context_driver}
                      </div>

                    </div>

                  </div>

                </section>

              )}

            </div>


            <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722]">

              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

                <div>

                  <div className="text-sm font-semibold text-white">
                    Priority Counties
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    Counties currently requiring the most attention
                  </div>

                </div>

              </div>


              <div className="overflow-x-auto">

                <table className="w-full min-w-[850px]">

                  <thead>

                    <tr className="border-b border-white/10 text-left">

                      <TableHead>Rank</TableHead>

                      <TableHead>County</TableHead>

                      <TableHead>Current Hazard</TableHead>

                      <TableHead>Main Risk Factor</TableHead>

                      <TableHead>Priority</TableHead>

                      <TableHead align="right">Score</TableHead>

                    </tr>

                  </thead>


                  <tbody>

                    {priorityCounties.map((county) => (

                      <tr
                        key={county.county_fips}
                        className="border-b border-white/[0.07] last:border-0 hover:bg-white/[0.035]"
                      >

                        <td className="px-5 py-4">

                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-bold text-slate-300">
                            {county.national_operational_rank}
                          </div>

                        </td>


                        <td className="px-5 py-4">

                          <div className="text-sm font-semibold text-white">
                            {countyDisplayName(county.county_full_name)}
                          </div>

                          <div className="mt-1 text-xs font-medium text-slate-400">
                            {county.state}
                          </div>

                        </td>


                        <td className="px-5 py-4 text-sm font-medium text-slate-300">
                          {county.dominant_event}
                        </td>


                        <td className="px-5 py-4">

                          <span className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-medium text-slate-300">
                            {county.dominant_context_driver}
                          </span>

                        </td>


                        <td className="px-5 py-4">

                          <span className="rounded-lg border border-red-400/20 bg-red-400/[0.07] px-2.5 py-1 text-[11px] font-bold text-red-300">
                            {county.operational_priority_level}
                          </span>

                        </td>


                        <td className="px-5 py-4 text-right text-sm font-bold text-white">
                          {Number(
                            county.operational_priority_score
                          ).toFixed(2)}
                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </section>


            <section className="mt-5">

              <div className="mb-3">

                <div className="text-sm font-semibold text-white">
                  Data Health
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Current status of the data powering this dashboard
                </div>

              </div>


              <div className="grid gap-4 md:grid-cols-3">

                <StatusCard
                  icon={ShieldCheck}
                  title="Data Pipeline"
                  value={pipeline.overall_system_status}
                  detail={`Latest data build: ${pipeline.latest_dbt_run_status}`}
                />

                <StatusCard
                  icon={Database}
                  title="Source Freshness"
                  value={`${pipeline.fresh_sources} / ${pipeline.monitored_sources}`}
                  detail="All monitored data sources are fresh"
                />

                <StatusCard
                  icon={Gauge}
                  title="County Coverage"
                  value={`${pipeline.scoring_coverage_pct}%`}
                  detail={`${pipeline.scored_geographies} of ${pipeline.total_active_geographies} active geographies scored`}
                />

              </div>

            </section>


            <div className="py-8 text-center text-[11px] font-medium tracking-wide text-slate-500">
              CRISISOPS • U.S. HAZARD INTELLIGENCE & COUNTY PRIORITIZATION
            </div>

          </div>

        </section>

      </div>

    </main>
  );
}


function SidebarMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">

      <span className="text-slate-400">
        {label}
      </span>

      <span className="font-semibold text-slate-200">
        {value}
      </span>

    </div>
  );
}


function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  accent: "amber" | "cyan" | "blue" | "red";
}) {

  const accentClasses = {
    amber: "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
    cyan: "border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300",
    blue: "border-blue-400/20 bg-blue-400/[0.07] text-blue-300",
    red: "border-red-400/20 bg-red-400/[0.07] text-red-300",
  };


  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a1722] p-5">

      <div className="flex items-start justify-between">

        <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">
          {label}
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accentClasses[accent]}`}
        >
          <Icon className="h-4 w-4" />
        </div>

      </div>

      <div className="mt-4 text-3xl font-bold tracking-tight text-white">
        {value}
      </div>

      <div className="mt-2 text-xs font-medium text-slate-400">
        {detail}
      </div>

    </div>
  );
}


function Contribution({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="mb-4 last:mb-0">

      <div className="mb-2 flex items-center justify-between text-xs">

        <span className="font-medium text-slate-300">
          {label}
        </span>

        <span className="font-semibold text-slate-100">
          {value.toFixed(2)}%
        </span>

      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">

        <div
          className="h-full rounded-full bg-cyan-400/80"
          style={{
            width: `${Math.min(
              100,
              Math.max(0, value)
            )}%`,
          }}
        />

      </div>

    </div>
  );
}


function TableHead({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}


function StatusCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a1722] p-4">

      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06]">

        <Icon className="h-4 w-4 text-emerald-300" />

      </div>

      <div>

        <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
          {title}
        </div>

        <div className="mt-1 text-sm font-bold text-white">
          {value}
        </div>

        <div className="mt-1 text-[11px] font-medium text-slate-400">
          {detail}
        </div>

      </div>

    </div>
  );
}


function LegendDot({
  label,
  tone,
}: {
  label: string;
  tone:
  | "critical"
  | "high"
  | "elevated"
  | "moderate"
  | "low";
}) {

  const colors = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  elevated: "bg-amber-300",
  moderate: "bg-cyan-400",
  low: "bg-slate-400",
};


  return (
    <div className="flex items-center gap-1.5">

      <div
        className={`h-2 w-2 rounded-full ${colors[tone]}`}
      />

      <span>{label}</span>

    </div>
  );
}