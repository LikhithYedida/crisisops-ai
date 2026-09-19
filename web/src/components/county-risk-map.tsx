"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { feature } from "topojson-client";
import countiesAtlas from "us-atlas/counties-10m.json";
import type { FeatureCollection } from "geojson";
import type { MapCounty } from "@/lib/map-data";

maplibregl.setWorkerUrl(
  "/maplibre/maplibre-gl-worker.mjs",
);

type MapApiResponse = {
  success: boolean;
  generatedAt?: string;
  count?: number;
  data?: MapCounty[];
  error?: string;
};

type AtlasTopology = {
  objects: {
    counties: never;
    states: never;
    nation: never;
  };
};

const COUNTY_SOURCE_ID = "crisisops-counties";
const STATE_SOURCE_ID = "crisisops-states";
const NATION_SOURCE_ID = "crisisops-nation";

const COUNTY_FILL_LAYER_ID = "county-risk-fill";
const COUNTY_LINE_LAYER_ID = "county-risk-lines";
const STATE_LINE_LAYER_ID = "state-boundaries";
const NATION_LINE_LAYER_ID = "national-outline";

/* ============================================================
   Helpers
   ============================================================ */

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function formatPopulation(value: unknown): string {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat("en-US").format(
    Number.isFinite(number) ? number : 0,
  );
}

/* ============================================================
   County GeoJSON
   ============================================================ */

function buildCountyGeoJson(
  countyData: MapCounty[],
): FeatureCollection {
  const topology =
    countiesAtlas as unknown as AtlasTopology;

  const atlas = feature(
    countiesAtlas as never,
    topology.objects.counties,
  ) as unknown as FeatureCollection;

  const countyLookup =
    new Map<string, MapCounty>();

  for (const county of countyData) {
    const countyFips = String(
      county.county_fips ?? "",
    ).padStart(5, "0");

    if (countyFips.length === 5) {
      countyLookup.set(
        countyFips,
        county,
      );
    }
  }

  return {
    type: "FeatureCollection",

    features: atlas.features.map(
      (countyFeature) => {
        const countyFips = String(
          countyFeature.id ?? "",
        ).padStart(5, "0");

        const risk =
          countyLookup.get(
            countyFips,
          );

        return {
          ...countyFeature,

          id: countyFips,

          properties: {
            ...(
              countyFeature.properties ??
              {}
            ),

            county_fips:
              countyFips,

            is_active:
              Boolean(risk),

            county_full_name:
              risk?.county_full_name ??
              "",

            state:
              risk?.state ??
              "",

            population:
              risk?.population ??
              0,

            active_alerts:
              risk?.active_alerts ??
              0,

            severe_or_extreme_alerts:
              risk?.severe_or_extreme_alerts ??
              0,

            dominant_event:
              risk?.dominant_event ??
              "",

            hazard_level:
              risk?.hazard_level ??
              "",

            operational_priority_score:
              risk?.operational_priority_score ??
              0,

            operational_priority_level:
              risk?.operational_priority_level ??
              "NONE",

            national_operational_rank:
              risk?.national_operational_rank ??
              0,

            dominant_context_driver:
              risk?.dominant_context_driver ??
              "",
          },
        };
      },
    ),
  };
}

/* ============================================================
   State GeoJSON
   ============================================================ */

function buildStateGeoJson():
FeatureCollection {
  const topology =
    countiesAtlas as unknown as AtlasTopology;

  return feature(
    countiesAtlas as never,
    topology.objects.states,
  ) as unknown as FeatureCollection;
}

/* ============================================================
   National GeoJSON
   ============================================================ */

function buildNationGeoJson():
FeatureCollection {
  const topology =
    countiesAtlas as unknown as AtlasTopology;

  return feature(
    countiesAtlas as never,
    topology.objects.nation,
  ) as unknown as FeatureCollection;
}

/* ============================================================
   Popup
   ============================================================ */

