import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


type QuestionType =
  | "ranking"
  | "driver"
  | "context"
  | "fema";


type CountySnapshot = {
  county_full_name: string;
  state: string;

  population: number | string;

  active_alerts: number | string;
  severe_or_extreme_alerts: number | string;

  dominant_event: string;

  hazard_score: number | string;
  hazard_level: string;

  exposure_score: number | string;
  vulnerability_score_model: number | string;
  history_score: number | string;

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

  incident_types_10y:
    number | string;
};


type RequestBody = {
  question: QuestionType;
  county: CountySnapshot;
};


const QUESTION_TEXT: Record<
  QuestionType,
  string
> = {
  ranking:
    "Explain why this county currently ranks where it does.",

  driver:
    "Explain what is driving this county's priority score the most.",

  context:
    "Explain which county-context factor matters most and why it matters to the score.",

  fema:
    "Explain how FEMA disaster history affects this county's current priority score.",
};


function numberValue(
  value:
    | number
    | string
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


function buildCountyContext(
  county: CountySnapshot,
) {
  return {
    county:
      county.county_full_name,

    state:
      county.state,

    national_rank:
      numberValue(
        county.national_operational_rank,
      ),

    priority_score:
      numberValue(
        county.operational_priority_score,
      ),

    priority_level:
      county.operational_priority_level,

    current_hazard:
      county.dominant_event,

    operational_hazard_level:
      county.hazard_level,

    active_nws_alerts:
      numberValue(
        county.active_alerts,
      ),

    severe_or_extreme_nws_alerts:
      numberValue(
        county.severe_or_extreme_alerts,
      ),

    population:
      numberValue(
        county.population,
      ),

    scores: {
      hazard:
        numberValue(
          county.hazard_score,
        ),

      population_exposure:
        numberValue(
          county.exposure_score,
        ),

      social_vulnerability:
        numberValue(
          county.vulnerability_score_model,
        ),

      disaster_history:
        numberValue(
          county.history_score,
        ),
    },

    score_contributions: {
      current_hazard:
        numberValue(
          county.hazard_contribution,
        ),

      population_exposure:
        numberValue(
          county.exposure_contribution,
        ),

      social_vulnerability:
        numberValue(
          county.vulnerability_contribution,
        ),

      fema_history:
        numberValue(
          county.history_contribution,
        ),
    },

    share_of_total_score_pct: {
      current_hazard:
        numberValue(
          county.hazard_share_pct,
        ),

      population_exposure:
        numberValue(
          county.exposure_share_pct,
        ),

      social_vulnerability:
        numberValue(
          county.vulnerability_share_pct,
        ),

      fema_history:
        numberValue(
          county.history_share_pct,
        ),
    },

    largest_overall_driver:
      county.dominant_risk_driver,

    largest_county_context_factor:
      county.dominant_context_driver,

    fema_history: {
      declarations_total:
        numberValue(
          county.fema_declarations_total,
        ),

      declarations_last_10_years:
        numberValue(
          county.fema_declarations_10y,
        ),

      major_disasters_last_10_years:
        numberValue(
          county.major_disasters_10y,
        ),

      incident_types_last_10_years:
        numberValue(
          county.incident_types_10y,
        ),
    },
  };
}


function extractResponseText(
  responseData: any,
): string | null {

  if (
    typeof responseData
      ?.output_text ===
    "string"
  ) {
    return responseData.output_text.trim();
  }


  const output =
    Array.isArray(
      responseData?.output,
    )
      ? responseData.output
      : [];


  for (
    const item
    of output
  ) {
    if (
      !Array.isArray(
        item?.content,
      )
    ) {
      continue;
    }


    for (
      const content
      of item.content
    ) {
      if (
        content?.type ===
          "output_text" &&
        typeof content?.text ===
          "string"
      ) {
        return content.text.trim();
      }
    }
  }


  return null;
}


export async function POST(
  request: Request,
) {

  try {

    /*
    |--------------------------------------------------------------------------
    | API key
    |--------------------------------------------------------------------------
    */

    const apiKey =
      process.env
        .OPENAI_API_KEY;


    if (!apiKey) {

      return NextResponse.json(
        {
          success: false,

          error:
            "OPENAI_API_KEY is not configured.",
        },
        {
          status: 500,
        },
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Request body
    |--------------------------------------------------------------------------
    */

    const body =
      (
        await request.json()
      ) as RequestBody;


    if (
      !body ||
      !body.county ||
      !body.question
    ) {

      return NextResponse.json(
        {
          success: false,

          error:
            "County and question are required.",
        },
        {
          status: 400,
        },
      );
    }


    if (
      !Object.prototype
        .hasOwnProperty.call(
          QUESTION_TEXT,
          body.question,
        )
    ) {

      return NextResponse.json(
        {
          success: false,

          error:
            "Unsupported county question.",
        },
        {
          status: 400,
        },
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Grounded county context
    |--------------------------------------------------------------------------
    */

    const countyContext =
      buildCountyContext(
        body.county,
      );


    /*
    |--------------------------------------------------------------------------
    | Instructions
    |--------------------------------------------------------------------------
    |
    | The explanation must stay inside the metrics supplied by CrisisOps.
    |
    */

    const instructions = `
You write short explanations for the CrisisOps county intelligence dashboard.

The reader is a director or operations leader who wants to understand why a county has its current score or ranking.

Write like an experienced data analyst explaining the result to a colleague.

WRITING STYLE:
- Answer the question immediately.
- Use plain, natural English.
- Write 2 or 3 sentences.
- Keep the answer between 45 and 80 words.
- Use only the few numbers that directly help answer the question.
- Prefer phrases such as "adds 14.76 points" or "accounts for 48.7% of the score."
- Refer to Current Hazard, Population Exposure, Social Vulnerability, and FEMA History as score components.

DO NOT:
- call yourself AI
- mention a model, prompt, dataset, JSON, or supplied data
- say "based on the provided data"
- say "according to the model"
- say "it is important to note"
- say a score is high, low, very high, unusual, significant, or elevated unless a comparison or threshold in the supplied record directly supports that statement
- describe the operational hazard level as the cause of the ranking
- list every available metric
- repeat the question
- use bullet points or headings
- invent causes, thresholds, weather details, FEMA events, or recommendations
- claim that a county is safe or unsafe

ACCURACY:
- Current Hazard is a score component.
- dominant_event is the current hazard event name.
- hazard_level is the CrisisOps operational hazard classification.
- severe_or_extreme_nws_alerts is a separate NWS alert count.
- Do not confuse these fields.
- dominant_risk_driver identifies the largest overall score component.
- dominant_context_driver identifies the largest non-hazard county-context factor.
- Use contribution values when explaining what adds points to the score.
- Use share percentages when explaining how much of the final score a component represents.
- Never attach a percentage directly after a point value. Separate them with words or punctuation.

Use only facts contained in the CrisisOps county record.

If the requested explanation cannot be supported by those facts, say what cannot be determined rather than guessing.
`.trim();


    /*
    |--------------------------------------------------------------------------
    | User request sent to the model
    |--------------------------------------------------------------------------
    */

    const input = `
QUESTION:
${QUESTION_TEXT[body.question]}

CURRENT CRISISOPS COUNTY RECORD:
${JSON.stringify(
  countyContext,
  null,
  2,
)}

Answer only the question being asked.
Do not describe unrelated metrics.
`.trim();


    /*
    |--------------------------------------------------------------------------
    | OpenAI Responses API
    |--------------------------------------------------------------------------
    */

    const openAIResponse =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              model:
                "gpt-5.6-luna",

              instructions,

              input,

              max_output_tokens:
                500,
            }),
        },
      );


    const responseData =
      await openAIResponse.json();


    if (
      !openAIResponse.ok
    ) {

      console.error(
        "County explanation API error:",
        responseData,
      );


      return NextResponse.json(
        {
          success: false,

          error:
            responseData
              ?.error
              ?.message ??
            "The county explanation could not be generated.",
        },
        {
          status:
            openAIResponse.status,
        },
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Extract explanation
    |--------------------------------------------------------------------------
    */

    const explanation =
      extractResponseText(
        responseData,
      );


    if (!explanation) {

      return NextResponse.json(
        {
          success: false,

          error:
            "No county explanation was returned.",
        },
        {
          status: 500,
        },
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Success
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      success: true,

      question:
        body.question,

      county:
        body.county
          .county_full_name,

      explanation,
    });


  } catch (error) {

    console.error(
      "County explanation route failed:",
      error,
    );


    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "The county explanation could not be generated.",
      },
      {
        status: 500,
      },
    );
  }
}