import { runBigQuery } from "@/lib/bigquery";


const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ?? "crisisops-intelligence";

const dataset =
  process.env.BIGQUERY_DATASET ?? "crisisops_marts";


export type NationalSituation = {
  situation_generated_at: string;

  unique_active_nws_alerts: number;

  unique_severe_or_extreme_nws_alerts: number;

  active_scored_counties: number;

  affected_states: number;

  county_alert_impacts: number;

  population_exposed: number;

  critical_counties: number;

  high_priority_counties: number;

  leading_hazard: string;

  leading_hazard_counties: number;

  most_affected_state: string;

  most_affected_state_counties: number;
};


export type PriorityCounty = {
  national_operational_rank: number;

  county_fips: string;

  county_full_name: string;

  state: string;

  dominant_event: string;

  operational_priority_score: number;

  operational_priority_level: string;

  dominant_context_driver: string;

  hazard_level: string;

  active_alerts: number;

  severe_or_extreme_alerts: number;

  population: number;

  hazard_share_pct: number;

  exposure_share_pct: number;

  vulnerability_share_pct: number;

  history_share_pct: number;
};


export type PipelineHealth = {
  overall_system_status: string;

  latest_dbt_run_status: string;

  monitored_sources: number;

  fresh_sources: number;

  scored_geographies: number;

  unscored_geographies: number;

  total_active_geographies: number;

  scoring_coverage_pct: number;
};


export type DashboardData = {
  national: NationalSituation;

  priorityCounties: PriorityCounty[];

  pipeline: PipelineHealth;
};


export async function getDashboardData(): Promise<DashboardData> {

  const nationalQuery = `
    SELECT

      CAST(
        situation_generated_at AS STRING
      ) AS situation_generated_at,

      unique_active_nws_alerts,

      unique_severe_or_extreme_nws_alerts,

      active_scored_counties,

      affected_states,

      county_alert_impacts,

      population_exposed,

      critical_counties,

      high_priority_counties,

      leading_hazard,

      leading_hazard_counties,

      most_affected_state,

      most_affected_state_counties

    FROM
      \`${projectId}.${dataset}.mart_national_situation\`

    LIMIT 1
  `;


  const priorityQuery = `
    SELECT

      national_operational_rank,

      county_fips,

      county_full_name,

      state,

      dominant_event,

      operational_priority_score,

      operational_priority_level,

      dominant_context_driver,
      
      hazard_share_pct,

    exposure_share_pct,

    vulnerability_share_pct,

    history_share_pct,

      hazard_level,

      active_alerts,

      severe_or_extreme_alerts,

      population

    FROM
      \`${projectId}.${dataset}.mart_priority_queue\`

    ORDER BY
      national_operational_rank

    LIMIT 5
  `;


  const pipelineQuery = `
    SELECT

      overall_system_status,

      latest_dbt_run_status,

      monitored_sources,

      fresh_sources,

      scored_geographies,

      unscored_geographies,

      total_active_geographies,

      scoring_coverage_pct

    FROM
      \`${projectId}.${dataset}.mart_pipeline_health\`

    LIMIT 1
  `;


  const [
    nationalRows,
    priorityRows,
    pipelineRows,
  ] = await Promise.all([

    runBigQuery<NationalSituation>(
      nationalQuery
    ),

    runBigQuery<PriorityCounty>(
      priorityQuery
    ),

    runBigQuery<PipelineHealth>(
      pipelineQuery
    ),

  ]);


  if (!nationalRows[0]) {
    throw new Error(
      "mart_national_situation returned no rows."
    );
  }


  if (!pipelineRows[0]) {
    throw new Error(
      "mart_pipeline_health returned no rows."
    );
  }


  return {

    national:
      nationalRows[0],

    priorityCounties:
      priorityRows,

    pipeline:
      pipelineRows[0],

  };
}