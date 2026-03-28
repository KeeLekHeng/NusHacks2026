"use client";

import Link from "next/link";
import { travelFlowRoutes } from "../lib/trip-planner";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 p-6">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-300">
          Travel Planner
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Three-step trip planning flow
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-300">
          Architecture is now set up for itinerary planning, accommodation selection, and final
          summary/share. This step only establishes the route structure and shared travel data
          models for later prompts.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {travelFlowRoutes.map((route, index) => (
          <Link
            key={route.step}
            href={route.href}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-blue-500"
          >
            <p className="text-sm font-medium text-blue-300">Step {index + 1}</p>
            <h2 className="mt-3 text-xl font-semibold text-white">{route.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{route.description}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold text-white">Shared data foundation</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Trip, itinerary, expenses, accommodation options, selected stays, and final summary
          structures are centralized in <code>frontend/lib/trip-planner.ts</code>.
        </p>
      </section>
    </main>
  );
}
