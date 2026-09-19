"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  Filter,
  Search,
  X,
} from "lucide-react";

export type PriorityCounty = {
  county_fips: string;
  county_full_name: string;
  state: string;
  population: number | string;
  active_alerts: number | string;
  severe_or_extreme_alerts?: number | string;
  dominant_event: string;
  hazard_level: string;
  operational_priority_score: number | string;
  operational_priority_level: string;
  national_operational_rank: number | string;
  dominant_context_driver: string;
};

type MapApiResponse = {
  success: boolean;
  data?: PriorityCounty[];
  error?: string;
};

type PriorityQueueProps = {
  initialCounties: PriorityCounty[];
  expectedCount?: number;
};

const PRIORITY_ORDER = [
  "CRITICAL",
  "HIGH",
  "ELEVATED",
  "MODERATE",
  "LOW",
];

function countyDisplayName(value: string) {
  return value.split(",")[0]?.trim() ?? value;
}

function formatPopulation(value: number | string) {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat("en-US").format(
    Number.isFinite(numeric)
      ? numeric
      : 0,
  );
}

export function PriorityQueue({
  initialCounties,
  expectedCount,
}: PriorityQueueProps) {
  const [counties, setCounties] =
    useState<PriorityCounty[]>(
      initialCounties,
    );

  const [loadingFullList, setLoadingFullList] =
    useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [state, setState] =
    useState("ALL");

  const [priority, setPriority] =
    useState("ALL");

  const [hazard, setHazard] =
    useState("ALL");

  const [contextDriver, setContextDriver] =
    useState("ALL");

  const [sortBy, setSortBy] =
    useState("priority-score");

  useEffect(() => {
    let active = true;
    const controller =
      new AbortController();

    async function loadAllCounties() {
      try {
        setLoadingFullList(true);
        setLoadError(null);

        const response =
          await fetch(
            "/api/map",
            {
              cache: "no-store",
              signal:
                controller.signal,
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
              "Unable to load the complete county priority list.",
          );
        }

        if (!active) {
          return;
        }

        setCounties(
          payload.data,
        );
      } catch (error) {
        if (
          !active ||
          controller.signal.aborted
        ) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load the complete county priority list.",
        );
      } finally {
        if (active) {
          setLoadingFullList(
            false,
          );
        }
      }
    }

    void loadAllCounties();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const states =
    useMemo(
      () =>
        Array.from(
          new Set(
            counties
              .map(
                (county) =>
                  county.state,
              )
              .filter(Boolean),
          ),
        ).sort(),
      [
        counties,
      ],
    );

  const priorities =
    useMemo(
      () => {
        const available =
          new Set(
            counties
              .map(
                (county) =>
                  county
                    .operational_priority_level,
              )
              .filter(Boolean),
          );

        return PRIORITY_ORDER
          .filter(
            (item) =>
              available.has(
                item,
              ),
          );
      },
      [
        counties,
      ],
    );

  const hazards =
    useMemo(
      () =>
        Array.from(
          new Set(
            counties
              .map(
                (county) =>
                  county
                    .dominant_event,
              )
              .filter(Boolean),
          ),
        ).sort(),
      [
        counties,
      ],
    );

  const contextDrivers =
    useMemo(
      () =>
        Array.from(
          new Set(
            counties
              .map(
                (county) =>
                  county
                    .dominant_context_driver,
              )
              .filter(Boolean),
          ),
        ).sort(),
      [
        counties,
      ],
    );

  const filteredCounties =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        const filtered =
          counties.filter(
            (county) => {
              const matchesSearch =
                !query ||
                county
                  .county_full_name
                  .toLowerCase()
                  .includes(
                    query,
                  ) ||
                county
                  .state
                  .toLowerCase()
                  .includes(
                    query,
                  ) ||
                county
                  .dominant_event
                  .toLowerCase()
                  .includes(
                    query,
                  ) ||
                county
                  .dominant_context_driver
                  .toLowerCase()
                  .includes(
                    query,
                  );

              const matchesState =
                state ===
                  "ALL" ||
                county.state ===
                  state;

              const matchesPriority =
                priority ===
                  "ALL" ||
                county
                  .operational_priority_level ===
                  priority;

              const matchesHazard =
                hazard ===
                  "ALL" ||
                county
                  .dominant_event ===
                  hazard;

              const matchesContext =
                contextDriver ===
                  "ALL" ||
                county
                  .dominant_context_driver ===
                  contextDriver;

              return (
                matchesSearch &&
                matchesState &&
                matchesPriority &&
                matchesHazard &&
                matchesContext
              );
            },
          );

        const sorted =
          [
            ...filtered,
          ];

        sorted.sort(
          (
            a,
            b,
          ) => {
            if (
              sortBy ===
              "rank"
            ) {
              return (
                Number(
                  a.national_operational_rank,
                ) -
                Number(
                  b.national_operational_rank,
                )
              );
            }

            if (
              sortBy ===
              "population"
            ) {
              return (
                Number(
                  b.population,
                ) -
                Number(
                  a.population,
                )
              );
            }

            if (
              sortBy ===
              "alerts"
            ) {
              return (
                Number(
                  b.active_alerts,
                ) -
                Number(
                  a.active_alerts,
                )
              );
            }

            if (
              sortBy ===
              "county"
            ) {
              return a
                .county_full_name
                .localeCompare(
                  b.county_full_name,
                );
            }

            return (
              Number(
                b.operational_priority_score,
              ) -
              Number(
                a.operational_priority_score,
              )
            );
          },
        );

        return sorted;
      },
      [
        counties,
        contextDriver,
        hazard,
        priority,
        search,
        sortBy,
        state,
      ],
    );

  const distribution =
    useMemo(
      () => {
        const counts =
          new Map<
            string,
            number
          >();

        for (
          const county
          of filteredCounties
        ) {
          const key =
            county
              .operational_priority_level;

          counts.set(
            key,
            (
              counts.get(
                key,
              ) ?? 0
            ) + 1,
          );
        }

        return counts;
      },
      [
        filteredCounties,
      ],
    );

  const hasFilters =
    search.length > 0 ||
    state !== "ALL" ||
    priority !== "ALL" ||
    hazard !== "ALL" ||
    contextDriver !==
      "ALL";

  function clearFilters() {
    setSearch("");
    setState("ALL");
    setPriority("ALL");
    setHazard("ALL");
    setContextDriver(
      "ALL",
    );
    setSortBy(
      "priority-score",
    );
  }

  const loadedCount =
    counties.length;

  const complete =
    !expectedCount ||
    loadedCount >=
      expectedCount;

  return (
    <>
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Filter className="h-4 w-4 text-cyan-300" />
              National Priority Queue
            </div>

            <div className="mt-1 text-xs text-slate-400">
              Search, filter, and rank currently affected counties by operational urgency
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-medium text-slate-400">
              Showing{" "}
              <span className="font-bold text-slate-100">
                {filteredCounties.length.toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-100">
                {counties.length.toLocaleString()}
              </span>
            </div>

            <div
              className={`mt-1 text-[10px] font-semibold ${
                complete
                  ? "text-emerald-300"
                  : "text-amber-300"
              }`}
            >
              {loadingFullList
                ? "Loading complete county list..."
                : complete
                  ? `${loadedCount.toLocaleString()} counties loaded`
                  : `${loadedCount.toLocaleString()} of ${expectedCount?.toLocaleString()} expected counties loaded`}
            </div>
          </div>
        </div>

        {loadError && (
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
            Full-list refresh failed. Showing the available server-side priority records.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {PRIORITY_ORDER.map(
            (level) => {
              const count =
                distribution.get(
                  level,
                ) ?? 0;

              return (
                <DistributionChip
                  key={
                    level
                  }
                  level={
                    level
                  }
                  count={
                    count
                  }
                />
              );
            },
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(230px,1.4fr)_repeat(4,minmax(145px,0.75fr))_minmax(150px,0.8fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <input
              value={
                search
              }
              onChange={(
                event,
              ) =>
                setSearch(
                  event
                    .target
                    .value,
                )
              }
              placeholder="Search county, state, hazard..."
              className="h-10 w-full rounded-xl border border-white/10 bg-[#071018] pl-9 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/35"
            />
          </div>

          <select
            value={
              state
            }
            onChange={(
              event,
            ) =>
              setState(
                event
                  .target
                  .value,
              )
            }
            className="h-10 rounded-xl border border-white/10 bg-[#071018] px-3 text-xs font-medium text-slate-200 outline-none focus:border-cyan-400/35"
          >
            <option value="ALL">
              All states
            </option>

            {states.map(
              (item) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {item}
                </option>
              ),
            )}
          </select>

          <select
            value={
              priority
            }
            onChange={(
              event,
            ) =>
              setPriority(
                event
                  .target
                  .value,
              )
            }
            className="h-10 rounded-xl border border-white/10 bg-[#071018] px-3 text-xs font-medium text-slate-200 outline-none focus:border-cyan-400/35"
          >
            <option value="ALL">
              All priorities
            </option>

            {priorities.map(
              (item) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {item}
                </option>
              ),
            )}
          </select>

          <select
            value={
              hazard
            }
            onChange={(
              event,
            ) =>
              setHazard(
                event
                  .target
                  .value,
              )
            }
            className="h-10 rounded-xl border border-white/10 bg-[#071018] px-3 text-xs font-medium text-slate-200 outline-none focus:border-cyan-400/35"
          >
            <option value="ALL">
              All hazards
            </option>

            {hazards.map(
              (item) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {item}
                </option>
              ),
            )}
          </select>

          <select
            value={
              contextDriver
            }
            onChange={(
              event,
            ) =>
              setContextDriver(
                event
                  .target
                  .value,
              )
            }
            className="h-10 rounded-xl border border-white/10 bg-[#071018] px-3 text-xs font-medium text-slate-200 outline-none focus:border-cyan-400/35"
          >
            <option value="ALL">
              All context drivers
            </option>

            {contextDrivers.map(
              (item) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {item}
                </option>
              ),
            )}
          </select>

          <select
            value={
              sortBy
            }
            onChange={(
              event,
            ) =>
              setSortBy(
                event
                  .target
                  .value,
              )
            }
            className="h-10 rounded-xl border border-white/10 bg-[#071018] px-3 text-xs font-medium text-slate-200 outline-none focus:border-cyan-400/35"
          >
            <option value="priority-score">
              Sort: Priority score
            </option>
            <option value="rank">
              Sort: National rank
            </option>
            <option value="population">
              Sort: Population
            </option>
            <option value="alerts">
              Sort: Active alerts
            </option>
            <option value="county">
              Sort: County A–Z
            </option>
          </select>

          <button
            type="button"
            onClick={
              clearFilters
            }
            disabled={
              !hasFilters &&
              sortBy ===
                "priority-score"
            }
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[1120px]">
          <thead className="sticky top-0 z-20 bg-[#0a1722] shadow-[0_1px_0_rgba(255,255,255,0.08)]">
            <tr className="text-left">
              <TableHead>
                Rank
              </TableHead>
              <TableHead>
                County
              </TableHead>
              <TableHead>
                Current Hazard
              </TableHead>
              <TableHead>
                Alerts
              </TableHead>
              <TableHead>
                Population
              </TableHead>
              <TableHead>
                Main Context Driver
              </TableHead>
              <TableHead>
                Priority
              </TableHead>
              <TableHead align="right">
                Score
              </TableHead>
            </tr>
          </thead>

          <tbody>
            {filteredCounties.map(
              (
                county,
              ) => (
                <tr
                  key={
                    county
                      .county_fips
                  }
                  className="border-b border-white/[0.07] last:border-0 hover:bg-white/[0.035]"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-bold text-slate-300">
                      {
                        county
                          .national_operational_rank
                      }
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="text-sm font-semibold text-white">
                      {countyDisplayName(
                        county
                          .county_full_name,
                      )}
                    </div>

                    <div className="mt-1 text-xs font-medium text-slate-400">
                      {
                        county
                          .state
                      }
                    </div>
                  </td>

                  <td className="max-w-[220px] px-4 py-3.5">
                    <div className="truncate text-sm font-medium text-slate-200">
                      {
                        county
                          .dominant_event
                      }
                    </div>

                    <div className="mt-1 text-[11px] font-semibold text-amber-300">
                      {
                        county
                          .hazard_level
                      }
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="text-sm font-bold text-white">
                      {Number(
                        county
                          .active_alerts ??
                          0,
                      ).toLocaleString()}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      active
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-sm font-medium text-slate-300">
                    {formatPopulation(
                      county
                        .population,
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="inline-flex max-w-[220px] truncate rounded-lg border border-cyan-400/15 bg-cyan-400/[0.05] px-2.5 py-1 text-xs font-medium text-cyan-100">
                      {
                        county
                          .dominant_context_driver
                      }
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <PriorityBadge
                      level={
                        county
                          .operational_priority_level
                      }
                    />
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <div className="text-sm font-bold text-white">
                      {Number(
                        county
                          .operational_priority_score,
                      ).toFixed(
                        2,
                      )}
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500">
                      / 100
                    </div>
                  </td>
                </tr>
              ),
            )}

            {filteredCounties.length ===
              0 && (
              <tr>
                <td
                  colSpan={
                    8
                  }
                  className="px-5 py-16 text-center"
                >
                  <div className="text-sm font-semibold text-slate-200">
                    No counties match the current filters
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Clear or adjust the filters to restore the priority queue.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 bg-[#08131d]/70 px-5 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Scroll vertically to review the full national queue.
        </span>

        <span>
          Default ordering: highest operational priority score first.
        </span>
      </div>
    </>
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
      className={`px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400 ${
        align ===
        "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function DistributionChip({
  level,
  count,
}: {
  level: string;
  count: number;
}) {
  const normalized =
    level.toUpperCase();

  const classes =
    normalized ===
    "CRITICAL"
      ? "border-red-400/20 bg-red-400/[0.07] text-red-300"
      : normalized ===
          "HIGH"
        ? "border-orange-400/20 bg-orange-400/[0.07] text-orange-300"
        : normalized ===
            "ELEVATED"
          ? "border-amber-300/20 bg-amber-300/[0.07] text-amber-200"
          : normalized ===
              "MODERATE"
            ? "border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300"
            : "border-slate-400/15 bg-slate-400/[0.06] text-slate-300";

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${classes}`}
    >
      {normalized}{" "}
      <span className="ml-1 text-white">
        {count.toLocaleString()}
      </span>
    </div>
  );
}

function PriorityBadge({
  level,
}: {
  level: string;
}) {
  const normalized =
    level.toUpperCase();

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
