"use client";

import {
  useState,
} from "react";

import {
  RefreshCw,
} from "lucide-react";


type RefreshResponse = {
  success:
    boolean;

  message?:
    string;

  error?:
    string;
};


export function DashboardRefreshButton() {

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    );


  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );


  /*
  |--------------------------------------------------------------------------
  | Environment
  |--------------------------------------------------------------------------
  |
  | LOCAL DEVELOPMENT
  |
  | The button is allowed to run the full CrisisOps refresh pipeline:
  |
  | Python ingestion
  |      ↓
  | BigQuery raw tables
  |      ↓
  | dbt models
  |      ↓
  | dbt tests
  |      ↓
  | metadata + health marts
  |
  |
  | PRODUCTION
  |
  | The public dashboard must never launch Python or dbt.
  |
  | It simply reloads the application so the newest data already available
  | in BigQuery is displayed.
  |
  */

  const isProduction =
    process.env.NODE_ENV ===
    "production";


  async function handleRefresh() {

    if (
      refreshing
    ) {
      return;
    }


    /*
    |------------------------------------------------------------------------
    | Production behavior
    |------------------------------------------------------------------------
    |
    | Do NOT call /api/refresh.
    |
    | The production data pipeline will run independently from the website.
    |
    | Reloading the page also ensures client-side requests such as /api/map
    | are fetched again, which is important for County Intelligence.
    |
    */

    if (
      isProduction
    ) {

      setRefreshing(
        true,
      );

      setError(
        null,
      );


      window.location.reload();


      return;
    }


    /*
    |------------------------------------------------------------------------
    | Local development behavior
    |------------------------------------------------------------------------
    */

    try {

      setRefreshing(
        true,
      );

      setError(
        null,
      );


      const response =
        await fetch(
          "/api/refresh",
          {
            method:
              "POST",

            cache:
              "no-store",
          },
        );


      const result =
        (
          await response.json()
        ) as RefreshResponse;


      if (
        !response.ok ||
        !result.success
      ) {

        throw new Error(
          result.error ??
            "The data refresh could not be completed.",
        );
      }


      /*
       * The local refresh endpoint has now:
       *
       * - refreshed live source data
       * - rebuilt dbt models
       * - run validation tests
       * - updated dbt metadata
       * - updated ingestion metadata
       * - rebuilt freshness / health marts
       *
       * Reload the full application so server-rendered data
       * and client-side API data are both fetched again.
       */

      window.location.reload();

    } catch (
      caughtError
    ) {

      console.error(
        "CrisisOps refresh failed:",
        caughtError,
      );


      setError(
        caughtError instanceof
        Error
          ? caughtError.message
          : "The data refresh could not be completed.",
      );


      setRefreshing(
        false,
      );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | Button wording
  |--------------------------------------------------------------------------
  */

  const buttonLabel =
    refreshing
      ? (
        isProduction
          ? "Reloading..."
          : "Updating data..."
      )
      : (
        isProduction
          ? "Reload view"
          : "Refresh data"
      );


  const buttonTitle =
    refreshing
      ? (
        isProduction
          ? "Reloading the latest available CrisisOps data"
          : "Updating CrisisOps data"
      )
      : (
        isProduction
          ? "Reload the latest available dashboard data"
          : "Refresh CrisisOps source data and rebuild the pipeline"
      );


  return (
    <div className="relative">


      {/* ======================================================
          REFRESH / RELOAD BUTTON
          ====================================================== */}

      <button
        type="button"
        onClick={
          handleRefresh
        }
        disabled={
          refreshing
        }
        title={
          buttonTitle
        }
        className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
          refreshing
            ? "cursor-wait border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200"
            : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-400/25 hover:bg-cyan-400/[0.06] hover:text-cyan-200"
        }`}
      >

        <RefreshCw
          className={`h-3.5 w-3.5 ${
            refreshing
              ? "animate-spin"
              : ""
          }`}
        />


        <span className="hidden lg:inline">
          {
            buttonLabel
          }
        </span>

      </button>


      {/* ======================================================
          LOCAL REFRESH ERROR
          ====================================================== */}

      {error && (

        <div className="absolute right-0 top-12 z-[60] w-[320px] rounded-xl border border-red-400/20 bg-[#11151d] p-3 shadow-2xl shadow-black/40">

          <div className="text-xs font-semibold text-red-300">
            Data refresh failed
          </div>


          <div className="mt-1.5 text-[11px] leading-5 text-slate-400">
            {
              error
            }
          </div>


          <button
            type="button"
            onClick={() =>
              setError(
                null,
              )
            }
            className="mt-2 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Dismiss
          </button>

        </div>

      )}

    </div>
  );
}