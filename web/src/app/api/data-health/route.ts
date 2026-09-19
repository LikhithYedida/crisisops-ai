import { NextResponse } from "next/server";

import {
  getDataHealth,
} from "@/lib/data-health";


export const runtime = "nodejs";

export const dynamic =
  "force-dynamic";


export async function GET() {

  try {

    const data =
      await getDataHealth();


    return NextResponse.json(
      {
        success: true,

        generatedAt:
          new Date()
            .toISOString(),

        data,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );

  } catch (error) {

    console.error(
      "Data Health API error:",
      error,
    );


    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Data health information could not be loaded.",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }
}