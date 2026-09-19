import { runBigQuery } from "@/lib/bigquery";


const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  "crisisops-intelligence";

const dataset =
  process.env.BIGQUERY_DATASET ??
  "crisisops_marts";


export type MapCounty = {
  county_fips: string;
  county_full_name: string;
  state: string;

  population: number;

  active_alerts: number;
  severe_or_extreme_alerts: number;

  dominant_event: string;

  hazard_score: number;
  hazard_level: string;

  exposure_score: number;
  vulnerability_score_model: number;
  history_score: number;
  context_score: number;

  operational_priority_score: number;
  operational_priority_level: string;

  national_operational_rank: number;

  /*
  |--------------------------------------------------------------------------
  | Drivers
  |--------------------------------------------------------------------------
  |
  | dominant_context_driver:
  | Strongest NON-HAZARD county-context factor.
  |
  | dominant_risk_driver:
  | Largest weighted contributor across the FULL priority model.
  |
  */

  dominant_context_driver: string;
  dominant_risk_driver: string;

  /*
  |--------------------------------------------------------------------------
  | Weighted contributions to the final score
  |--------------------------------------------------------------------------
  */

  hazard_contribution: number;
  exposure_contribution: number;
  vulnerability_contribution: number;
  history_contribution: number;

  /*
  |--------------------------------------------------------------------------
  | Share of the final priority score
  |--------------------------------------------------------------------------
  */

  hazard_share_pct: number;
  exposure_share_pct: number;
  vulnerability_share_pct: number;
  history_share_pct: number;

  /*
  |--------------------------------------------------------------------------
  | FEMA historical context
  |--------------------------------------------------------------------------
  */

  fema_declarations_total: number;
  fema_declarations_10y: number;
  major_disasters_10y: number;
  emergencies_10y: number;
  fire_management_10y: number;
  incident_types_10y: number;
};


export async function getMapData(): Promise<MapCounty[]> {

  const query = `
    SELECT

      county_fips,

      county_full_name,

      state,

      population,

      active_alerts,

      severe_or_extreme_alerts,

      dominant_event,

      hazard_score,

      hazard_level,

      exposure_score,

      vulnerability_score_model,

      history_score,

      context_score,

      operational_priority_score,

      operational_priority_level,

      national_operational_rank,

      dominant_context_driver,

      dominant_risk_driver,

      hazard_contribution,

      exposure_contribution,

      vulnerability_contribution,

      history_contribution,

      hazard_share_pct,

      exposure_share_pct,

      vulnerability_share_pct,

      history_share_pct,

      fema_declarations_total,

      fema_declarations_10y,

      major_disasters_10y,

      emergencies_10y,

      fire_management_10y,

      incident_types_10y

    FROM
      \`${projectId}.${dataset}.mart_county_operational_priority\`

    WHERE
      county_fips IS NOT NULL

    ORDER BY
      national_operational_rank
  `;


  const rows =
    await runBigQuery<MapCounty>(
      query,
    );


  return rows.map(
    (row) => ({

      ...row,


      /*
      |--------------------------------------------------------------------------
      | County identifiers
      |--------------------------------------------------------------------------
      */

      county_fips:
        String(
          row.county_fips,
        ).padStart(
          5,
          "0",
        ),


      /*
      |--------------------------------------------------------------------------
      | Population / alert counts
      |--------------------------------------------------------------------------
      */

      population:
        Number(
          row.population ??
          0,
        ),

      active_alerts:
        Number(
          row.active_alerts ??
          0,
        ),

      severe_or_extreme_alerts:
        Number(
          row.severe_or_extreme_alerts ??
          0,
        ),


      /*
      |--------------------------------------------------------------------------
      | Component scores
      |--------------------------------------------------------------------------
      */

      hazard_score:
        Number(
          row.hazard_score ??
          0,
        ),

      exposure_score:
        Number(
          row.exposure_score ??
          0,
        ),

      vulnerability_score_model:
        Number(
          row.vulnerability_score_model ??
          0,
        ),

      history_score:
        Number(
          row.history_score ??
          0,
        ),

      context_score:
        Number(
          row.context_score ??
          0,
        ),


      /*
      |--------------------------------------------------------------------------
      | Final operational score
      |--------------------------------------------------------------------------
      */

      operational_priority_score:
        Number(
          row.operational_priority_score ??
          0,
        ),

      national_operational_rank:
        Number(
          row.national_operational_rank ??
          0,
        ),


      /*
      |--------------------------------------------------------------------------
      | Weighted contribution values
      |--------------------------------------------------------------------------
      */

      hazard_contribution:
        Number(
          row.hazard_contribution ??
          0,
        ),

      exposure_contribution:
        Number(
          row.exposure_contribution ??
          0,
        ),

      vulnerability_contribution:
        Number(
          row.vulnerability_contribution ??
          0,
        ),

      history_contribution:
        Number(
          row.history_contribution ??
          0,
        ),


      /*
      |--------------------------------------------------------------------------
      | Share of final score
      |--------------------------------------------------------------------------
      */

      hazard_share_pct:
        Number(
          row.hazard_share_pct ??
          0,
        ),

      exposure_share_pct:
        Number(
          row.exposure_share_pct ??
          0,
        ),

      vulnerability_share_pct:
        Number(
          row.vulnerability_share_pct ??
          0,
        ),

      history_share_pct:
        Number(
          row.history_share_pct ??
          0,
        ),


      /*
      |--------------------------------------------------------------------------
      | FEMA history
      |--------------------------------------------------------------------------
      */

      fema_declarations_total:
        Number(
          row.fema_declarations_total ??
          0,
        ),

      fema_declarations_10y:
        Number(
          row.fema_declarations_10y ??
          0,
        ),

      major_disasters_10y:
        Number(
          row.major_disasters_10y ??
          0,
        ),

      emergencies_10y:
        Number(
          row.emergencies_10y ??
          0,
        ),

      fire_management_10y:
        Number(
          row.fire_management_10y ??
          0,
        ),

      incident_types_10y:
        Number(
          row.incident_types_10y ??
          0,
        ),

    }),
  );
}