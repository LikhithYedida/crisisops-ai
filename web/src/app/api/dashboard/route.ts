import { NextResponse } from "next/server";

import { getDashboardData } from "@/lib/dashboard-data";


export const runtime = "nodejs";

export const dynamic = "force-dynamic";


export async function GET() {

  try {

    const data =
      await getDashboardData();


    return NextResponse.json(
      {
        success: true,

        generatedAt:
          new Date().toISOString(),

        data,
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "CrisisOps dashboard API error:",
      error
    );


    return NextResponse.json(
      {
        success: false,

        error:
          "Unable to load CrisisOps dashboard data.",
      },
      {
        status: 500,
      }
    );

  }

}