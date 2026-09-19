"use client";

import Link from "next/link";

import {
  Gauge,
  LayoutDashboard,
  MapPin,
  Menu,
  Radar,
  Siren,
} from "lucide-react";

import {
  usePathname,
} from "next/navigation";

import {
  DashboardRefreshButton,
} from "@/components/dashboard-refresh-button";


const navItems = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },

  {
    label: "County Prioritization",
    href: "/priority",
    icon: Siren,
  },

  {
    label: "County Intelligence",
    href: "/counties",
    icon: MapPin,
  },

  {
    label: "Data Health",
    href: "/data-health",
    icon: Gauge,
  },
];


export function MobileNavigation() {

  const pathname =
    usePathname();


  return (
    <details className="group sticky top-0 z-[100] xl:hidden">

      {/* =====================================================
          MOBILE HEADER
          ===================================================== */}

      <summary className="relative flex h-[64px] cursor-pointer list-none items-center justify-between border-b border-white/10 bg-[#08131d]/95 px-4 backdrop-blur [&::-webkit-details-marker]:hidden">

        {/* Brand */}

        <Link
          href="/"
          onClick={(
            event,
          ) =>
            event.stopPropagation()
          }
          className="flex min-w-0 items-center gap-3"
        >

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">

            <Radar className="h-4 w-4 text-cyan-300" />

          </div>


          <div className="min-w-0">

            <div className="truncate text-sm font-bold tracking-[0.14em] text-white">
              CRISISOPS
            </div>

            <div className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              U.S. Hazard Intelligence
            </div>

          </div>

        </Link>


        {/* Space reserved for refresh + menu controls */}

        <div className="flex items-center gap-2">

          <div
            className="h-10 w-10"
            aria-hidden="true"
          />

          <span
            aria-label="Open navigation"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition group-open:border-cyan-400/25 group-open:bg-cyan-400/[0.07] group-open:text-cyan-200"
          >

            <Menu className="h-5 w-5" />

          </span>

        </div>

      </summary>


      {/* =====================================================
          REFRESH BUTTON
          Kept outside summary so tapping it does not
          accidentally open / close navigation.
          ===================================================== */}

      <div
        className="absolute right-[60px] top-[12px] z-[130]"
        onClick={(
          event,
        ) =>
          event.stopPropagation()
        }
      >

        <DashboardRefreshButton />

      </div>


      {/* =====================================================
          MOBILE NAVIGATION MENU
          ===================================================== */}

      <div className="fixed inset-x-0 top-[64px] z-[110] border-b border-white/10 bg-[#08131d]/98 shadow-2xl shadow-black/60 backdrop-blur-xl">

        <nav className="mx-auto max-w-[520px] p-4">

          <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Navigation
          </div>


          <div className="space-y-1">

            {navItems.map(
              (
                item,
              ) => {

                const Icon =
                  item.icon;


                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(
                        item.href,
                      );


                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3.5 text-sm font-semibold transition ${
                      active
                        ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                        : "border-transparent text-slate-300 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >

                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active
                          ? "text-cyan-300"
                          : "text-slate-500"
                      }`}
                    />


                    <span>
                      {
                        item.label
                      }
                    </span>


                    {active && (

                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />

                    )}

                  </Link>
                );
              },
            )}

          </div>


          {/* =================================================
              MOBILE STATUS FOOTER
              ================================================= */}

          <div className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-3">

            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
              Live Platform
            </div>

            <div className="mt-1 text-[11px] leading-5 text-slate-400">
              Use the four sections above to move between the live
              national view, county prioritization, county intelligence,
              and data-health monitoring.
            </div>

          </div>

        </nav>

      </div>

    </details>
  );
}