"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Snippet
} from "@heroui/react";
import { getDemoTravelPlan } from "../../lib/api";
import {
  loadAccommodationSelectionsFromSession,
  loadTravelPlanFromSession
} from "../../lib/travel-plan-storage";
import {
  travelFlowRoutes,
  type AccommodationSelectionMap,
  type AccommodationSearchOption,
  type GeneratedExpenseDay,
  type TravelPlanResult
} from "../../lib/trip-planner";

type ShareStatus = {
  tone: "neutral" | "success" | "error";
  message: string;
} | null;

type SummaryStay = {
  id: string;
  nightLabel: string;
  dayNumber: number;
  city: string;
  property: AccommodationSearchOption;
};

export default function SummaryPage() {
  const [travelPlan, setTravelPlan] = useState<TravelPlanResult | null>(null);
  const [accommodationSelections, setAccommodationSelections] =
    useState<AccommodationSelectionMap>({});
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null);

  useEffect(() => {
    const storedPlan = loadTravelPlanFromSession();
    const nextPlan = storedPlan ?? getDemoTravelPlan();
    const storedSelections = loadAccommodationSelectionsFromSession();

    setTravelPlan(nextPlan);
    setAccommodationSelections(storedSelections);
    setPageNotice(
      storedPlan
        ? null
        : "No saved itinerary was found, so this summary is using the demo travel plan shell."
    );
  }, []);

  const selectedStays = useMemo(
    () => (travelPlan ? buildSummaryStays(travelPlan, accommodationSelections) : []),
    [travelPlan, accommodationSelections]
  );

  const itineraryExpenses = useMemo(
    () => travelPlan?.itinerary.estimated_expenses ?? [],
    [travelPlan]
  );

  const itineraryNonHotelCost = useMemo(
    () => calculateItineraryCost(itineraryExpenses),
    [itineraryExpenses]
  );

  const selectedStayCost = useMemo(
    () =>
      selectedStays.reduce(
        (total, stay) => total + (stay.property.nightly_price ?? stay.property.total_price ?? 0),
        0
      ),
    [selectedStays]
  );

  const totalEstimatedCost = itineraryNonHotelCost + selectedStayCost;
  const tripTitle = useMemo(() => buildTripTitle(travelPlan), [travelPlan]);
  const shareText = useMemo(
    () => buildShareText(travelPlan, selectedStays, totalEstimatedCost),
    [travelPlan, selectedStays, totalEstimatedCost]
  );

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(shareText);
      setShareStatus({ tone: "success", message: "Trip summary copied to clipboard." });
    } catch {
      setShareStatus({ tone: "error", message: "Unable to copy the summary on this device." });
    }
  }

  async function handleShareOrExport() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: tripTitle,
          text: shareText
        });
        setShareStatus({ tone: "success", message: "Trip summary shared successfully." });
        return;
      }

      const blob = new Blob([shareText], { type: "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "trip-summary.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShareStatus({ tone: "success", message: "Trip summary exported as a text file." });
    } catch {
      setShareStatus({ tone: "error", message: "Unable to share or export the summary." });
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Final Trip Summary
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{tripTitle}</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              A share-friendly final view of the itinerary, selected stays, booking links, and the
              complete estimated spend.
            </p>
          </div>
          <Stepper />
        </header>

        {(pageNotice || shareStatus) && (
          <div className="space-y-3">
            {pageNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {pageNotice}
              </div>
            )}
            {shareStatus && (
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  shareStatus.tone === "success"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : shareStatus.tone === "error"
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : "border border-blue-100 bg-blue-50 text-blue-700"
                }`}
              >
                {shareStatus.message}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="flex flex-col items-start gap-3 px-6 pt-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Trip overview</p>
                  <p className="text-sm text-slate-500">
                    A polished summary card designed to be readable on screen and easy to share.
                  </p>
                </div>
                <Snippet
                  hideSymbol
                  variant="flat"
                  classNames={{ base: "bg-blue-50 text-blue-700" }}
                >
                  {travelPlan?.parsedTrip.destinations.join(" / ") ?? "Trip summary"}
                </Snippet>
              </CardHeader>
              <CardBody className="grid gap-4 px-6 pb-6 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Destinations"
                  value={travelPlan?.parsedTrip.destinations.join(", ") ?? "-"}
                />
                <MetricCard
                  label="Duration"
                  value={formatDuration(travelPlan?.parsedTrip.duration_days, travelPlan?.parsedTrip.duration_nights)}
                />
                <MetricCard label="Selected stays" value={String(selectedStays.length)} />
                <MetricCard label="Total estimate" value={formatCurrency(totalEstimatedCost)} />
              </CardBody>
            </Card>

            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="flex flex-col items-start gap-3 px-6 pt-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Share-ready summary</p>
                  <p className="text-sm text-slate-500">
                    Copy the trip recap or export it as a lightweight share artifact.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button color="primary" className="bg-blue-600 text-white" onPress={handleCopySummary}>
                    Copy summary
                  </Button>
                  <Button
                    variant="bordered"
                    className="border-blue-200 text-blue-700"
                    onPress={handleShareOrExport}
                  >
                    Share or export
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <div className="rounded-3xl border border-blue-100 bg-slate-50 p-5">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">
                    {shareText}
                  </pre>
                </div>
              </CardBody>
            </Card>

            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="px-6 pt-6">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Final itinerary by day</p>
                  <p className="text-sm text-slate-500">
                    The day-by-day plan remains the main artifact of the trip.
                  </p>
                </div>
              </CardHeader>
              <CardBody className="space-y-4 px-6 pb-6">
                {(travelPlan?.itinerary.itinerary_days ?? []).map((day) => (
                  <article key={day.day_number} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Chip className="bg-blue-600 text-white" size="sm">
                            Day {day.day_number}
                          </Chip>
                          <p className="text-sm font-medium text-slate-500">{day.city}</p>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900">{day.title}</h3>
                        <p className="mt-2 text-sm text-slate-500">
                          {day.start_area ?? "-"} / {day.end_area ?? "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Day estimate
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatCurrency(day.estimated_day_cost)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {day.activities.map((activity, index) => (
                        <div
                          key={`${activity.label}-${index}`}
                          className="rounded-2xl border border-white bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{activity.label}</p>
                                <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-700">
                                  {activity.category}
                                </Chip>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {activity.notes ?? "No additional notes for this activity."}
                              </p>
                            </div>
                            <div className="min-w-[150px] rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              <p>
                                {activity.start_area ?? "-"} / {activity.end_area ?? "-"}
                              </p>
                              <p className="mt-1 font-medium text-slate-900">
                                {activity.estimated_cost != null ? formatCurrency(activity.estimated_cost) : "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </CardBody>
            </Card>

            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="px-6 pt-6">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Selected accommodations</p>
                  <p className="text-sm text-slate-500">
                    Final stays grouped by night with booking links preserved.
                  </p>
                </div>
              </CardHeader>
              <CardBody className="space-y-4 px-6 pb-6">
                {selectedStays.length === 0 ? (
                  <EmptyState message="No stay selections have been saved yet. Select accommodations on Page 2 to complete the summary." />
                ) : (
                  selectedStays.map((stay) => (
                    <article key={stay.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <Chip className="bg-blue-600 text-white" size="sm">
                              {stay.nightLabel}
                            </Chip>
                            <p className="text-sm font-medium text-slate-500">{stay.city}</p>
                          </div>
                          <h3 className="mt-3 text-xl font-semibold text-slate-900">
                            {stay.property.property_name ?? "Selected stay"}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {stay.property.location_summary ?? "Location summary unavailable."}
                          </p>
                        </div>
                        <div className="min-w-[220px] rounded-2xl border border-blue-100 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Nightly estimate
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {formatCurrency(stay.property.nightly_price ?? stay.property.total_price ?? 0)}
                          </p>
                          <p className="mt-2 text-sm text-slate-500">
                            {stay.property.platform ?? "Platform"} /{" "}
                            {stay.property.room_type ?? "Room type unavailable"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                        <div className="flex flex-wrap gap-2">
                          {(stay.property.matched_amenities.length > 0
                            ? stay.property.matched_amenities
                            : ["No amenity data"]).map((amenity) => (
                            <Chip
                              key={`${stay.id}-${amenity}`}
                              variant="flat"
                              className="bg-blue-50 text-blue-700"
                            >
                              {formatLabel(amenity)}
                            </Chip>
                          ))}
                        </div>
                        <Input
                          isReadOnly
                          value={stay.property.booking_url ?? ""}
                          label="Booking URL"
                          labelPlacement="outside"
                          variant="bordered"
                          classNames={{
                            inputWrapper:
                              "border-slate-200 bg-white shadow-none data-[hover=true]:border-blue-300"
                          }}
                        />
                      </div>
                    </article>
                  ))
                )}
              </CardBody>
            </Card>
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="px-5 pt-5">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Expense breakdown</p>
                  <p className="text-sm text-slate-500">
                    Clear totals for the itinerary, stays, and final estimated spend.
                  </p>
                </div>
              </CardHeader>
              <CardBody className="gap-4 px-5 pb-5">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Total estimated trip cost
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatCurrency(totalEstimatedCost)}
                  </p>
                </div>

                <div className="space-y-3">
                  <SummaryRow label="Itinerary expenses" value={formatCurrency(itineraryNonHotelCost)} />
                  <SummaryRow label="Selected stays" value={formatCurrency(selectedStayCost)} />
                  <SummaryRow label="Combined estimate" value={formatCurrency(totalEstimatedCost)} highlight />
                </div>

                <Divider />

                <div className="space-y-4">
                  {itineraryExpenses.map((group) => (
                    <div key={group.day_number} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Day {group.day_number}</p>
                          <p className="text-xs text-slate-500">{group.city}</p>
                        </div>
                        <p className="text-sm font-medium text-slate-900">
                          {formatCurrency(group.items.reduce((total, item) => total + item.estimated_cost, 0))}
                        </p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {group.items.map((item, index) => (
                          <div key={`${item.label}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                            <div>
                              <p className="font-medium text-slate-900">{item.label}</p>
                              <p className="text-slate-500">{item.category}</p>
                            </div>
                            <p className="font-medium text-slate-900">{formatCurrency(item.estimated_cost)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Divider />

                <nav className="flex flex-wrap gap-3">
                  {travelFlowRoutes.map((route) => (
                    <Button
                      key={route.step}
                      as={Link}
                      href={route.href}
                      variant={route.step === "summary" ? "solid" : "bordered"}
                      className={
                        route.step === "summary"
                          ? "bg-blue-600 text-white"
                          : "border-blue-200 text-blue-700"
                      }
                    >
                      {route.step === "itinerary"
                        ? "Edit itinerary"
                        : route.step === "accommodation"
                          ? "Edit stays"
                          : "Summary"}
                    </Button>
                  ))}
                </nav>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Stepper() {
  return (
    <nav className="flex flex-wrap items-center gap-3" aria-label="Travel planning progress">
      {travelFlowRoutes.map((route, index) => {
        const isCurrent = route.step === "summary";
        const isComplete = route.step === "itinerary" || route.step === "accommodation";

        return (
          <div
            key={route.step}
            className={`flex items-center gap-3 rounded-full border px-4 py-2 ${
              isCurrent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isCurrent || isComplete ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {index + 1}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Step
              </p>
              <p className="text-sm font-medium text-slate-900">
                {route.step === "itinerary"
                  ? "Itinerary"
                  : route.step === "accommodation"
                    ? "Stays"
                    : "Summary"}
              </p>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight = false
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-blue-700" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {message}
    </div>
  );
}

function buildSummaryStays(
  plan: TravelPlanResult,
  selections: Record<string, AccommodationSearchOption>
) {
  return Object.entries(selections)
    .map(([id, property]) => {
      const dayMatch = id.match(/night-(\d+)-/);
      const dayNumber = dayMatch ? Number(dayMatch[1]) : 0;
      const itineraryDay = plan.itinerary.itinerary_days.find((day) => day.day_number === dayNumber);

      return {
        id,
        nightLabel: `Night ${dayNumber || "?"}`,
        dayNumber,
        city: itineraryDay?.city ?? "Destination",
        property
      };
    })
    .sort((left, right) => left.dayNumber - right.dayNumber);
}

function calculateItineraryCost(expenses: GeneratedExpenseDay[]) {
  return expenses.reduce(
    (tripTotal, group) =>
      tripTotal +
      group.items.reduce((dayTotal, item) => {
        if (item.category === "hotel") {
          return dayTotal;
        }
        return dayTotal + item.estimated_cost;
      }, 0),
    0
  );
}

function buildTripTitle(plan: TravelPlanResult | null) {
  if (!plan) {
    return "Final trip summary";
  }

  const destinations = plan.parsedTrip.destinations;
  if (destinations.length === 0) {
    return "Final trip summary";
  }

  return destinations.length === 1
    ? `${destinations[0]} trip summary`
    : `${destinations.join(" / ")} trip summary`;
}

function buildShareText(
  plan: TravelPlanResult | null,
  stays: SummaryStay[],
  totalEstimatedCost: number
) {
  if (!plan) {
    return "Trip summary unavailable.";
  }

  const lines: string[] = [];
  lines.push(buildTripTitle(plan));
  lines.push("");
  lines.push(`Destinations: ${plan.parsedTrip.destinations.join(", ")}`);
  lines.push(
    `Duration: ${formatDuration(plan.parsedTrip.duration_days, plan.parsedTrip.duration_nights)}`
  );
  lines.push(`Estimated total: ${formatCurrency(totalEstimatedCost)}`);
  lines.push("");
  lines.push("Itinerary:");

  plan.itinerary.itinerary_days.forEach((day) => {
    lines.push(`Day ${day.day_number} - ${day.city}: ${day.title}`);
    day.activities.forEach((activity) => {
      lines.push(`- ${activity.label} (${activity.category})`);
    });
  });

  lines.push("");
  lines.push("Selected accommodations:");
  if (stays.length === 0) {
    lines.push("- No stays selected yet.");
  } else {
    stays.forEach((stay) => {
      lines.push(
        `- ${stay.nightLabel}: ${stay.property.property_name ?? "Selected stay"} / ${stay.property.platform ?? "Platform"} / ${formatCurrency(stay.property.nightly_price ?? stay.property.total_price ?? 0)}`
      );
      if (stay.property.booking_url) {
        lines.push(`  Booking: ${stay.property.booking_url}`);
      }
    });
  }

  return lines.join("\n");
}

function formatDuration(days: number | null | undefined, nights: number | null | undefined) {
  if (days == null && nights == null) {
    return "-";
  }

  if (days != null && nights != null) {
    return `${days} days, ${nights} nights`;
  }

  if (days != null) {
    return `${days} days`;
  }

  return `${nights} nights`;
}

function formatCurrency(amount: number) {
  return `USD ${amount.toFixed(0)}`;
}

function formatLabel(value: string) {
  if (value.toLowerCase() === "wifi") {
    return "Wi-Fi";
  }

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
