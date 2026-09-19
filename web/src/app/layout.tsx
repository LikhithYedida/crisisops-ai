import type { Metadata } from "next";

import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";


export const metadata: Metadata = {
  title: "CrisisOps | U.S. Disaster Monitoring & County Prioritization",

  description:
    "Live U.S. disaster monitoring that tracks active weather hazards, affected communities, and county-level risk priorities.",

  applicationName: "CrisisOps",

  keywords: [
    "CrisisOps",
    "U.S. disaster monitoring",
    "county risk",
    "weather alerts",
    "National Weather Service",
    "FEMA",
    "CDC social vulnerability",
    "disaster analytics",
    "emergency management",
    "county prioritization",
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}