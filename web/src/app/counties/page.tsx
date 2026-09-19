"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import { MobileNavigation } from "@/components/mobile-navigation";

import {
  Activity,
  BellRing,
  CircleDot,
  Gauge,
  LayoutDashboard,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";

import {
  DashboardRefreshButton,
} from "@/components/dashboard-refresh-button";


type CountyRecord = {
  county_fips: string;
  county_full_name: string;
  state: string;

  population: number | string;

  active_alerts: number | string;

  severe_or_extreme_alerts?:
    number | string;

  dominant_event: string;

  hazard_score: number | string;
  hazard_level: string;

  exposure_score: number | string;
  vulnerability_score_model:
    number | string;
  history_score: number | string;
  context_score: number | string;

  operational_priority_score:
    number | string;

  operational_priority_level:
    string;

  national_operational_rank:
    number | string;

  dominant_context_driver:
    string;

  dominant_risk_driver:
    string;

  hazard_contribution:
    number | string;
  exposure_contribution:
    number | string;
  vulnerability_contribution:
    number | string;
  history_contribution:
    number | string;

  hazard_share_pct:
    number | string;
  exposure_share_pct:
    number | string;
  vulnerability_share_pct:
    number | string;
  history_share_pct:
    number | string;

  fema_declarations_total:
    number | string;
  fema_declarations_10y:
    number | string;
  major_disasters_10y:
    number | string;
  emergencies_10y:
    number | string;
  fire_management_10y:
    number | string;
  incident_types_10y:
    number | string;
};


type MapApiResponse = {
  success: boolean;
  data?: CountyRecord[];
  error?: string;
};


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


function countyDisplayName(
  value: string,
) {
  return (
    value
      .split(",")[0]
      ?.trim() ??
    value
  );
}


function formatPopulation(
  value: number | string,
) {
  const numeric =
    Number(value ?? 0);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return "0";
  }

  return new Intl.NumberFormat(
    "en-US",
  ).format(numeric);
}


function numericValue(
  value:
    | number
    | string
    | undefined,
) {
  const number =
    Number(value ?? 0);

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}


