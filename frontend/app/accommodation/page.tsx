"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";
import {
  getDemoTravelPlan,
  prepareAccommodationTasks,
  searchAccommodationForNight
} from "../../lib/api";
import {
  loadAccommodationSelectionsFromSession,
  loadTravelPlanFromSession,
  saveAccommodationSelectionsToSession
} from "../../lib/travel-plan-storage";
import {
  travelFlowRoutes,
  type AccommodationNightGroup,
  type AccommodationSearchOption,
  type AccommodationSearchTask,
  type GeneratedExpenseDay,
  type TravelPlanResult
} from "../../lib/trip-planner";

const optionImages = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80"
];

export default function AccommodationPage() {
  const [travelPlan, setTravelPlan] = useState<TravelPlanResult | null>(null);
  const [nightGroups, setNightGroups] = useState<AccommodationNightGroup[]>([]);
  const [selectedByNight, setSelectedByNight] = useState<Record<string, AccommodationSearchOption>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function hydrateAccommodationFlow() {
      const storedPlan = loadTravelPlanFromSession();
      const nextPlan = storedPlan ?? getDemoTravelPlan();

      if (!isActive) {
        return;
      }

      setTravelPlan(nextPlan);
      setSelectedByNight(loadAccommodationSelectionsFromSession());

      try {
        const tasks = await prepareAccommodationTasks(nextPlan);
        if (!isActive) {
          return;
        }

        setNightGroups(tasks.map((task) => createNightGroup(task)));

        await Promise.all(
          tasks.map(async (task) => {
            const result = await searchAccommodationForNight(task);
            if (!isActive) {
              return;
            }

            setNightGroups((current) =>
              current.map((group) =>
                group.id === buildNightGroupId(task)
                  ? {
                      ...group,
                      options: result.options.slice(0, 3),
                      reuseOption: result.reuse_option ?? null,
                      source: result.mode,
                      status: result.options.length > 0 ? "ready" : "error",
                      error:
                        result.options.length > 0
                          ? null
                          : "No accommodation options were returned for this night."
                    }
                  : group
              )
            );
          })
        );
      } catch {
        if (!isActive) {
          return;
        }

        setNightGroups([]);
      }
    }

    void hydrateAccommodationFlow();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    saveAccommodationSelectionsToSession(selectedByNight);
  }, [selectedByNight]);

  const itineraryCarryCost = useMemo(
    () => calculateNonAccommodationSpend(travelPlan?.itinerary.estimated_expenses ?? []),
    [travelPlan]
  );

  const selectedNightCount = nightGroups.filter((group) => selectedByNight[group.id]).length;
  const selectedAccommodationCost = useMemo(
    () =>
      Object.values(selectedByNight).reduce(
        (total, option) => total + (option.nightly_price ?? option.total_price ?? 0),
        0
      ),
    [selectedByNight]
  );
  const runningTripTotal = itineraryCarryCost + selectedAccommodationCost;

  function handleSelect(groupId: string, option: AccommodationSearchOption) {
    setSelectedByNight((current) => ({
      ...current,
      [groupId]: option
    }));
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8 2xl:max-w-[1920px]">
        <header className="soft-panel flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              Step 2 of 3
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Choose your stays
            </h1>
          </div>
          <Stepper />
        </header>

        <div
          className={`grid gap-6 transition-all duration-300 ${
            isSidebarOpen
              ? "xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]"
              : "xl:grid-cols-[minmax(0,1fr)_112px]"
          }`}
        >
          <section className="space-y-6">
            {nightGroups.length === 0 ? (
              <div className="space-y-6">
                {[1, 2, 3].map((night) => (
                  <NightSkeleton key={night} />
                ))}
              </div>
            ) : (
              nightGroups.map((group, groupIndex) => {
                const selectedOption = selectedByNight[group.id];

                return (
                  <Card key={group.id} className="soft-panel">
                    <CardHeader className="px-6 pb-4 pt-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-2xl font-semibold text-slate-900">
                            {group.nightLabel} - {group.city}
                          </p>
                        </div>
                        <p className="mt-2 text-lg text-slate-500">{group.area}</p>
                      </div>
                    </CardHeader>

                    <CardBody className="px-6 pb-6 pt-0">
                      {group.status === "loading" ? (
                        <div className="grid gap-4 lg:grid-cols-3">
                          {[0, 1, 2].map((index) => (
                            <StayCardSkeleton key={`${group.id}-skeleton-${index}`} />
                          ))}
                        </div>
                      ) : group.options.length === 0 ? (
                        <div className="soft-subpanel px-5 py-6 text-base text-slate-500">
                          {group.error ?? "No accommodation options available yet."}
                        </div>
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-3">
                          {group.options.map((option, optionIndex) => {
                            const isSelected =
                              selectedByNight[group.id]?.option_id === option.option_id;
                            const imageUrl = getOptionImage(group, option, groupIndex, optionIndex);
                            const amenities = option.matched_amenities.slice(0, 3);

                            return (
                              <article
                                key={option.option_id ?? `${group.id}-${optionIndex}`}
                                className={`group overflow-hidden rounded-[30px] border bg-white transition duration-200 ${
                                  isSelected
                                    ? "scale-[1.02] border-blue-500 shadow-[0_20px_44px_rgba(37,99,235,0.18)] ring-2 ring-blue-100"
                                    : "border-slate-200 shadow-sm hover:-translate-y-1 hover:scale-[1.01] hover:border-blue-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]"
                                }`}
                              >
                                <div className="relative h-52 overflow-hidden bg-slate-200">
                                  <img
                                    src={imageUrl}
                                    alt={option.property_name ?? "Accommodation option"}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                  />
                                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                                    <Chip variant="flat" className="bg-white px-3 py-1.5 text-sm text-slate-700">
                                      {option.platform ?? "Platform"}
                                    </Chip>
                                    {isSelected && (
                                      <Chip className="bg-blue-600 px-3 py-1.5 text-sm text-white">
                                        Selected
                                      </Chip>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-4 p-5">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <h3 className="text-2xl font-semibold text-slate-900">
                                        {option.property_name ?? "Unnamed stay"}
                                      </h3>
                                      <p className="mt-2 text-base leading-7 text-slate-500">
                                        {option.location_summary ?? "Location summary unavailable."}
                                      </p>
                                    </div>
                                    <div className="soft-subpanel px-4 py-3 text-right">
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                        Per night
                                      </p>
                                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                                        {option.nightly_price != null
                                          ? formatCurrency(option.nightly_price)
                                          : "-"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                    <Pill label={`Rating ${formatRating(option.rating)}`} />
                                    <Pill
                                      label={
                                        option.distance_to_target_km != null
                                          ? `${option.distance_to_target_km.toFixed(1)} km away`
                                          : "Distance unavailable"
                                      }
                                    />
                                  </div>

                                  <p className="text-base leading-7 text-slate-600">
                                    {option.why_recommended ?? "A strong fit for this night."}
                                  </p>

                                  <div className="flex flex-wrap gap-2">
                                    {(amenities.length > 0 ? amenities : ["No amenity data"]).map((amenity) => (
                                      <Chip
                                        key={`${option.option_id ?? option.property_name}-${amenity}`}
                                        variant="flat"
                                        className="bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                                      >
                                        {formatLabel(amenity)}
                                      </Chip>
                                    ))}
                                  </div>

                                  <Button
                                    className={`w-full ${
                                      isSelected ? "soft-pill-button bg-blue-700" : "soft-pill-button"
                                    }`}
                                    onPress={() => handleSelect(group.id, option)}
                                  >
                                    {isSelected ? "Selected stay" : "Select stay"}
                                  </Button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })
            )}
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="soft-panel overflow-hidden">
              <CardHeader className="flex items-center justify-between px-5 pt-5">
                <div className={isSidebarOpen ? "" : "hidden"}>
                  <p className="text-lg font-semibold text-slate-900">Trip summary</p>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  className="soft-pill-toggle min-w-[88px] text-blue-600"
                  onPress={() => setIsSidebarOpen((current) => !current)}
                >
                  {isSidebarOpen ? "Collapse" : "Expand"}
                </Button>
              </CardHeader>

              {isSidebarOpen && (
                <CardBody className="gap-4 px-5 pb-5">
                  {nightGroups.length === 0 ? (
                    [1, 2, 3].map((night) => (
                      <div key={`sidebar-skeleton-${night}`} className="soft-subpanel animate-pulse px-4 py-5">
                        <div className="h-5 w-24 rounded-full bg-slate-200" />
                        <div className="mt-3 h-4 w-40 rounded-full bg-slate-100" />
                      </div>
                    ))
                  ) : (
                    nightGroups.map((group) => {
                      const selection = selectedByNight[group.id];

                      return (
                        <div key={group.id} className="soft-subpanel p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-900">{group.nightLabel}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {selection ? selection.property_name ?? "Selected stay" : "Pending"}
                              </p>
                            </div>
                            <Chip
                              variant="flat"
                              className={
                                selection
                                  ? "bg-blue-600 px-3 py-1.5 text-sm text-white"
                                  : "bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                              }
                            >
                              {selection ? "Selected" : "Pending"}
                            </Chip>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div className="space-y-3">
                    <SummaryRow label="Trip plan subtotal" value={formatCurrency(itineraryCarryCost)} />
                    <SummaryRow label="Selected stays" value={formatCurrency(selectedAccommodationCost)} />
                    <SummaryRow label="Total" value={formatCurrency(runningTripTotal)} highlight />
                  </div>

                  <Button
                    as={Link}
                    href="/summary"
                    className="soft-pill-button w-full"
                    isDisabled={nightGroups.length === 0 || selectedNightCount !== nightGroups.length}
                  >
                    Continue to Summary
                  </Button>
                </CardBody>
              )}

              {!isSidebarOpen && (
                <CardBody className="items-center gap-4 px-3 pb-5 pt-2">
                  <div className="soft-url-panel flex w-full flex-col items-center px-3 py-4 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Nights
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedNightCount}</p>
                  </div>
                  <div className="soft-url-panel flex w-full flex-col items-center px-3 py-4 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Total
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {formatCurrency(runningTripTotal)}
                    </p>
                  </div>
                </CardBody>
              )}
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
        const isCurrent = route.step === "accommodation";
        const isComplete = route.step === "itinerary";

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

function StayCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm animate-pulse">
      <div className="h-52 bg-slate-200" />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-7 w-48 rounded-full bg-slate-200" />
            <div className="h-4 w-56 rounded-full bg-slate-100" />
            <div className="h-4 w-40 rounded-full bg-slate-100" />
          </div>
          <div className="h-20 w-28 rounded-[22px] bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-full bg-slate-100" />
          <div className="h-8 w-28 rounded-full bg-slate-100" />
        </div>
        <div className="h-4 w-full rounded-full bg-slate-100" />
        <div className="h-4 w-4/5 rounded-full bg-slate-100" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-slate-100" />
          <div className="h-8 w-24 rounded-full bg-slate-100" />
          <div className="h-8 w-16 rounded-full bg-slate-100" />
        </div>
        <div className="h-12 w-full rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

function NightSkeleton() {
  return (
    <Card className="soft-panel">
      <CardHeader className="px-6 pb-4 pt-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-56 rounded-full bg-slate-200" />
          <div className="h-5 w-32 rounded-full bg-slate-100" />
        </div>
      </CardHeader>
      <CardBody className="px-6 pb-6 pt-0">
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <StayCardSkeleton key={`night-skeleton-card-${index}`} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
      {label}
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
    <div className="soft-subpanel flex items-center justify-between gap-3 px-4 py-3">
      <p className="text-base text-slate-500">{label}</p>
      <p className={`text-base font-semibold ${highlight ? "text-blue-700" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

function createNightGroup(task: AccommodationSearchTask): AccommodationNightGroup {
  return {
    id: buildNightGroupId(task),
    nightLabel: `Night ${task.day_number}`,
    dayNumber: task.day_number,
    city: task.city,
    area: task.target_area ?? `${task.city} Center`,
    checkIn: task.check_in_date ?? null,
    checkOut: task.check_out_date ?? null,
    task,
    options: [],
    reuseOption: null,
    source: "backend",
    status: "loading",
    error: null
  };
}

function buildNightGroupId(task: AccommodationSearchTask) {
  return `night-${task.day_number}-${task.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function calculateNonAccommodationSpend(expenseGroups: GeneratedExpenseDay[]) {
  return expenseGroups.reduce(
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

function getOptionImage(
  group: AccommodationNightGroup,
  option: AccommodationSearchOption,
  groupIndex: number,
  optionIndex: number
) {
  const platformBias = option.platform?.toLowerCase().includes("trip") ? 1 : 0;
  const cityBias = group.city.toLowerCase().includes("da lat") ? 2 : 0;
  const imageIndex = (groupIndex * 2 + optionIndex + platformBias + cityBias) % optionImages.length;
  return optionImages[imageIndex];
}

function formatCurrency(amount: number) {
  return `USD ${amount.toFixed(0)}`;
}

function formatRating(rating: number | null | undefined) {
  return rating != null ? rating.toFixed(1) : "-";
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
