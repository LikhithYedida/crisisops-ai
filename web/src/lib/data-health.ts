import { runBigQuery } from "@/lib/bigquery";


const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  "crisisops-intelligence";

const dataset =
  process.env.BIGQUERY_DATASET ??
  "crisisops_marts";


/* ============================================================
   TYPES
   ============================================================ */


export type SourceFreshnessRecord = {
  source_name: string;
  source_category: string;

  target_table: string;

  table_status: string;

  loaded_at: string | null;
  captured_at: string | null;

  row_count: number;

  freshness_status: string;

  health_severity_rank: number;

  is_fresh: boolean;

  requires_attention: boolean;
};


export type PipelineHealthRecord = {
  latest_dbt_invocation_id: string;

  latest_dbt_run_at: string | null;

  latest_dbt_run_status: string;

  latest_dbt_total_resources: number;

  latest_dbt_models_executed: number;

  latest_dbt_tests_executed: number;

  latest_dbt_pass_rate_pct: number;

  monitored_sources: number;

  fresh_sources: number;

  sources_requiring_attention: number;

total_active_geographies: number;

  scored_geographies: number;

  unscored_geographies: number;

  scoring_coverage_pct: number;
  overall_system_status: string;

health_evaluated_at: string | null;
};


export type UnscoredGeographyRecord = {
  county_fips: string;

  state: string;

  county_name: string;

  active_alerts: number;

  hazard_score: number;

  hazard_level: string;

  dominant_event: string;

  reason_code: string;

  scoring_blocked: boolean;

  exception_detected_at: string | null;
};


export type DataHealthData = {
  pipeline:
    PipelineHealthRecord | null;

  sources:
    SourceFreshnessRecord[];

  unscoredGeographies:
    UnscoredGeographyRecord[];
};


/* ============================================================
   HELPERS
   ============================================================ */


function numberValue(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const numeric =
    Number(value ?? 0);

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : 0;
}


function booleanValue(
  value:
    | boolean
    | string
    | number
    | null
    | undefined,
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "number"
  ) {
    return value !== 0;
  }

  return (
    String(value ?? "")
      .toLowerCase() ===
    "true"
  );
}


/* ============================================================
   SOURCE FRESHNESS
   ============================================================ */


async function getSourceFreshness(): Promise<
  SourceFreshnessRecord[]
> {

  const query = `
    SELECT

      source_name,

      source_category,

      target_table,

      table_status,

      CAST(loaded_at AS STRING)
        AS loaded_at,

      CAST(captured_at AS STRING)
        AS captured_at,

      row_count,

      freshness_status,

      health_severity_rank,

      is_fresh,

      requires_attention

    FROM
      \`${projectId}.${dataset}.mart_source_freshness\`

    ORDER BY

      health_severity_rank DESC,

      source_category,

      source_name
  `;


  const rows =
    await runBigQuery<
      SourceFreshnessRecord
    >(
      query,
    );


  return rows.map(
    (
      row,
    ) => ({

      ...row,

      row_count:
        numberValue(
          row.row_count,
        ),

      health_severity_rank:
        numberValue(
          row.health_severity_rank,
        ),

      is_fresh:
        booleanValue(
          row.is_fresh,
        ),

      requires_attention:
        booleanValue(
          row.requires_attention,
        ),

    }),
  );
}


/* ============================================================
   PIPELINE HEALTH
   ============================================================ */


async function getPipelineHealth(): Promise<
  PipelineHealthRecord | null
> {

  const query = `
  SELECT

    latest_dbt_invocation_id,

    CAST(latest_dbt_run_at AS STRING)
      AS latest_dbt_run_at,

    latest_dbt_run_status,

    latest_dbt_total_resources,

    latest_dbt_models_executed,

    latest_dbt_tests_executed,

    latest_dbt_pass_rate_pct,

    monitored_sources,

    fresh_sources,

    sources_requiring_attention,

    scored_geographies,

    unscored_geographies,

    total_active_geographies,

    scoring_coverage_pct,

    overall_system_status,

    CAST(health_evaluated_at AS STRING)
      AS health_evaluated_at

  FROM
    \`${projectId}.${dataset}.mart_pipeline_health\`

  LIMIT 1
`;

  const rows =
    await runBigQuery<
      PipelineHealthRecord
    >(
      query,
    );


  if (
    rows.length ===
    0
  ) {
    return null;
  }


  const row =
    rows[0];


  return {

    ...row,

    latest_dbt_total_resources:
      numberValue(
        row.latest_dbt_total_resources,
      ),

    latest_dbt_models_executed:
      numberValue(
        row.latest_dbt_models_executed,
      ),

    latest_dbt_tests_executed:
      numberValue(
        row.latest_dbt_tests_executed,
      ),

    latest_dbt_pass_rate_pct:
      numberValue(
        row.latest_dbt_pass_rate_pct,
      ),

    monitored_sources:
      numberValue(
        row.monitored_sources,
      ),

    fresh_sources:
      numberValue(
        row.fresh_sources,
      ),

    sources_requiring_attention:
      numberValue(
        row.sources_requiring_attention,
      ),

    total_active_geographies:
  numberValue(
    row.total_active_geographies,
  ),
    scored_geographies:
      numberValue(
        row.scored_geographies,
      ),

    unscored_geographies:
      numberValue(
        row.unscored_geographies,
      ),

    scoring_coverage_pct:
      numberValue(
        row.scoring_coverage_pct,
      ),

  };
}


/* ============================================================
   UNSCORED ACTIVE GEOGRAPHIES
   ============================================================ */


async function getUnscoredGeographies(): Promise<
  UnscoredGeographyRecord[]
> {

  const query = `
    SELECT

      county_fips,

      state,

      county_name,

      active_alerts,

      hazard_score,

      hazard_level,

      dominant_event,

      reason_code,

      scoring_blocked,

      CAST(exception_detected_at AS STRING)
        AS exception_detected_at

    FROM
      \`${projectId}.${dataset}.mart_unscored_active_geographies\`

    ORDER BY

      active_alerts DESC,

      state,

      county_name
  `;


  const rows =
    await runBigQuery<
      UnscoredGeographyRecord
    >(
      query,
    );


  return rows.map(
    (
      row,
    ) => ({

      ...row,

      county_fips:
        String(
          row.county_fips ??
          "",
        ).padStart(
          5,
          "0",
        ),

      active_alerts:
        numberValue(
          row.active_alerts,
        ),

      hazard_score:
        numberValue(
          row.hazard_score,
        ),

      scoring_blocked:
        booleanValue(
          row.scoring_blocked,
        ),

    }),
  );
}


/* ============================================================
   COMBINED DATA HEALTH PAYLOAD
   ============================================================ */


export async function getDataHealth(): Promise<
  DataHealthData
> {

  const [
    pipeline,
    sources,
    unscoredGeographies,
  ] =
    await Promise.all([
      getPipelineHealth(),
      getSourceFreshness(),
      getUnscoredGeographies(),
    ]);


  return {
    pipeline,
    sources,
    unscoredGeographies,
  };
}