export default function CountyIntelligencePage() {
  const [
    counties,
    setCounties,
  ] = useState<CountyRecord[]>([]);

  const [
    openCountyQuestion,
    setOpenCountyQuestion,
  ] = useState<
    "ranking" |
    "driver" |
    "context" |
    "fema" |
    null
  >(null);

  const [
    selectedCountyFips,
    setSelectedCountyFips,
  ] = useState("");

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    showSuggestions,
    setShowSuggestions,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    rankingExplanation,
    setRankingExplanation,
  ] = useState<string | null>(null);

  const [
    rankingExplanationLoading,
    setRankingExplanationLoading,
  ] = useState(false);

  const [
    rankingExplanationError,
    setRankingExplanationError,
  ] = useState<string | null>(null);

  const [
    driverExplanation,
    setDriverExplanation,
  ] = useState<string | null>(null);

  const [
    driverExplanationLoading,
    setDriverExplanationLoading,
  ] = useState(false);

  const [
    driverExplanationError,
    setDriverExplanationError,
  ] = useState<string | null>(null);

  const [
    contextExplanation,
    setContextExplanation,
  ] = useState<string | null>(null);

  const [
    contextExplanationLoading,
    setContextExplanationLoading,
  ] = useState(false);

  const [
    contextExplanationError,
    setContextExplanationError,
  ] = useState<string | null>(null);

  const [
    femaExplanation,
    setFemaExplanation,
  ] = useState<string | null>(null);

  const [
    femaExplanationLoading,
    setFemaExplanationLoading,
  ] = useState(false);

  const [
    femaExplanationError,
    setFemaExplanationError,
  ] = useState<string | null>(null);

  /*
   * Incremented whenever the selected county changes.
   * A late response from the previously selected county is ignored.
   */
  const explanationRequestVersion = useRef(0);


  /*
  |--------------------------------------------------------------------------
  | Load current county intelligence
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let active =
      true;

    const controller =
      new AbortController();

    async function loadCounties() {
      try {
        setLoading(
          true,
        );

        setError(
          null,
        );

        const response =
          await fetch(
            "/api/map",
            {
              cache:
                "no-store",

              signal:
                controller
                  .signal,
            },
          );

        const payload =
          (
            await response.json()
          ) as MapApiResponse;

        if (
          !response.ok ||
          !payload.success ||
          !Array.isArray(
            payload.data,
          )
        ) {
          throw new Error(
            payload.error ??
              "County intelligence could not be loaded.",
          );
        }

        if (!active) {
          return;
        }

        const sorted =
          [
            ...payload.data,
          ].sort(
            (
              a,
              b,
            ) =>
              numericValue(
                a.national_operational_rank,
              ) -
              numericValue(
                b.national_operational_rank,
              ),
          );

        setCounties(
          sorted,
        );

        /*
         * Start with the current
         * national #1 county.
         */
        if (
          sorted.length >
          0
        ) {
          setSelectedCountyFips(
            sorted[0]
              .county_fips,
          );

          setSearchText(
            sorted[0]
              .county_full_name,
          );
        }
      } catch (
        caughtError
      ) {
        if (
          !active ||
          controller.signal
            .aborted
        ) {
          return;
        }

        console.error(
          "County Intelligence load error:",
          caughtError,
        );

        setError(
          caughtError instanceof
          Error
            ? caughtError.message
            : "County intelligence could not be loaded.",
        );
      } finally {
        if (active) {
          setLoading(
            false,
          );
        }
      }
    }

    void loadCounties();

    return () => {
      active =
        false;

      controller.abort();
    };
  }, []);


  /*
  |--------------------------------------------------------------------------
  | Selected county
  |--------------------------------------------------------------------------
  */

  const selectedCounty =
    useMemo(
      () =>
        counties.find(
          (
            county,
          ) =>
            county.county_fips ===
            selectedCountyFips,
        ) ??
        null,
      [
        counties,
        selectedCountyFips,
      ],
    );


  /*
  |--------------------------------------------------------------------------
  | Search results
  |--------------------------------------------------------------------------
  */

  const matchingCounties =
    useMemo(() => {
      const query =
        searchText
          .trim()
          .toLowerCase();

      if (
        !query ||
        !showSuggestions
      ) {
        return [];
      }

      return counties
        .filter(
          (
            county,
          ) =>
            county
              .county_full_name
              .toLowerCase()
              .includes(
                query,
              ) ||
            county.state
              .toLowerCase()
              .includes(
                query,
              ),
        )
        .slice(
          0,
          8,
        );
    }, [
      counties,
      searchText,
      showSuggestions,
    ]);


  function selectCounty(
    county: CountyRecord,
  ) {
    explanationRequestVersion.current += 1;

    setSelectedCountyFips(
      county.county_fips,
    );

    setOpenCountyQuestion(
      null,
    );

    setRankingExplanation(
      null,
    );
    setRankingExplanationError(
      null,
    );
    setRankingExplanationLoading(
      false,
    );

    setDriverExplanation(
      null,
    );
    setDriverExplanationError(
      null,
    );
    setDriverExplanationLoading(
      false,
    );

    setContextExplanation(
      null,
    );
    setContextExplanationError(
      null,
    );
    setContextExplanationLoading(
      false,
    );

    setFemaExplanation(
      null,
    );
    setFemaExplanationError(
      null,
    );
    setFemaExplanationLoading(
      false,
    );

    setSearchText(
      county.county_full_name,
    );

    setShowSuggestions(
      false,
    );
  }


  async function loadRankingExplanation(
    county: CountyRecord,
  ) {
    if (
      rankingExplanationLoading
    ) {
      return;
    }

    const requestVersion =
      explanationRequestVersion.current;

    try {
      setRankingExplanationLoading(
        true,
      );
      setRankingExplanationError(
        null,
      );
      setRankingExplanation(
        null,
      );

      const response =
        await fetch(
          "/api/county-explanation",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                question:
                  "ranking",
                county,
              }),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
            "The explanation could not be prepared.",
        );
      }

      if (
        requestVersion !==
        explanationRequestVersion.current
      ) {
        return;
      }

      setRankingExplanation(
        result.explanation,
      );
    } catch (
      caughtError
    ) {
      if (
        requestVersion !==
        explanationRequestVersion.current
      ) {
        return;
      }

      console.error(
        "County ranking explanation failed:",
        caughtError,
      );

      setRankingExplanationError(
        caughtError instanceof Error
          ? caughtError.message
          : "The explanation could not be prepared.",
      );
    } finally {
      if (
        requestVersion ===
        explanationRequestVersion.current
      ) {
        setRankingExplanationLoading(
          false,
        );
      }
    }
  }


  async function loadDriverExplanation(
    county: CountyRecord,
  ) {
    if (
      driverExplanationLoading
    ) {
      return;
    }

    const requestVersion =
      explanationRequestVersion.current;

    try {
      setDriverExplanationLoading(
        true,
      );
      setDriverExplanationError(
        null,
      );
      setDriverExplanation(
        null,
      );

      const response =
        await fetch(
          "/api/county-explanation",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                question:
                  "driver",
                county,
              }),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
            "The explanation could not be prepared.",
        );
      }

      if (
        requestVersion !==
        explanationRequestVersion.current
      ) {
        return;
      }

      setDriverExplanation(
        result.explanation,
      );
    } catch (
      caughtError
    ) {
      if (
        requestVersion !==
        explanationRequestVersion.current
      ) {
        return;
      }

      console.error(
        "Score driver explanation failed:",
        caughtError,
      );

      setDriverExplanationError(
        caughtError instanceof Error
          ? caughtError.message
          : "The explanation could not be prepared.",
      );
    } finally {
      if (
        requestVersion ===
        explanationRequestVersion.current
      ) {
        setDriverExplanationLoading(
          false,
        );
      }
    }
  }


  async function loadContextExplanation(
    county: CountyRecord,
  ) {
    if (
      contextExplanationLoading
    ) {
      return;
    }

    const requestVersion =
      explanationRequestVersion.current;

    try {
      setContextExplanationLoading(
        true,
      );
      setContextExplanationError(
        null,
      );
      setContextExplanation(
        null,
      );

      const response =
        await fetch(
          "/api/county-explanation",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                question:
                  "context",
                county,
              }),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
            "The explanation could not be prepared.",
        );
      }

      if (
        requestVersion !==
        explanationRequestVersion.current
      ) {
        return;
      }

      setContextExplanation(
        result.explanation,
      );
    } catch (
      caughtError
    ) {
      if (
        requestVersion !==
        explanationRequestVersion.current
      ) {
        return;
      }

      console.error(
        "County context explanation failed:",
        caughtError,
      );

      setContextExplanationError(
        caughtError instanceof Error
          ? caughtError.message
          : "The explanation could not be prepared.",
      );
    } finally {
      if (
        requestVersion ===
        explanationRequestVersion.current
      ) {
        setContextExplanationLoading(
          false,
        );
      }
    }
  }


  async function loadFemaExplanation(
    county: CountyRecord,
  ) {
    if (
      femaExplanationLoading
    ) {
      return;
    }

    const requestVersion =
      explanationRequestVersion.current;

    try {
      setFemaExplanationLoading(
        true,
      );
      setFemaExplanationError(
        null,
      );
      setFemaExplanation(
        null,
      );

      const response =
        await fetch(
          "/api/county-explanation",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                question:
                  "fema",
                county,
              }),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
            "The explanation could not be prepared.",
        );
      }

      if (
        requestVersion !==
        explanationRequestVersion.current
      ) {
        return;
      }

      setFemaExplanation(
        result.explanation,
      );
    } catch (
      caughtError
    ) {
      if (
        requestVersion !==
        explanationRequestVersion.current
      ) {
        return;
      }

      console.error(
        "FEMA history explanation failed:",
        caughtError,
      );

      setFemaExplanationError(
        caughtError instanceof Error
          ? caughtError.message
          : "The explanation could not be prepared.",
      );
    } finally {
      if (
        requestVersion ===
        explanationRequestVersion.current
      ) {
        setFemaExplanationLoading(
          false,
        );
      }
    }
  }


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
                    "/counties";

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
                        {
                          item.label
                        }
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

            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">

              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">

                <ShieldCheck className="h-4 w-4" />

                COUNTY DATA READY

              </div>


              <div className="mt-4 space-y-3">

                <SidebarMetric
                  label="Counties loaded"
                  value={
                    loading
                      ? "Loading..."
                      : counties.length.toLocaleString()
                  }
                />

                <SidebarMetric
                  label="Selected state"
                  value={
                    selectedCounty
                      ? selectedCounty.state
                      : "—"
                  }
                />

                <SidebarMetric
                  label="Data source"
                  value="Live model"
                />

              </div>

            </div>

          </div>

        </aside>


        {/* ======================================================
            MAIN
            ====================================================== */}

        <section className="min-w-0 flex-1">
          <MobileNavigation />


          {/* ====================================================
              HEADER
              ==================================================== */}

          <header className="hidden h-[74px] items-center justify-between border-b border-white/10 bg-[#08131d]/95 px-8 xl:flex">

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


              <DashboardRefreshButton />


              <details className="group relative">

                <summary
                  aria-label="Selected county status"
                  title="Selected county status"
                  className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-400/25 hover:bg-cyan-400/[0.06] hover:text-cyan-200 [&::-webkit-details-marker]:hidden"
                >

                  <BellRing className="h-4 w-4" />

                </summary>


                <div className="absolute right-0 top-12 z-50 w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722] shadow-2xl shadow-black/40">

                  <div className="border-b border-white/10 px-4 py-3">

                    <div className="text-sm font-semibold text-white">
                      Selected County Status
                    </div>

                    <div className="mt-1 text-[11px] text-slate-400">
                      Current conditions for the county in view
                    </div>

                  </div>


                  {selectedCounty ? (

                    <div className="space-y-4 p-4">

                      <AlertRow
                        label="Priority"
                        value={
                          selectedCounty.operational_priority_level
                        }
                      />

                      <AlertRow
                        label="Current hazard"
                        value={
                          selectedCounty.dominant_event
                        }
                      />

                      <AlertRow
                        label="Active alerts"
                        value={String(
                          selectedCounty.active_alerts,
                        )}
                      />

                      <AlertRow
                        label="National rank"
                        value={`#${selectedCounty.national_operational_rank}`}
                      />

                    </div>

                  ) : (

                    <div className="p-4 text-xs text-slate-400">
                      Select a county to view its current status.
                    </div>

                  )}

                </div>

              </details>

            </div>

          </header>


          {/* ====================================================
              PAGE CONTENT
              ==================================================== */}

          <div className="mx-auto max-w-[1680px] px-5 py-7 md:px-8">


            {/* ==================================================
                TITLE
                ================================================== */}

            <div>

              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">

                <Activity className="h-3.5 w-3.5" />

                COUNTY-LEVEL DECISION CONTEXT

              </div>


              <h1 className="text-3xl font-bold tracking-tight text-white md:text-[34px]">
                County Intelligence
              </h1>


              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-300">
                Select any affected county to understand its current hazard,
                operational priority, and the context behind its national ranking.
              </p>

            </div>


            {/* ==================================================
                COUNTY SEARCH
                ================================================== */}

            <section className="relative z-30 mt-6 rounded-2xl border border-white/10 bg-[#0a1722] p-5">

              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">

                <div className="w-full max-w-2xl">

                  <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Find a county
                  </label>


                  <div className="relative mt-2">

                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />


                    <input
                      type="text"
                      value={
                        searchText
                      }
                      disabled={
                        loading
                      }
                      onFocus={() =>
                        setShowSuggestions(
                          true,
                        )
                      }
                      onChange={(
                        event,
                      ) => {
                        setSearchText(
                          event.target.value,
                        );

                        setShowSuggestions(
                          true,
                        );
                      }}
                      placeholder="Search county or state..."
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#071018] pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35 disabled:cursor-wait disabled:opacity-50"
                    />


                    {showSuggestions &&
                      matchingCounties.length >
                        0 && (

                        <div className="absolute left-0 right-0 top-[50px] z-50 max-h-[330px] overflow-y-auto rounded-xl border border-white/10 bg-[#0a1722] p-1.5 shadow-2xl shadow-black/50">

                          {matchingCounties.map(
                            (
                              county,
                            ) => (

                              <button
                                key={
                                  county.county_fips
                                }
                                type="button"
                                onClick={() =>
                                  selectCounty(
                                    county,
                                  )
                                }
                                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.05]"
                              >

                                <div>

                                  <div className="text-sm font-semibold text-slate-100">
                                    {
                                      county.county_full_name
                                    }
                                  </div>

                                  <div className="mt-1 text-[11px] text-slate-400">
                                    National Rank #
                                    {
                                      county.national_operational_rank
                                    }
                                  </div>

                                </div>


                                <PriorityBadge
                                  level={
                                    county.operational_priority_level
                                  }
                                />

                              </button>

                            ),
                          )}

                        </div>

                      )}

                  </div>

                </div>


                <div className="rounded-xl border border-white/10 bg-[#071018] px-4 py-3">

                  <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Available counties
                  </div>

                  <div className="mt-1 text-lg font-bold text-white">
                    {loading
                      ? "..."
                      : counties.length.toLocaleString()}
                  </div>

                </div>

              </div>

            </section>


            {/* ==================================================
                LOADING / ERROR
                ================================================== */}

            {loading && (

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0a1722] p-10 text-center">

                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />

                <div className="mt-4 text-sm font-semibold text-slate-200">
                  Loading county intelligence
                </div>

              </div>

            )}


            {error && (

              <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5">

                <div className="text-sm font-semibold text-red-300">
                  County intelligence could not be loaded
                </div>

                <div className="mt-2 text-xs leading-5 text-slate-400">
                  {error}
                </div>

              </div>

            )}


            {/* ==================================================
                SELECTED COUNTY
                ================================================== */}

            {!loading &&
              !error &&
              selectedCounty && (

                <>

                  <section className="mt-5 rounded-2xl border border-white/10 bg-[#0a1722] p-5">

                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">

                      <div>

                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                          SELECTED COUNTY
                        </div>


                        <div className="mt-2 flex flex-wrap items-center gap-3">

                          <h2 className="text-2xl font-bold text-white md:text-[28px]">
                            {countyDisplayName(
                              selectedCounty.county_full_name,
                            )}
                          </h2>

                          <PriorityBadge
                            level={
                              selectedCounty.operational_priority_level
                            }
                          />

                        </div>


                        <div className="mt-2 text-sm font-medium text-slate-400">

                          {
                            selectedCounty.state
                          }

                          <span className="mx-2 text-slate-600">
                            •
                          </span>

                          National Rank #

                          {
                            selectedCounty.national_operational_rank
                          }

                        </div>

                      </div>


                      <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] px-4 py-3">

                        <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-300">
                          Priority Score
                        </div>

                        <div className="mt-1 text-2xl font-bold text-white">
                          {numericValue(
                            selectedCounty.operational_priority_score,
                          ).toFixed(
                            2,
                          )}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-500">
                          out of 100
                        </div>

                      </div>

                    </div>

                  </section>


                  {/* ============================================
                      KPI ROW
                      ============================================ */}

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                    <MetricCard
                      label="National Rank"
                      value={`#${selectedCounty.national_operational_rank}`}
                      detail="Position among currently affected counties"
                      icon={
                        Siren
                      }
                    />

                    <MetricCard
                      label="Population"
                      value={formatPopulation(
                        selectedCounty.population,
                      )}
                      detail="County population used in exposure modeling"
                      icon={
                        Users
                      }
                    />

                    <MetricCard
                      label="Active Alerts"
                      value={numericValue(
                        selectedCounty.active_alerts,
                      ).toLocaleString()}
                      detail="Current NWS alerts affecting this county"
                      icon={
                        BellRing
                      }
                    />

                    <MetricCard
                      label="Severe / Extreme NWS Alerts"
                      value={numericValue(
                        selectedCounty.severe_or_extreme_alerts,
                      ).toLocaleString()}
                      detail="Active NWS alerts with official severity classified as Severe or Extreme"
                      icon={
                        Activity
                      }
                    />

                  </div>


                  {/* ============================================
                      DETAIL GRID
                      ============================================ */}

                  <div className="mt-5 grid gap-5 xl:grid-cols-2">


                    {/* CURRENT CONDITIONS */}

                    <section className="rounded-2xl border border-white/10 bg-[#0a1722]">

                      <div className="border-b border-white/10 px-5 py-4">

                        <div className="text-sm font-semibold text-white">
                          Current Conditions
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          What is affecting this county right now
                        </div>

                      </div>


                      <div className="space-y-4 p-5">

                        <DetailRow
                          label="Current hazard"
                          value={
                            selectedCounty.dominant_event ||
                            "No current modeled hazard"
                          }
                        />

                        <DetailRow
                          label="Operational hazard level"
                          value={
                            selectedCounty.hazard_level ||
                            "Not classified"
                          }
                        />

                        <DetailRow
                          label="Strongest community factor"
                          value={
                            selectedCounty.dominant_context_driver ||
                            "Not available"
                          }
                        />

                        <DetailRow
                          label="Operational priority"
                          value={
                            selectedCounty.operational_priority_level
                          }
                        />

                      </div>

                    </section>


                    {/* MODEL STRUCTURE */}

                    <section className="rounded-2xl border border-white/10 bg-[#0a1722]">

                      <div className="border-b border-white/10 px-5 py-4">

                        <div className="text-sm font-semibold text-white">
                          Score Framework
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          How current hazard and county context are weighted
                        </div>

                      </div>


                      <div className="space-y-5 p-5">

                        <WeightRow
                          label="Current Hazard"
                          value={55}
                          detail="Live NWS hazard conditions"
                        />

                        <WeightRow
                          label="Population Exposure"
                          value={15}
                          detail="Population potentially affected"
                        />

                        <WeightRow
                          label="Social Vulnerability"
                          value={15}
                          detail="CDC-based vulnerability context"
                        />

                        <WeightRow
                          label="Historical Disaster Burden"
                          value={15}
                          detail="FEMA disaster history"
                        />

                      </div>

                    </section>

                  </div>


                  {/* ============================================
                      SCORE DRIVERS
                      ============================================ */}

                  <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722]">

                    <div className="border-b border-white/10 px-5 py-4">

                      <div className="text-sm font-semibold text-white">
                        What Is Driving the Priority Score
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Actual contribution of each factor to this county&apos;s current score
                      </div>

                    </div>


                    <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_0.85fr]">


                      {/* ACTUAL SCORE CONTRIBUTIONS */}

                      <div className="space-y-5">

                        <ContributionRow
                          label="Current Hazard"
                          contribution={numericValue(
                            selectedCounty.hazard_contribution,
                          )}
                          share={numericValue(
                            selectedCounty.hazard_share_pct,
                          )}
                          detail={`${selectedCounty.dominant_event} • ${selectedCounty.hazard_level}`}
                        />


                        <ContributionRow
                          label="Population Exposure"
                          contribution={numericValue(
                            selectedCounty.exposure_contribution,
                          )}
                          share={numericValue(
                            selectedCounty.exposure_share_pct,
                          )}
                          detail={`Exposure score ${numericValue(
                            selectedCounty.exposure_score,
                          ).toFixed(1)} / 100`}
                        />


                        <ContributionRow
                          label="Social Vulnerability"
                          contribution={numericValue(
                            selectedCounty.vulnerability_contribution,
                          )}
                          share={numericValue(
                            selectedCounty.vulnerability_share_pct,
                          )}
                          detail={`Vulnerability score ${numericValue(
                            selectedCounty.vulnerability_score_model,
                          ).toFixed(1)} / 100`}
                        />


                        <ContributionRow
                          label="Disaster History"
                          contribution={numericValue(
                            selectedCounty.history_contribution,
                          )}
                          share={numericValue(
                            selectedCounty.history_share_pct,
                          )}
                          detail={`History score ${numericValue(
                            selectedCounty.history_score,
                          ).toFixed(1)} / 100`}
                        />

                      </div>


                      {/* LEADERSHIP SUMMARY */}

                      <div className="rounded-xl border border-white/10 bg-[#071018]/70 p-5">

                        <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                          PRIORITY SUMMARY
                        </div>


                        <div className="mt-3 text-lg font-semibold leading-7 text-white">

                          Current hazard conditions are the largest contributor to{" "}
{countyDisplayName(
  selectedCounty.county_full_name,
)}&apos;s current priority score.
                        </div>


                        <div className="mt-4 text-sm leading-6 text-slate-400">

                          {countyDisplayName(
                            selectedCounty.county_full_name,
                          )} ranks{" "}

                          <span className="font-semibold text-slate-200">
                            #{selectedCounty.national_operational_rank}
                          </span>{" "}

                          nationally with a priority score of{" "}

                          <span className="font-semibold text-slate-200">
                            {numericValue(
                              selectedCounty.operational_priority_score,
                            ).toFixed(2)}
                          </span>
                          . Current hazard accounts for{" "}

                          <span className="font-semibold text-slate-200">
                            {numericValue(
                              selectedCounty.hazard_share_pct,
                            ).toFixed(1)}%
                          </span>{" "}

                          of the score. Among county-context factors,{" "}

                          <span className="font-semibold text-slate-200">
                            {selectedCounty.dominant_context_driver}
                          </span>{" "}

                          contributes the most.

                        </div>


                        <div className="mt-5 border-t border-white/10 pt-4">

                          <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                            FEMA history
                          </div>


                          <div className="mt-3 grid grid-cols-2 gap-3">

                            <SmallStat
                              label="FEMA declarations"
                              value={numericValue(
                                selectedCounty.fema_declarations_total,
                              ).toLocaleString()}
                            />

                            <SmallStat
                              label="Last 10 years"
                              value={numericValue(
                                selectedCounty.fema_declarations_10y,
                              ).toLocaleString()}
                            />

                            <SmallStat
                              label="Major disasters"
                              value={numericValue(
                                selectedCounty.major_disasters_10y,
                              ).toLocaleString()}
                            />

                            <SmallStat
                              label="Incident types"
                              value={numericValue(
                                selectedCounty.incident_types_10y,
                              ).toLocaleString()}
                            />

                          </div>

                        </div>

                      </div>

                    </div>

                  </section>
                  <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1722]">

                    <div className="border-b border-white/10 px-5 py-4">

                      <div className="text-sm font-semibold text-white">
                        Questions About This County
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Open a question to see what is behind the current score and ranking
                      </div>

                    </div>


                    <div className="divide-y divide-white/[0.07]">


                      {/* WHY IS THIS COUNTY RANKED THIS HIGH? */}

                      <details
                        className="group"
                        open={
                          openCountyQuestion ===
                          "ranking"
                        }
                        onToggle={(event) => {
                          const isOpen =
                            event.currentTarget.open;

                          setOpenCountyQuestion(
                            (current) =>
                              isOpen
                                ? "ranking"
                                : current === "ranking"
                                  ? null
                                  : current,
                          );

                          if (
                            isOpen &&
                            selectedCounty &&
                            !rankingExplanation &&
                            !rankingExplanationLoading
                          ) {
                            void loadRankingExplanation(
                              selectedCounty,
                            );
                          }
                        }}
                      >

                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden">

                          <span className="text-sm font-semibold text-slate-100">
                            Why is this county ranked this high?
                          </span>

                          <span className="text-lg text-slate-500 transition group-open:rotate-45">
                            +
                          </span>

                        </summary>


                        <div className="px-5 pb-5">

                          <div className="rounded-xl border border-white/[0.07] bg-[#071018]/70 p-4">

                            {rankingExplanationLoading && (
                              <div className="flex items-center gap-3 text-sm text-slate-400">

                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />

                                Reviewing the current score factors...

                              </div>
                            )}

                            {!rankingExplanationLoading &&
                              rankingExplanation && (

                                <p className="text-sm leading-6 text-slate-300">
                                  {rankingExplanation}
                                </p>

                              )}

                            {!rankingExplanationLoading &&
                              rankingExplanationError && (

                                <div>

                                  <div className="text-sm text-slate-300">
                                    The explanation could not be loaded right now.
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        selectedCounty
                                      ) {
                                        void loadRankingExplanation(
                                          selectedCounty,
                                        );
                                      }
                                    }}
                                    className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                                  >
                                    Try again
                                  </button>

                                </div>

                              )}

                          </div>

                        </div>

                      </details>


                      {/* WHAT IS DRIVING THE SCORE MOST? */}

                      <details
                        className="group"
                        open={
                          openCountyQuestion ===
                          "driver"
                        }
                        onToggle={(event) => {
                          const isOpen =
                            event.currentTarget.open;

                          setOpenCountyQuestion(
                            (current) =>
                              isOpen
                                ? "driver"
                                : current === "driver"
                                  ? null
                                  : current,
                          );

                          if (
                            isOpen &&
                            selectedCounty &&
                            !driverExplanation &&
                            !driverExplanationLoading
                          ) {
                            void loadDriverExplanation(
                              selectedCounty,
                            );
                          }
                        }}
                      >

                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden">

                          <span className="text-sm font-semibold text-slate-100">
                            What is driving the score the most?
                          </span>

                          <span className="text-lg text-slate-500 transition group-open:rotate-45">
                            +
                          </span>

                        </summary>


                        <div className="px-5 pb-5">

                          <div className="rounded-xl border border-white/[0.07] bg-[#071018]/70 p-4">

                            {driverExplanationLoading && (
                              <div className="flex items-center gap-3 text-sm text-slate-400">

                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />

                                Reviewing what is driving the score...

                              </div>
                            )}

                            {!driverExplanationLoading &&
                              driverExplanation && (

                                <p className="text-sm leading-6 text-slate-300">
                                  {driverExplanation}
                                </p>

                              )}

                            {!driverExplanationLoading &&
                              driverExplanationError && (

                                <div>

                                  <div className="text-sm text-slate-300">
                                    The explanation could not be loaded right now.
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        selectedCounty
                                      ) {
                                        void loadDriverExplanation(
                                          selectedCounty,
                                        );
                                      }
                                    }}
                                    className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                                  >
                                    Try again
                                  </button>

                                </div>

                              )}

                          </div>

                        </div>

                      </details>


                      {/* WHICH COUNTY-CONTEXT FACTOR MATTERS MOST? */}

                      <details
                        className="group"
                        open={
                          openCountyQuestion ===
                          "context"
                        }
                        onToggle={(event) => {
                          const isOpen =
                            event.currentTarget.open;

                          setOpenCountyQuestion(
                            (current) =>
                              isOpen
                                ? "context"
                                : current === "context"
                                  ? null
                                  : current,
                          );

                          if (
                            isOpen &&
                            selectedCounty &&
                            !contextExplanation &&
                            !contextExplanationLoading
                          ) {
                            void loadContextExplanation(
                              selectedCounty,
                            );
                          }
                        }}
                      >

                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden">

                          <span className="text-sm font-semibold text-slate-100">
                            Which county-context factor matters most?
                          </span>

                          <span className="text-lg text-slate-500 transition group-open:rotate-45">
                            +
                          </span>

                        </summary>


                        <div className="px-5 pb-5">

                          <div className="rounded-xl border border-white/[0.07] bg-[#071018]/70 p-4">

                            {contextExplanationLoading && (
                              <div className="flex items-center gap-3 text-sm text-slate-400">

                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />

                                Reviewing the county context...

                              </div>
                            )}

                            {!contextExplanationLoading &&
                              contextExplanation && (

                                <p className="text-sm leading-6 text-slate-300">
                                  {contextExplanation}
                                </p>

                              )}

                            {!contextExplanationLoading &&
                              contextExplanationError && (

                                <div>

                                  <div className="text-sm text-slate-300">
                                    The explanation could not be loaded right now.
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        selectedCounty
                                      ) {
                                        void loadContextExplanation(
                                          selectedCounty,
                                        );
                                      }
                                    }}
                                    className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                                  >
                                    Try again
                                  </button>

                                </div>

                              )}

                          </div>

                        </div>

                      </details>


                      {/* WHAT DOES FEMA HISTORY ADD? */}

                      <details
                        className="group"
                        open={
                          openCountyQuestion ===
                          "fema"
                        }
                        onToggle={(event) => {
                          const isOpen =
                            event.currentTarget.open;

                          setOpenCountyQuestion(
                            (current) =>
                              isOpen
                                ? "fema"
                                : current === "fema"
                                  ? null
                                  : current,
                          );

                          if (
                            isOpen &&
                            selectedCounty &&
                            !femaExplanation &&
                            !femaExplanationLoading
                          ) {
                            void loadFemaExplanation(
                              selectedCounty,
                            );
                          }
                        }}
                      >

                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden">

                          <span className="text-sm font-semibold text-slate-100">
                            What does FEMA history add to the score?
                          </span>

                          <span className="text-lg text-slate-500 transition group-open:rotate-45">
                            +
                          </span>

                        </summary>


                        <div className="px-5 pb-5">

                          <div className="rounded-xl border border-white/[0.07] bg-[#071018]/70 p-4">

                            {femaExplanationLoading && (
                              <div className="flex items-center gap-3 text-sm text-slate-400">

                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />

                                Reviewing FEMA history...

                              </div>
                            )}

                            {!femaExplanationLoading &&
                              femaExplanation && (

                                <p className="text-sm leading-6 text-slate-300">
                                  {femaExplanation}
                                </p>

                              )}

                            {!femaExplanationLoading &&
                              femaExplanationError && (

                                <div>

                                  <div className="text-sm text-slate-300">
                                    The explanation could not be loaded right now.
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        selectedCounty
                                      ) {
                                        void loadFemaExplanation(
                                          selectedCounty,
                                        );
                                      }
                                    }}
                                    className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                                  >
                                    Try again
                                  </button>

                                </div>

                              )}

                          </div>

                        </div>

                      </details>

                    </div>

                  </section>


                  <div className="py-8 text-center text-[11px] font-medium tracking-wide text-slate-500">
                    CRISISOPS • COUNTY INTELLIGENCE
                  </div>

                </>

              )}

          </div>

        </section>

      </div>

    </main>
  );
}


