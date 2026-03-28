"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip
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
    setPageNotice(null);
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
  const routeLabel = useMemo(
    () => travelPlan?.parsedTrip.destinations.join(" -> ") ?? "Trip route",
    [travelPlan]
  );
  const groupedDailyCosts = useMemo(
    () => buildGroupedDailyCosts(itineraryExpenses, selectedStays),
    [itineraryExpenses, selectedStays]
  );
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

  async function handleExport() {
    try {
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
      setShareStatus({ tone: "error", message: "Unable to export the summary." });
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8 2xl:max-w-[1920px]">
        <header className="soft-panel flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              Step 3 of 3
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Your Trip Summary
            </h1>
          </div>
          <Stepper />
        </header>

        {(pageNotice || shareStatus) && (
          <div className="space-y-3">
            {pageNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-base text-amber-700">
                {pageNotice}
              </div>
            )}
            {shareStatus && (
              <div
                className={`rounded-2xl px-5 py-4 text-base ${
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
          <section className="space-y-6">
            <Card className="soft-panel">
              <CardHeader className="px-6 pt-6">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Overview</p>
                  <p className="text-base leading-7 text-slate-500">
                    A clean snapshot of the trip before you dive into details.
                  </p>
                </div>
              </CardHeader>
              <CardBody className="grid gap-4 px-6 pb-6 md:grid-cols-3">
                <OverviewMetric label="Route" value={routeLabel} />
                <OverviewMetric
                  label="Duration"
                  value={formatDuration(travelPlan?.parsedTrip.duration_days, travelPlan?.parsedTrip.duration_nights)}
                />
                <OverviewMetric label="Total Estimated Cost" value={formatCurrency(totalEstimatedCost)} />
              </CardBody>
            </Card>

            <Card className="soft-panel">
              <CardHeader className="px-6 pt-6">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Itinerary</p>
                </div>
              </CardHeader>
              <CardBody className="px-4 pb-4 pt-2">
                <Accordion
                  selectionMode="multiple"
                  variant="splitted"
                  itemClasses={{
                    base: "soft-subpanel px-2 shadow-none",
                    trigger: "px-4 py-4",
                    title: "text-lg font-semibold text-slate-900",
                    subtitle: "text-sm text-slate-500",
                    content: "px-4 pb-5 pt-0"
                  }}
                >
                  {(travelPlan?.itinerary.itinerary_days ?? []).map((day) => (
                    <AccordionItem
                      key={`day-${day.day_number}`}
                      aria-label={`Day ${day.day_number}`}
                      title={`Day ${day.day_number} - ${day.city}`}
                      subtitle={day.title}
                    >
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Chip className="bg-blue-50 px-3 py-1.5 text-sm text-blue-700" variant="flat">
                            {formatCurrency(day.estimated_day_cost)}
                          </Chip>
                          <span className="text-sm text-slate-500">
                            {day.start_area ?? "-"} -> {day.end_area ?? "-"}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {day.activities.map((activity, index) => (
                            <div
                              key={`${activity.label}-${index}`}
                              className="rounded-[20px] border border-white bg-white px-4 py-4 shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-base font-semibold text-slate-900">{activity.label}</p>
                                  {activity.notes && (
                                    <p className="mt-1 text-sm leading-6 text-slate-500">
                                      {activity.notes}
                                    </p>
                                  )}
                                </div>
                                {activity.estimated_cost != null && (
                                  <p className="text-sm font-semibold text-slate-900">
                                    {formatCurrency(activity.estimated_cost)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardBody>
            </Card>

            <Card className="soft-panel">
              <CardHeader className="px-6 pt-6">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Selected Stays</p>
                </div>
              </CardHeader>
              <CardBody className="px-4 pb-4 pt-2">
                <Accordion
                  selectionMode="multiple"
                  variant="splitted"
                  itemClasses={{
                    base: "soft-subpanel px-2 shadow-none",
                    trigger: "px-4 py-4",
                    title: "text-lg font-semibold text-slate-900",
                    subtitle: "text-sm text-slate-500",
                    content: "px-4 pb-5 pt-0"
                  }}
                >
                  {selectedStays.length === 0 ? (
                    <AccordionItem
                      key="no-stays"
                      aria-label="No stays"
                      title="No stays selected"
                      subtitle="Select accommodations on the previous page to complete your trip."
                    >
                      <p className="text-sm text-slate-500">No accommodation details available yet.</p>
                    </AccordionItem>
                  ) : (
                    selectedStays.map((stay) => (
                      <AccordionItem
                        key={stay.id}
                        aria-label={stay.nightLabel}
                        title={`${stay.nightLabel} - ${stay.city}`}
                        subtitle={stay.property.property_name ?? "Selected stay"}
                      >
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Chip className="bg-blue-50 px-3 py-1.5 text-sm text-blue-700" variant="flat">
                              {formatCurrency(stay.property.nightly_price ?? stay.property.total_price ?? 0)}
                            </Chip>
                            <span className="text-sm text-slate-500">
                              {stay.property.platform ?? "Platform"}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(stay.property.matched_amenities.length > 0
                              ? stay.property.matched_amenities
                              : ["No amenity data"]).map((amenity) => (
                              <Chip
                                key={`${stay.id}-${amenity}`}
                                variant="flat"
                                className="bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                              >
                                {formatLabel(amenity)}
                              </Chip>
                            ))}
                          </div>

                          {stay.property.booking_url && (
                            <Button
                              as="a"
                              href={stay.property.booking_url}
                              target="_blank"
                              rel="noreferrer"
                              className="soft-pill-button-secondary h-11 px-5"
                            >
                              Open Booking Link
                            </Button>
                          )}
                        </div>
                      </AccordionItem>
                    ))
                  )}
                </Accordion>
              </CardBody>
            </Card>

            <Card className="soft-panel">
              <CardHeader className="flex flex-col items-start gap-3 px-6 pt-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Share</p>
                </div>
              </CardHeader>
              <CardBody className="flex flex-wrap gap-3 px-6 pb-6">
                <Button className="soft-pill-button" onPress={handleCopySummary}>
                  Copy Summary
                </Button>
                <Button className="soft-pill-button-secondary" onPress={handleExport}>
                  Export
                </Button>
              </CardBody>
            </Card>
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="soft-panel">
              <CardHeader className="px-5 pt-5">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Total Cost</p>
                </div>
              </CardHeader>
              <CardBody className="gap-4 px-5 pb-5">
                <div className="soft-url-panel">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Total Trip Cost
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {formatCurrency(totalEstimatedCost)}
                  </p>
                </div>

                <div className="space-y-3">
                  <CostRow label="Itinerary" value={formatCurrency(itineraryNonHotelCost)} />
                  <CostRow label="Stays" value={formatCurrency(selectedStayCost)} />
                </div>

                <div className="soft-subpanel px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Day-by-Day Costs
                  </p>
                  <div className="mt-4 space-y-4">
                    {groupedDailyCosts.map((day) => (
                      <div key={`cost-day-${day.dayNumber}`} className="rounded-[20px] border border-white bg-white px-4 py-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Day {day.dayNumber}</p>
                            <p className="text-xs text-slate-500">{day.city}</p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(day.total)}
                          </p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {day.items.map((item, index) => (
                            <ExpenseListRow
                              key={`day-${day.dayNumber}-${item.label}-${index}`}
                              label={item.label}
                              value={formatCurrency(item.amount)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button as={Link} href="/itinerary" className="soft-pill-button-secondary">
                    Edit Itinerary
                  </Button>
                  <Button as={Link} href="/accommodation" className="soft-pill-button-secondary">
                    Edit Stays
                  </Button>
                </div>
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
            className={`flex items-center gap-3 rounded-full border px-4 py-2 shadow-sm ${
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
            <p className="text-base font-medium text-slate-900">
              {route.step === "itinerary"
                ? "Itinerary"
                : route.step === "accommodation"
                  ? "Stays"
                  : "Summary"}
            </p>
          </div>
        );
      })}
    </nav>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-metric">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-subpanel flex items-center justify-between gap-3 px-4 py-3">
      <p className="text-base text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ExpenseListRow({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[16px] bg-slate-50 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function buildGroupedDailyCosts(expenses: GeneratedExpenseDay[], stays: SummaryStay[]) {
  return expenses.map((group) => {
    const itineraryItems = group.items
      .filter((item) => item.category !== "hotel")
      .map((item) => ({
        label: item.label,
        amount: item.estimated_cost
      }));

    const stayItems = stays
      .filter((stay) => stay.dayNumber === group.day_number)
      .map((stay) => ({
        label: stay.property.property_name ?? stay.nightLabel,
        amount: stay.property.nightly_price ?? stay.property.total_price ?? 0
      }));

    const items = [...itineraryItems, ...stayItems];
    const total = items.reduce((sum, item) => sum + item.amount, 0);

    return {
      dayNumber: group.day_number,
      city: group.city,
      items,
      total
    };
  });
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
    return "Your trip summary";
  }

  const destinations = plan.parsedTrip.destinations;
  if (destinations.length === 0) {
    return "Your trip summary";
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
  lines.push(`Route: ${plan.parsedTrip.destinations.join(" -> ")}`);
  lines.push(
    `Duration: ${formatDuration(plan.parsedTrip.duration_days, plan.parsedTrip.duration_nights)}`
  );
  lines.push(`Estimated total: ${formatCurrency(totalEstimatedCost)}`);
  lines.push("");
  lines.push("Itinerary:");

  plan.itinerary.itinerary_days.forEach((day) => {
    lines.push(`Day ${day.day_number} - ${day.city}: ${day.title}`);
    day.activities.forEach((activity) => {
      lines.push(`- ${activity.label}`);
    });
  });

  lines.push("");
  lines.push("Selected stays:");
  if (stays.length === 0) {
    lines.push("- No stays selected yet.");
  } else {
    stays.forEach((stay) => {
      lines.push(
        `- ${stay.nightLabel}: ${stay.property.property_name ?? "Selected stay"} / ${formatCurrency(stay.property.nightly_price ?? stay.property.total_price ?? 0)}`
      );
    });
  }

  return lines.join("\n");
}

function formatDuration(days: number | null | undefined, nights: number | null | undefined) {
  if (days == null && nights == null) {
    return "-";
  }

  if (days != null && nights != null) {
    return `${days} Days • ${nights} Nights`;
  }

  if (days != null) {
    return `${days} Days`;
  }

  return `${nights} Nights`;
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
