import { BigQuery, Query } from "@google-cloud/bigquery";


const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ?? "crisisops-intelligence";

const location =
  process.env.BIGQUERY_LOCATION ?? "US";


export const bigquery = new BigQuery({
  projectId,
});


export async function runBigQuery<T>(
  query: string,
  params?: Query["params"]
): Promise<T[]> {

  const [job] = await bigquery.createQueryJob({
    query,
    location,
    params,
    useLegacySql: false,
  });


  const [rows] = await job.getQueryResults();


  return rows as T[];
}