/* ============================================================
   SUPPORTING UI
   ============================================================ */


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


function AlertRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">

      <span className="text-[11px] text-slate-400">
        {label}
      </span>

      <span className="max-w-[180px] text-right text-[11px] font-semibold text-slate-100">
        {value}
      </span>

    </div>
  );
}


function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a1722] p-5">

      <div className="flex items-start justify-between gap-4">

        <div>

          <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
            {label}
          </div>

          <div className="mt-4 text-2xl font-bold tracking-tight text-white">
            {value}
          </div>

        </div>


        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05]">

          <Icon className="h-4 w-4 text-cyan-300" />

        </div>

      </div>


      <div className="mt-2 text-xs leading-5 text-slate-400">
        {detail}
      </div>

    </div>
  );
}


function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-white/[0.07] bg-[#071018]/60 px-4 py-3 sm:flex-row sm:items-center">

      <div className="text-xs font-medium text-slate-400">
        {label}
      </div>

      <div className="text-sm font-semibold text-slate-100">
        {value}
      </div>

    </div>
  );
}


function WeightRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div>

      <div className="mb-2 flex items-end justify-between gap-4">

        <div>

          <div className="text-sm font-semibold text-slate-100">
            {label}
          </div>

          <div className="mt-1 text-[11px] text-slate-400">
            {detail}
          </div>

        </div>


        <div className="text-sm font-bold text-cyan-300">
          {value}%
        </div>

      </div>


      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">

        <div
          className="h-full rounded-full bg-cyan-400"
          style={{
            width: `${value}%`,
          }}
        />

      </div>

    </div>
  );
}