function createPopupContent(
  properties: Record<
    string,
    unknown
  >,
): HTMLDivElement {
  const wrapper =
    document.createElement(
      "div",
    );

  wrapper.style.minWidth =
    "245px";

  wrapper.style.padding =
    "4px 2px";

  wrapper.style.fontFamily =
    "inherit";

  const rank =
    document.createElement(
      "div",
    );

  rank.textContent =
    `NATIONAL RANK #${
      properties
        .national_operational_rank ??
      "-"
    }`;

  rank.style.fontSize =
    "10px";

  rank.style.fontWeight =
    "700";

  rank.style.letterSpacing =
    "0.12em";

  rank.style.textTransform =
    "uppercase";

  rank.style.color =
    "#67e8f9";

  rank.style.marginBottom =
    "5px";

  const title =
    document.createElement(
      "div",
    );

  title.textContent =
    String(
      properties
        .county_full_name ??
      "County",
    );

  title.style.fontSize =
    "16px";

  title.style.fontWeight =
    "700";

  title.style.color =
    "#f8fafc";

  title.style.marginBottom =
    "8px";

  const priority =
    document.createElement(
      "div",
    );

  const priorityScore =
    Number(
      properties
        .operational_priority_score ??
      0,
    ).toFixed(2);

  priority.textContent =
    `${
      properties
        .operational_priority_level ??
      "N/A"
    } PRIORITY • ${priorityScore}`;

  priority.style.display =
    "inline-block";

  priority.style.fontSize =
    "11px";

  priority.style.fontWeight =
    "700";

  priority.style.color =
    "#ffffff";

  priority.style.padding =
    "4px 7px";

  priority.style.marginBottom =
    "10px";

  priority.style.borderRadius =
    "6px";

  priority.style.background =
    "rgba(255,255,255,0.08)";

  priority.style.border =
    "1px solid rgba(255,255,255,0.12)";

  function addRow(
    label: string,
    value: string,
  ) {
    const row =
      document.createElement(
        "div",
      );

    row.style.fontSize =
      "12px";

    row.style.lineHeight =
      "1.6";

    row.style.color =
      "#cbd5e1";

    const strong =
      document.createElement(
        "span",
      );

    strong.textContent =
      `${label}: `;

    strong.style.color =
      "#94a3b8";

    strong.style.fontWeight =
      "600";

    const valueSpan =
      document.createElement(
        "span",
      );

    valueSpan.textContent =
      value;

    valueSpan.style.color =
      "#f1f5f9";

    row.append(
      strong,
      valueSpan,
    );

    wrapper.appendChild(
      row,
    );
  }

  wrapper.append(
    rank,
    title,
    priority,
  );

  addRow(
    "Current hazard",
    String(
      properties
        .dominant_event ||
      "No current hazard",
    ),
  );

  addRow(
    "Hazard level",
    String(
      properties
        .hazard_level ||
      "N/A",
    ),
  );

  addRow(
    "Active alerts",
    String(
      properties
        .active_alerts ??
      0,
    ),
  );

  addRow(
    "Main risk factor",
    String(
      properties
        .dominant_context_driver ||
      "N/A",
    ),
  );

  addRow(
    "Population",
    formatPopulation(
      properties.population,
    ),
  );

  return wrapper;
}

/* ============================================================
   Component
   ============================================================ */

