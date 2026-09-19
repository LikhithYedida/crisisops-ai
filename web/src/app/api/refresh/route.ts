import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
|--------------------------------------------------------------------------
| CrisisOps local project location
|--------------------------------------------------------------------------
|
| Uses CRISISOPS_PROJECT_ROOT if you define it later.
| Otherwise it falls back to your current local project path.
|
*/

const PROJECT_ROOT =
  process.env.CRISISOPS_PROJECT_ROOT ??
  "E:\\crisisops-ai";

const DBT_PROJECT_DIR = path.join(
  PROJECT_ROOT,
  "dbt",
  "crisisops",
);

/*
|--------------------------------------------------------------------------
| Prevent two refreshes from running at the same time
|--------------------------------------------------------------------------
*/

let refreshInProgress = false;

/*
|--------------------------------------------------------------------------
| Command runner
|--------------------------------------------------------------------------
*/

type CommandResult = {
  command: string;
  output: string;
};

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> {
  return new Promise(
    (resolve, reject) => {
      const displayCommand = [
        command,
        ...args,
      ].join(" ");

      console.log(
        `[CrisisOps Refresh] Running: ${displayCommand}`,
      );

      const child = spawn(
        command,
        args,
        {
          cwd,

          /*
           * shell:true is useful on Windows,
           * especially for dbt command resolution.
           *
           * All commands and arguments below are static.
           * No user input is passed into the shell.
           */
          shell: true,

          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1",
          },
        },
      );

      let stdout = "";
      let stderr = "";

      child.stdout.on(
        "data",
        (data) => {
          const text =
            data.toString();

          stdout += text;

          console.log(
            `[CrisisOps Refresh] ${text}`,
          );
        },
      );

      child.stderr.on(
        "data",
        (data) => {
          const text =
            data.toString();

          stderr += text;

          console.error(
            `[CrisisOps Refresh] ${text}`,
          );
        },
      );

      child.on(
        "error",
        (error) => {
          reject(
            new Error(
              `${displayCommand} could not start: ${error.message}`,
            ),
          );
        },
      );

      child.on(
        "close",
        (code) => {
          if (code !== 0) {
            reject(
              new Error(
                [
                  `Command failed: ${displayCommand}`,
                  `Exit code: ${code}`,
                  stderr.trim(),
                ]
                  .filter(Boolean)
                  .join("\n"),
              ),
            );

            return;
          }

          resolve({
            command:
              displayCommand,

            output:
              stdout.trim(),
          });
        },
      );
    },
  );
}

/*
|--------------------------------------------------------------------------
| POST /api/refresh
|--------------------------------------------------------------------------
|
| This endpoint intentionally works only in local development.
|
| It refreshes:
|
| 1. Live source ingestion
| 2. dbt models
| 3. dbt tests
| 4. dbt execution metadata
| 5. ingestion metadata
| 6. freshness + pipeline health marts
|
*/

export async function POST() {
  /*
   * Do NOT allow a public production site
   * to execute Python/dbt processes.
   */
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Manual pipeline refresh is disabled in production.",
      },
      {
        status: 403,
      },
    );
  }

  if (refreshInProgress) {
    return NextResponse.json(
      {
        success: false,
        error:
          "A CrisisOps data refresh is already running.",
      },
      {
        status: 409,
      },
    );
  }

  refreshInProgress = true;

  const startedAt =
    new Date();

  const completedSteps:
    CommandResult[] = [];

  try {
    /*
    |--------------------------------------------------------------------------
    | 1. Refresh live source data
    |--------------------------------------------------------------------------
    */

    completedSteps.push(
      await runCommand(
        "python",
        [
          path.join(
            "ingestion",
            "bigquery",
            "load_raw_tables.py",
          ),
          "--group",
          "live",
        ],
        PROJECT_ROOT,
      ),
    );

    /*
    |--------------------------------------------------------------------------
    | 2. Rebuild dbt models
    |--------------------------------------------------------------------------
    */

    completedSteps.push(
      await runCommand(
        "dbt",
        ["run"],
        DBT_PROJECT_DIR,
      ),
    );

    /*
    |--------------------------------------------------------------------------
    | 3. Run dbt validation tests
    |--------------------------------------------------------------------------
    */

    completedSteps.push(
      await runCommand(
        "dbt",
        ["test"],
        DBT_PROJECT_DIR,
      ),
    );

    /*
    |--------------------------------------------------------------------------
    | 4. Capture latest dbt execution metadata
    |--------------------------------------------------------------------------
    */

    completedSteps.push(
      await runCommand(
        "python",
        [
          path.join(
            "ingestion",
            "bigquery",
            "capture_dbt_run_metadata.py",
          ),
        ],
        PROJECT_ROOT,
      ),
    );

    /*
    |--------------------------------------------------------------------------
    | 5. Capture ingestion metadata
    |--------------------------------------------------------------------------
    */

    completedSteps.push(
      await runCommand(
        "python",
        [
          path.join(
            "ingestion",
            "bigquery",
            "capture_ingestion_metadata.py",
          ),
        ],
        PROJECT_ROOT,
      ),
    );

    /*
    |--------------------------------------------------------------------------
    | 6. Rebuild monitoring / health marts
    |--------------------------------------------------------------------------
    */

    completedSteps.push(
      await runCommand(
        "dbt",
        [
          "run",
          "--select",
          "stg_ingestion_metadata",
          "stg_dbt_run_metadata",
          "mart_source_freshness",
          "mart_pipeline_health",
        ],
        DBT_PROJECT_DIR,
      ),
    );

    const finishedAt =
      new Date();

    return NextResponse.json({
      success: true,

      message:
        "CrisisOps data refresh completed successfully.",

      started_at:
        startedAt.toISOString(),

      finished_at:
        finishedAt.toISOString(),

      duration_seconds:
        Math.round(
          (finishedAt.getTime() -
            startedAt.getTime()) /
            1000,
        ),

      steps_completed:
        completedSteps.map(
          (step) =>
            step.command,
        ),
    });
  } catch (error) {
    console.error(
      "[CrisisOps Refresh] Refresh failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "The CrisisOps refresh failed.",

        steps_completed:
          completedSteps.map(
            (step) =>
              step.command,
          ),
      },
      {
        status: 500,
      },
    );
  } finally {
    refreshInProgress =
      false;
  }
}