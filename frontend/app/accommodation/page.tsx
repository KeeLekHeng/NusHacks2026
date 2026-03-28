"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  Textarea
} from "@heroui/react";
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
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [completedNightCount, setCompletedNightCount] = useState(0);
  const [usesMockFallback, setUsesMockFallback] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function hydrateAccommodationFlow() {
      setIsBootstrapping(true);
      setBootError(null);
      setCompletedNightCount(0);
      setUsesMockFallback(false);

      const storedPlan = loadTravelPlanFromSession();
      const nextPlan = storedPlan ?? getDemoTravelPlan();

      if (!isActive) {
        return;
      }

      setTravelPlan(nextPlan);
      setPageNotice(
        storedPlan
          ? null
          : "No finalized itinerary was found from Page 1, so this screen is using a demo trip shell."
      );
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
                      options: result.options,
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
            setCompletedNightCount((current) => current + 1);
            if (result.mode === "mock") {
              setUsesMockFallback(true);
            }
          })
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        setBootError(
          error instanceof Error
            ? error.message
            : "Unable to prepare accommodation search tasks."
        );
        setNightGroups([]);
      } finally {
        if (isActive) {
          setIsBootstrapping(false);
        }
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

  const selectedOptions = useMemo(
    () =>
      nightGroups
        .map((group) => selectedByNight[group.id])
        .filter((option): option is AccommodationSearchOption => Boolean(option)),
    [nightGroups, selectedByNight]
  );

  const selectedAccommodationCost = useMemo(
    () =>
      selectedOptions.reduce(
        (total, option) => total + (option.nightly_price ?? option.total_price ?? 0),
        0
      ),
    [selectedOptions]
  );

  const runningTripTotal = itineraryCarryCost + selectedAccommodationCost;
  const loadingNightCount = nightGroups.filter((group) => group.status === "loading").length;
  const readyNightCount = nightGroups.filter((group) => group.status === "ready").length;
  const selectedNightCount = nightGroups.filter((group) => selectedByNight[group.id]).length;

  function handleSelect(groupId: string, option: AccommodationSearchOption) {
    setSelectedByNight((current) => ({
      ...current,
      [groupId]: option
    }));
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <header className="soft-panel flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Stay Selection Workspace
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Review ranked stays night by night and lock the best fit
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Page 2 now pulls the finalized itinerary into the accommodation pipeline, loads each
              required night independently, and keeps the booking sidebar synced with live
              selections.
            </p>
          </div>
          <Stepper />
        </header>

        {(pageNotice || usesMockFallback || bootError) && (
          <div className="space-y-3">
            {pageNotice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {pageNotice}
              </div>
            )}
            {usesMockFallback && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                One or more nights fell back to mock accommodation data because the backend search
                pipeline was unavailable.
              </div>
            )}
            {bootError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {bootError}
              </div>
            )}
          </div>
        )}

        <div
          className={`grid gap-6 transition-all duration-300 ${
            isSidebarOpen
              ? "xl:grid-cols-[minmax(0,1fr)_440px]"
              : "xl:grid-cols-[minmax(0,1fr)_108px]"
          }`}
        >
          <section className="space-y-6">
            <Card className="soft-panel">
              <CardHeader className="flex flex-col items-start gap-3 px-6 pt-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Accommodation search status</p>
                  <p className="text-sm text-slate-500">
                    Search tasks are prepared from the itinerary first, then each night resolves
                    independently for smoother partial loading.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip variant="flat" className="bg-blue-50 text-blue-700">
                    {nightGroups.length === 0 ? "Preparing nights" : `${readyNightCount}/${nightGroups.length} ready`}
                  </Chip>
                  <Chip variant="flat" className="bg-slate-100 text-slate-700">
                    {loadingNightCount > 0 ? `${loadingNightCount} loading` : "Search settled"}
                  </Chip>
                </div>
              </CardHeader>
              <CardBody className="grid gap-3 px-6 pb-6 md:grid-cols-3">
                <StatusTile
                  label="Trip source"
                  value={travelPlan?.source === "backend" ? "Backend itinerary" : "Mock itinerary"}
                />
                <StatusTile
                  label="Night progress"
                  value={
                    nightGroups.length === 0
                      ? "Preparing"
                      : `${completedNightCount}/${nightGroups.length} loaded`
                  }
                />
                <StatusTile
                  label="Selected stays"
                  value={
                    nightGroups.length === 0
                      ? "0"
                      : `${selectedNightCount}/${nightGroups.length}`
                  }
                />
              </CardBody>
            </Card>

            {nightGroups.length === 0 && isBootstrapping ? (
              <Card className="soft-panel">
                <CardBody className="flex items-center gap-3 px-6 py-8">
                  <CircularProgress aria-label="Preparing accommodation flow" color="primary" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Preparing accommodation search tasks
                    </p>
                    <p className="text-sm text-slate-500">
                      Pulling the finalized itinerary into the stay-selection pipeline.
                    </p>
                  </div>
                </CardBody>
              </Card>
            ) : (
              nightGroups.map((group, index) => {
                const selectedOption = selectedByNight[group.id];

                return (
                  <Card key={group.id} className="soft-panel">
                    <CardHeader className="flex flex-col items-start gap-3 px-6 pt-6 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Chip className="bg-blue-600 text-white" size="sm">
                            {group.nightLabel}
                          </Chip>
                          <p className="text-sm font-medium text-slate-500">
                            Day {group.dayNumber} / {group.city}
                          </p>
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold text-slate-900">{group.area}</h2>
                        <p className="mt-2 text-sm text-slate-500">
                          Check-in {group.checkIn ?? "-"} / Check-out {group.checkOut ?? "-"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Chip
                          variant="flat"
                          className={
                            group.status === "loading"
                              ? "bg-blue-50 text-blue-700"
                              : group.source === "mock"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                          }
                        >
                          {group.status === "loading"
                            ? "Loading stays"
                            : group.source === "mock"
                              ? "Mock results"
                              : "Backend results"}
                        </Chip>
                        <div className="soft-subpanel px-4 py-3 text-sm text-slate-600">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Selection status
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">
                            {selectedOption ? "Stay selected" : "Choose one option"}
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardBody className="space-y-5 px-6 pb-6">
                      <div className="grid gap-3 lg:grid-cols-4">
                        <MiniMetaCard label="Target area" value={group.task.target_area ?? group.area} />
                        <MiniMetaCard
                          label="Nightly budget"
                          value={
                            group.task.nightly_budget != null
                              ? formatCurrency(group.task.nightly_budget)
                              : "Flexible"
                          }
                        />
                        <MiniMetaCard
                          label="Travelers"
                          value={group.task.traveler_count != null ? String(group.task.traveler_count) : "-"}
                        />
                        <MiniMetaCard
                          label="Reuse check"
                          value={group.task.reuse_flag ? "Enabled" : "Not needed"}
                        />
                      </div>

                      {group.reuseOption && (
                        <div className="soft-url-panel">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Reuse option</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {group.reuseOption.property_name ?? "Previous stay"} /{" "}
                                {group.reuseOption.platform ?? "Reuse check"}
                              </p>
                            </div>
                            <Chip
                              variant="flat"
                              className={
                                group.reuseOption.available
                                  ? "bg-white text-blue-700"
                                  : "bg-white text-slate-700"
                              }
                            >
                              {group.reuseOption.available ? "Available" : "Unavailable"}
                            </Chip>
                          </div>
                          <p className="mt-3 text-sm text-slate-600">
                            {group.reuseOption.notes ?? "No additional notes returned for reuse."}
                          </p>
                        </div>
                      )}

                      {group.status === "loading" ? (
                        <LoadingState />
                      ) : group.options.length === 0 ? (
                        <EmptyState message={group.error ?? "No accommodation results were returned for this night."} />
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                          {group.options.map((option, optionIndex) => {
                            const isSelected =
                              selectedByNight[group.id]?.option_id === option.option_id;
                            const imageUrl = getOptionImage(group, option, index, optionIndex);

                            return (
                              <article
                                key={option.option_id ?? `${group.id}-${optionIndex}`}
                                className={`group overflow-hidden rounded-[30px] border bg-white transition duration-200 ${
                                  isSelected
                                    ? "border-blue-500 shadow-[0_20px_44px_rgba(37,99,235,0.18)] ring-2 ring-blue-100"
                                    : "border-slate-200 shadow-sm hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]"
                                }`}
                              >
                                <div className="relative h-52 overflow-hidden border-b border-slate-200 bg-slate-200">
                                  <img
                                    src={imageUrl}
                                    alt={option.property_name ?? "Accommodation option"}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                  />
                                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                                    <Chip
                                      variant="flat"
                                      className={isSelected ? "bg-blue-600 text-white" : "bg-white text-slate-700"}
                                    >
                                      {option.platform ?? "Platform"}
                                    </Chip>
                                    {option.is_within_budget != null && (
                                      <Chip
                                        variant="flat"
                                        className={
                                          option.is_within_budget
                                            ? "bg-white text-emerald-700"
                                            : "bg-white text-amber-700"
                                        }
                                      >
                                        {option.is_within_budget ? "Within budget" : "Above budget"}
                                      </Chip>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-4 p-5">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <h3 className="text-xl font-semibold text-slate-900">
                                        {option.property_name ?? "Unnamed stay"}
                                      </h3>
                                      <p className="mt-2 text-sm leading-6 text-slate-500">
                                        {option.location_summary ?? "Location summary unavailable."}
                                      </p>
                                    </div>
                                    <div className="soft-subpanel px-3 py-2 text-right">
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                        Nightly
                                      </p>
                                      <p className="mt-1 text-lg font-semibold text-slate-900">
                                        {option.nightly_price != null
                                          ? formatCurrency(option.nightly_price)
                                          : "-"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                    <Pill label={`Rating ${formatRating(option.rating)}`} />
                                    <Pill label={`${option.review_count ?? "-"} reviews`} />
                                    <Pill
                                      label={
                                        option.distance_to_target_km != null
                                          ? `${option.distance_to_target_km.toFixed(1)} km away`
                                          : "Distance unavailable"
                                      }
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                      Why recommended
                                    </p>
                                    <p className="text-sm leading-6 text-slate-600">
                                      {option.why_recommended ?? "No recommendation notes were returned."}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                      Key amenities
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {(option.matched_amenities.length > 0
                                        ? option.matched_amenities
                                        : ["No amenity data"]).map((amenity) => (
                                        <Chip
                                          key={`${option.option_id ?? option.property_name}-${amenity}`}
                                          variant="flat"
                                          className={isSelected ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}
                                        >
                                          {formatLabel(amenity)}
                                        </Chip>
                                      ))}
                                    </div>
                                  </div>

                                  <Button
                                    color="primary"
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

            <div className="flex items-center justify-end">
              <Button
                as={Link}
                href="/summary"
                className="soft-pill-button"
                isDisabled={nightGroups.length === 0 || selectedNightCount !== nightGroups.length}
              >
                Continue to summary
              </Button>
            </div>
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="soft-panel overflow-hidden">
              <CardHeader className="flex items-center justify-between px-5 pt-5">
                <div className={isSidebarOpen ? "" : "hidden"}>
                  <p className="text-sm font-semibold text-slate-900">Booking summary</p>
                  <p className="text-sm text-slate-500">
                    Selected stays, booking URLs, and real trip totals update in place.
                  </p>
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
                  <div className="soft-url-panel">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Selected nights
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedNightCount}/{nightGroups.length || 0}
                    </p>
                  </div>

                  {nightGroups.length === 0 ? (
                    <EmptyState message="Night-by-night booking summaries will appear here after the first accommodation search task is prepared." />
                  ) : (
                    nightGroups.map((group) => {
                      const selection = selectedByNight[group.id];

                      return (
                        <div key={group.id} className="soft-subpanel p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{group.nightLabel}</p>
                              <p className="text-xs text-slate-500">
                                {group.city} / {group.area}
                              </p>
                            </div>
                            <Chip
                              variant="flat"
                              className={
                                selection
                                  ? "bg-blue-600 text-white"
                                  : group.status === "loading"
                                    ? "bg-white text-blue-700"
                                    : "bg-white text-slate-700"
                              }
                            >
                              {selection ? "Selected" : group.status === "loading" ? "Loading" : "Pending"}
                            </Chip>
                          </div>

                          {selection ? (
                            <div className="mt-4 space-y-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {selection.property_name ?? "Selected stay"}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {selection.platform ?? "Platform"} /{" "}
                                  {selection.nightly_price != null
                                    ? formatCurrency(selection.nightly_price)
                                    : "-"}
                                </p>
                              </div>
                              <div className="soft-url-panel space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                      Booking URL
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                      Wider field for inspecting the destination link before Page 3.
                                    </p>
                                  </div>
                                  {selection.booking_url && (
                                    <Button
                                      as="a"
                                      href={selection.booking_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="soft-pill-button-secondary h-10 px-4"
                                    >
                                      Open
                                    </Button>
                                  )}
                                </div>
                                <Textarea
                                  isReadOnly
                                  value={selection.booking_url ?? ""}
                                  variant="bordered"
                                  minRows={4}
                                  placeholder="Booking link will appear here once available."
                                  classNames={{
                                    base: "w-full",
                                    input: "text-xs leading-6 text-slate-700",
                                    inputWrapper:
                                      "min-h-[132px] rounded-[22px] border-blue-100 bg-white shadow-none data-[hover=true]:border-blue-300"
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="mt-4 text-sm text-slate-500">
                              {group.status === "loading"
                                ? "Options are still loading for this night."
                                : "Pick one stay card to lock in this night."}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}

                  <Divider />

                  <div className="space-y-3">
                    <SummaryRow label="Trip plan subtotal" value={formatCurrency(itineraryCarryCost)} />
                    <SummaryRow
                      label="Selected stays total"
                      value={formatCurrency(selectedAccommodationCost)}
                    />
                    <SummaryRow
                      label="Running trip total"
                      value={formatCurrency(runningTripTotal)}
                      highlight
                    />
                  </div>
                </CardBody>
              )}

              {!isSidebarOpen && (
                <CardBody className="items-center gap-4 px-3 pb-5 pt-2">
                  <div className="soft-url-panel flex w-full flex-col items-center px-3 py-4 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Selected
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

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-metric">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MiniMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-metric">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-5">
      <div className="flex items-center gap-3">
        <CircularProgress aria-label="Loading stay options" color="primary" size="sm" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Searching this night now</p>
          <p className="text-sm text-slate-500">
            TinyFish-backed results for this section will appear as soon as they return.
          </p>
        </div>
      </div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">{label}</div>;
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