export function CountyRiskMap() {
  const containerRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null,
    );

  const mapRef =
    useRef<
      maplibregl.Map |
      null
    >(
      null,
    );

  const [
    counties,
    setCounties,
  ] =
    useState<MapCounty[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    mapLoaded,
    setMapLoaded,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  /* ==========================================================
     Load county risk data
     ========================================================== */

  useEffect(
    () => {
      let active =
        true;

      const controller =
        new AbortController();

      async function loadData() {
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
              await response
                .json()
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
                "Unable to load county risk data.",
            );
          }

          if (
            !active
          ) {
            return;
          }

          setCounties(
            payload.data,
          );
        } catch (
          caughtError
        ) {
          if (
            !active ||
            controller
              .signal
              .aborted
          ) {
            return;
          }

          const message =
            caughtError
              instanceof Error
              ? caughtError
                  .message
              : "Unable to load county risk data.";

          console.error(
            "County risk data error:",
            caughtError,
          );

          setError(
            message,
          );
        } finally {
          if (
            active
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      void loadData();

      return () => {
        active =
          false;

        controller
          .abort();
      };
    },
    [],
  );

  /* ==========================================================
     Build map datasets
     ========================================================== */

  const countyGeoJson =
    useMemo(
      () => {
        if (
          counties.length ===
          0
        ) {
          return null;
        }

        return buildCountyGeoJson(
          counties,
        );
      },
      [
        counties,
      ],
    );

  const stateGeoJson =
    useMemo(
      () =>
        buildStateGeoJson(),
      [],
    );

  const nationGeoJson =
    useMemo(
      () =>
        buildNationGeoJson(),
      [],
    );

  /* ==========================================================
     Create MapLibre map
     ========================================================== */

  useEffect(
    () => {
      if (
        !containerRef.current ||
        !countyGeoJson ||
        mapRef.current
      ) {
        return;
      }

      const container =
        containerRef.current;

      setMapLoaded(
        false,
      );

      const map = new maplibregl.Map({
        container: container,

  style: {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#07131d",
        },
      },
    ],
  },

  center: [-98.5, 38.5],
  zoom: 3.2,

  // IMPORTANT — normal dashboard interaction
  interactive: true,

  scrollZoom: true,
  dragPan: true,
  doubleClickZoom: true,
  keyboard: true,
  touchZoomRotate: true,

  // Keep this FALSE.
  // true makes normal scrolling/pinching intentionally harder.
  cooperativeGestures: false,

  // We don't need 3D rotation for CrisisOps.
  dragRotate: false,
  touchPitch: false,

  attributionControl: false,
});


      mapRef.current =
        map;

      /* --------------------------------------------------------
         Controls
         -------------------------------------------------------- */

      map.addControl(
        new maplibregl
          .NavigationControl(
            {
              showCompass:
                false,

              showZoom:
                true,
            },
          ),

        "top-right",
      );

      map.addControl(
        new maplibregl
          .AttributionControl(
            {
              compact:
                true,

              customAttribution:
                "County boundaries: U.S. Census",
            },
          ),

        "bottom-right",
      );

      map.dragRotate
        .disable();

      map.touchZoomRotate
        .disableRotation();

      /* --------------------------------------------------------
         Resize
         -------------------------------------------------------- */

      const resizeObserver =
        new ResizeObserver(
          () => {
            map.resize();
          },
        );

      resizeObserver
        .observe(
          container,
        );

      /* --------------------------------------------------------
         Popup
         -------------------------------------------------------- */

      const popup =
        new maplibregl.Popup(
          {
            closeButton:
              false,

            closeOnClick:
              false,

            offset:
              14,

            maxWidth:
              "320px",

            className:
              "crisisops-map-popup",
          },
        );

      let hoveredCounty:
        string |
        number |
        null =
        null;

      function clearHoveredCounty() {
        if (
          hoveredCounty !==
            null &&
          map.getSource(
            COUNTY_SOURCE_ID,
          )
        ) {
          map.setFeatureState(
            {
              source:
                COUNTY_SOURCE_ID,

              id:
                hoveredCounty,
            },

            {
              hover:
                false,
            },
          );
        }

        hoveredCounty =
          null;
      }

      /* --------------------------------------------------------
         County hover
         -------------------------------------------------------- */

      const handleCountyMove =
        (
          event:
            maplibregl
              .MapLayerMouseEvent,
        ) => {
          const featureItem =
            event
              .features?.[0];

          if (
            !featureItem
          ) {
            return;
          }

          const props =
            (
              featureItem
                .properties ??
              {}
            ) as Record<
              string,
              unknown
            >;

          const isActive =
            normalizeBoolean(
              props
                .is_active,
            );

          if (
            !isActive
          ) {
            map
              .getCanvas()
              .style
              .cursor =
              "";

            clearHoveredCounty();

            popup
              .remove();

            return;
          }

          map
            .getCanvas()
            .style
            .cursor =
            "pointer";

          if (
            hoveredCounty !==
            featureItem.id
          ) {
            clearHoveredCounty();

            hoveredCounty =
              featureItem.id ??
              null;

            if (
              hoveredCounty !==
              null
            ) {
              map.setFeatureState(
                {
                  source:
                    COUNTY_SOURCE_ID,

                  id:
                    hoveredCounty,
                },

                {
                  hover:
                    true,
                },
              );
            }
          }

          popup
            .setLngLat(
              event.lngLat,
            )
            .setDOMContent(
              createPopupContent(
                props,
              ),
            )
            .addTo(
              map,
            );
        };

      /* --------------------------------------------------------
         County mouse leave
         -------------------------------------------------------- */

      const handleCountyLeave =
        () => {
          map
            .getCanvas()
            .style
            .cursor =
            "";

          clearHoveredCounty();

          popup
            .remove();
        };

      /* --------------------------------------------------------
         County click
         -------------------------------------------------------- */

      const handleCountyClick =
        (
          event:
            maplibregl
              .MapLayerMouseEvent,
        ) => {
          const featureItem =
            event
              .features?.[0];

          if (
            !featureItem
          ) {
            return;
          }

          const props =
            (
              featureItem
                .properties ??
              {}
            ) as Record<
              string,
              unknown
            >;

          if (
            !normalizeBoolean(
              props
                .is_active,
            )
          ) {
            return;
          }

          popup
            .setLngLat(
              event.lngLat,
            )
            .setDOMContent(
              createPopupContent(
                props,
              ),
            )
            .addTo(
              map,
            );
        };

      /* --------------------------------------------------------
         Map load
         -------------------------------------------------------- */

      const handleMapLoad =
        () => {
          /* County source */

          if (
            !map.getSource(
              COUNTY_SOURCE_ID,
            )
          ) {
            map.addSource(
              COUNTY_SOURCE_ID,
              {
                type:
                  "geojson",

                data:
                  countyGeoJson,

                promoteId:
                    "county_flips"
              },
            );
          }

          /* State source */

          if (
            !map.getSource(
              STATE_SOURCE_ID,
            )
          ) {
            map.addSource(
              STATE_SOURCE_ID,
              {
                type:
                  "geojson",

                data:
                  stateGeoJson,
              },
            );
          }

          /* National source */

          if (
            !map.getSource(
              NATION_SOURCE_ID,
            )
          ) {
            map.addSource(
              NATION_SOURCE_ID,
              {
                type:
                  "geojson",

                data:
                  nationGeoJson,
              },
            );
          }

          /* ====================================================
             County risk fill
             ==================================================== */

          if (
            !map.getLayer(
              COUNTY_FILL_LAYER_ID,
            )
          ) {
            map.addLayer(
              {
                id:
                  COUNTY_FILL_LAYER_ID,

                type:
                  "fill",

                source:
                  COUNTY_SOURCE_ID,

                paint: {
                  "fill-color":
                    [
                      "match",

                      [
                        "get",
                        "operational_priority_level",
                      ],

                      "CRITICAL",
                      "#ef4444",

                      "HIGH",
                      "#f97316",

                      "ELEVATED",
                      "#facc15",

                      "MODERATE",
                      "#22d3ee",

                      "LOW",
                      "#64748b",

                      "#102433",
                    ],

                  "fill-opacity":
                    [
                      "case",

                      [
                        "boolean",
                        [
                          "feature-state",
                          "hover",
                        ],
                        false,
                      ],

                      0.98,

                      [
                        "boolean",
                        [
                          "get",
                          "is_active",
                        ],
                        false,
                      ],

                      0.86,

                      0.16,
                    ],
                },
              },
            );
          }

          /* ====================================================
             County boundaries
             ==================================================== */

          if (
            !map.getLayer(
              COUNTY_LINE_LAYER_ID,
            )
          ) {
            map.addLayer(
              {
                id:
                  COUNTY_LINE_LAYER_ID,

                type:
                  "line",

                source:
                  COUNTY_SOURCE_ID,

                paint: {
                  "line-color":
                    [
                      "case",

                      [
                        "boolean",
                        [
                          "get",
                          "is_active",
                        ],
                        false,
                      ],

                      "#88a8ba",

                      "#223947",
                    ],

                  "line-width":
                    [
                      "case",

                      [
                        "boolean",
                        [
                          "feature-state",
                          "hover",
                        ],
                        false,
                      ],

                      2.2,

                      [
                        "boolean",
                        [
                          "get",
                          "is_active",
                        ],
                        false,
                      ],

                      0.65,

                      0.35,
                    ],

                  "line-opacity":
                    [
                      "case",

                      [
                        "boolean",
                        [
                          "get",
                          "is_active",
                        ],
                        false,
                      ],

                      0.95,

                      0.48,
                    ],
                },
              },
            );
          }

          /* ====================================================
             State boundaries
             ==================================================== */

          if (
            !map.getLayer(
              STATE_LINE_LAYER_ID,
            )
          ) {
            map.addLayer(
              {
                id:
                  STATE_LINE_LAYER_ID,

                type:
                  "line",

                source:
                  STATE_SOURCE_ID,

                paint: {
                  "line-color":
                    "#d5e5f0",

                  "line-width":
                    1.05,

                  "line-opacity":
                    0.6,
                },
              },
            );
          }

          /* ====================================================
             National outline
             ==================================================== */

          if (
            !map.getLayer(
              NATION_LINE_LAYER_ID,
            )
          ) {
            map.addLayer(
              {
                id:
                  NATION_LINE_LAYER_ID,

                type:
                  "line",

                source:
                  NATION_SOURCE_ID,

                paint: {
                  "line-color":
                    "#f8fafc",

                  "line-width":
                    1.45,

                  "line-opacity":
                    0.65,
                },
              },
            );
          }

          /* ====================================================
             Interaction events
             ==================================================== */

          map.on(
            "mousemove",
            COUNTY_FILL_LAYER_ID,
            handleCountyMove,
          );

          map.on(
            "mouseleave",
            COUNTY_FILL_LAYER_ID,
            handleCountyLeave,
          );

          map.on(
            "click",
            COUNTY_FILL_LAYER_ID,
            handleCountyClick,
          );

          /* ====================================================
             Continental U.S. viewport
             ==================================================== */

          map.fitBounds(
            [
              [
                -125,
                24,
              ],

              [
                -66.5,
                50,
              ],
            ],

            {
              padding:
                container.clientWidth < 768
                  ? 12
                  : 28,

              duration:
                0,
            },
          );

          requestAnimationFrame(
            () => {
              map.resize();
            },
          );

          setMapLoaded(
            true,
          );
        };

      /* --------------------------------------------------------
         Map error logging
         -------------------------------------------------------- */

      const handleMapError =
        (
          event:
            maplibregl
              .ErrorEvent,
        ) => {
          console.error(
            "MapLibre error:",
            event.error,
          );
        };

      map.on(
        "load",
        handleMapLoad,
      );

      map.on(
        "error",
        handleMapError,
      );

      /* --------------------------------------------------------
         Cleanup
         -------------------------------------------------------- */

      return () => {
        resizeObserver
          .disconnect();

        popup
          .remove();

        if (
          map.getLayer(
            COUNTY_FILL_LAYER_ID,
          )
        ) {
          map.off(
            "mousemove",
            COUNTY_FILL_LAYER_ID,
            handleCountyMove,
          );

          map.off(
            "mouseleave",
            COUNTY_FILL_LAYER_ID,
            handleCountyLeave,
          );

          map.off(
            "click",
            COUNTY_FILL_LAYER_ID,
            handleCountyClick,
          );
        }

        map.off(
          "load",
          handleMapLoad,
        );

        map.off(
          "error",
          handleMapError,
        );

        map.remove();

        mapRef.current =
          null;
      };
    },
    [
      countyGeoJson,
      stateGeoJson,
      nationGeoJson,
    ],
  );

  /* ==========================================================
     UI
     ========================================================== */

  return (
    <div
      className="
        crisisops-map
        relative
        h-full
        min-h-[360px]
        sm:min-h-[400px]
        md:min-h-[470px]
        w-full
        overflow-hidden
        bg-[#071018]
      "
    >
      {/* Actual MapLibre map */}

      <div
        ref={containerRef}
        className="
          absolute
          inset-0
          h-full
          min-h-[360px]
          sm:min-h-[400px]
          md:min-h-[470px]
          w-full
        "
        aria-label="Interactive U.S. county disaster risk map"
      />

      {/* Loading state */}

      {(loading ||
        !mapLoaded) &&
        !error && (
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              z-20
              flex
              items-center
              justify-center
              bg-[#071018]
            "
          >
            <div
              className="
                text-center
              "
            >
              <div
                className="
                  mx-auto
                  h-8
                  w-8
                  animate-spin
                  rounded-full
                  border-2
                  border-cyan-300/20
                  border-t-cyan-300
                "
              />

              <div
                className="
                  mt-4
                  text-sm
                  font-semibold
                  text-slate-100
                "
              >
                Loading U.S. county risk map
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >
                Matching live hazards to county risk scores
              </div>
            </div>
          </div>
        )}

      {/* Error state */}

      {error && (
        <div
          className="
            absolute
            inset-0
            z-30
            flex
            items-center
            justify-center
            bg-[#071018]
          "
        >
          <div
            className="
              max-w-sm
              px-6
              text-center
            "
          >
            <div
              className="
                text-sm
                font-semibold
                text-red-300
              "
            >
              County map unavailable
            </div>

            <div
              className="
                mt-2
                text-xs
                leading-5
                text-slate-300
              "
            >
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Active county count */}

      {mapLoaded &&
        !error && (
          <div
            className="
              pointer-events-none
              absolute
              left-4
              top-4
              z-10
              rounded-xl
              border
              border-white/10
              bg-[#071018]/95
              px-4
              py-3
              shadow-xl
              backdrop-blur
            "
          >
            <div
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.13em]
                text-slate-300
              "
            >
              Counties with active hazards
            </div>

            <div
              className="
                mt-1
                text-lg
                font-bold
                text-white
              "
            >
              {
                counties.length
                  .toLocaleString()
              }
            </div>
          </div>
        )}
    </div>
  );
}