function ContributionRow({
  label,
  contribution,
  share,
  detail,
}: {
  label: string;
  contribution: number;
  share: number;
  detail: string;
}) {
  return (
    <div>

      <div className="mb-2 flex items-end justify-between gap-4">

        <div>

          <div className="text-sm font-semibold text-white">
            {label}
          </div>

          <div className="mt-1 text-[11px] text-slate-400">
            {detail}
          </div>

        </div>


        <div className="text-right">

          <div className="text-sm font-bold text-white">
            {contribution.toFixed(2)}
          </div>

          <div className="mt-0.5 text-[10px] text-slate-500">
            {share.toFixed(1)}% of score
          </div>

        </div>

      </div>


      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">

        <div
          className="h-full rounded-full bg-cyan-400"
          style={{
            width: `${Math.min(
              Math.max(share, 0),
              100,
            )}%`,
          }}
        />

      </div>

    </div>
  );
}


function SmallStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">

      <div className="text-[10px] font-medium text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-bold text-slate-100">
        {value}
      </div>

    </div>
  );
}


function PriorityBadge({
  level,
}: {
  level: string;
}) {
  const normalized =
    level
      .toUpperCase();

  const classes =
    normalized ===
    "CRITICAL"
      ? "border-red-400/25 bg-red-400/[0.08] text-red-300"

      : normalized ===
          "HIGH"
        ? "border-orange-400/25 bg-orange-400/[0.08] text-orange-300"

        : normalized ===
            "ELEVATED"
          ? "border-amber-300/25 bg-amber-300/[0.08] text-amber-200"

          : normalized ===
              "MODERATE"
            ? "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-300"

            : "border-slate-400/20 bg-slate-400/[0.08] text-slate-300";

  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] ${classes}`}
    >
      {normalized}
    </span>
  );
}