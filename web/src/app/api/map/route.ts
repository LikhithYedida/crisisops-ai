import { NextResponse } from "next/server";

import { getMapData } from "@/lib/map-data";


export const runtime = "nodejs";

export const dynamic = "force-dynamic";


export async function GET() {

  try {

    const counties =
      await getMapData();


    return NextResponse.json(
      {
        success: true,

        generatedAt:
          new Date().toISOString(),

        count:
          counties.length,

        data:
          counties,
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "CrisisOps county map API error:",
      error
    );


    return NextResponse.json(
      {
        success: false,

        error:
          "Unable to load county risk map data.",
      },
      {
        status: 500,
      }
    );

  }

}