"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea
} from "@heroui/react";
import { generateTravelPlan, refineTravelPlan } from "../../lib/api";
import { saveTravelPlanToSession } from "../../lib/travel-plan-storage";
import {
  travelFlowRoutes,
  type GeneratedExpenseDay,
  type GeneratedItineraryDay,
  type ItineraryConversationMessage,
  type TravelPlanResult
} from "../../lib/trip-planner";

const initialPrompt =
  "I want to go to Ho Chi Minh + Da Lat for 4 days 3 nights with a budget of 1000 USD and I must visit The Cafe Apartments.";

export default function ItineraryPage() {
  const [composerInput, setComposerInput] = useState(initialPrompt);
  const [isExpensesOpen, setIsExpensesOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TravelPlanResult | null>(null);
  const [conversation, setConversation] = useState<ItineraryConversationMessage[]>([]);

  const itineraryDays = result?.itinerary.itinerary_days ?? [];
  const expenseGroups = useMemo(() => result?.itinerary.estimated_expenses ?? [], [result]);
  const runningTotal = useMemo(
    () =>
      expenseGroups.reduce(
        (total, group) =>
          total + group.items.reduce((dayTotal, item) => dayTotal + item.estimated_cost, 0),
        0
      ),
    [expenseGroups]
  );
  const isPlanning = isGenerating || isRefining;

  useEffect(() => {
    if (result) {
      saveTravelPlanToSession(result);
    }
  }, [result]);

  async function handleGenerate(input: string) {
    setIsGenerating(true);
    setError(null);

    try {
      const nextResult = await generateTravelPlan(input);
      setResult(nextResult);
      setConversation([
        {
          id: "initial-user",
          role: "user",
          message: input.trim()
        },
        {
          id: "initial-assistant",
          role: "assistant",
          message: nextResult.itinerary.trip_summary
        }
      ]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to generate itinerary.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefine(input: string) {
    if (!result) {
      setError("Generate an itinerary before applying refinements.");
      return;
    }

    const trimmedRefinement = input.trim();
    if (!trimmedRefinement) {
      setError("Enter a refinement request.");
      return;
    }

    setIsRefining(true);
    setError(null);

    try {
      const refinement = await refineTravelPlan(result, trimmedRefinement);
      setResult((current) =>
        current
          ? {
              ...current,
              itinerary: {
                ...current.itinerary,
                itinerary_days: refinement.updated_itinerary_days,
                estimated_expenses: refinement.updated_estimated_expenses,
                budget_summary: refinement.updated_budget_summary
              }
            }
          : current
      );
      setConversation((current) => [
        ...current,
        {
          id: `user-${current.length + 1}`,
          role: "user",
          message: trimmedRefinement
        },
        {
          id: `assistant-${current.length + 2}`,
          role: "assistant",
          message:
            refinement.explanation_summary ??
            "Updated the itinerary and expense estimates based on your latest change."
        }
      ]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to refine itinerary.");
    } finally {
      setIsRefining(false);
    }
  }

  async function handleComposerSubmit() {
    const trimmedInput = composerInput.trim();

    if (!trimmedInput) {
      setError(result ? "Enter a refinement request." : "Enter a trip request.");
      return;
    }

    setComposerInput("");

    if (result) {
      await handleRefine(trimmedInput);
      return;
    }

    await handleGenerate(trimmedInput);
  }

  return (
    <main className="h-screen overflow-hidden bg-[#f4f7fb]">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col gap-5 px-4 py-5 md:px-6 xl:px-8 2xl:max-w-[1920px]">
        <header className="soft-panel flex shrink-0 flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              Build Your Trip
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 xl:text-[2.8rem]">
              Shape the itinerary, then refine it live
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-500">
              Generate a structured trip plan, keep the itinerary visible, and refine it without
              losing the main canvas.
            </p>
          </div>
          <Stepper />
        </header>

        {(error || (result?.source === "mock" && !error)) && (
          <div className="shrink-0 space-y-3">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-base text-rose-700">
                {error}
              </div>
            )}
            {result?.source === "mock" && !error && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-base text-amber-700">
                Backend endpoints were unavailable, so the planner is using the same UI with mock
                data.
              </div>
            )}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <section className="grid min-h-0 gap-5 xl:grid-rows-[minmax(0,1fr)_auto]">
            <Card
              className={`soft-panel overflow-hidden ${
                itineraryDays.length > 0 ? "min-h-0 xl:h-[min(56vh,640px)]" : ""
              }`}
            >
              <CardHeader className="flex shrink-0 items-center justify-between gap-4 px-6 pb-4 pt-6">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Itinerary</p>
                  <p className="text-base leading-7 text-slate-500">
                    The itinerary stays front and center throughout the flow.
                  </p>
                </div>
                <Chip className="bg-blue-50 px-4 py-2 text-base text-blue-700" variant="flat">
                  {itineraryDays.length === 0
                    ? "Step 1: Generate"
                    : `Step 2: ${itineraryDays.length} days ready`}
                </Chip>
              </CardHeader>
              <CardBody className="relative min-h-0 px-6 pb-6 pt-0">
                {itineraryDays.length === 0 ? (
                  <div className="flex min-h-[210px] items-center justify-center rounded-[28px] border border-dashed border-blue-200 bg-[#f8fbff] px-6 py-10 text-center">
                    <div>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 px-3 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                        Trip
                      </div>
                      <h2 className="mt-5 text-3xl font-semibold text-slate-900">No itinerary yet</h2>
                      <p className="mt-2 text-base leading-7 text-slate-500">
                        Start by describing your trip below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`overflow-y-auto pr-2 transition duration-300 xl:h-full ${
                      isPlanning ? "opacity-20 blur-[1px]" : "opacity-100"
                    }`}
                  >
                    <div className="space-y-4">
                      {itineraryDays.map((day) => (
                        <ItineraryDayCard key={day.day_number} day={day} />
                      ))}
                    </div>
                  </div>
                )}

                {isPlanning && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/78 px-6 backdrop-blur-[2px] transition duration-300">
                    <div className="w-full max-w-xl rounded-[28px] border border-blue-100 bg-white px-6 py-7 shadow-[0_20px_48px_rgba(148,163,184,0.16)]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 px-3 py-3 text-lg text-blue-600">
                          *
                        </div>
                        <div>
                          <p className="text-xl font-semibold text-slate-900">Planning your trip...</p>
                          <p className="text-base leading-7 text-slate-500">
                            {isRefining
                              ? "Applying your latest itinerary changes."
                              : "Turning your prompt into a structured travel plan."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 space-y-3">
                        <LoadingStep label="Analyzing destinations" />
                        <LoadingStep label="Building day-by-day flow" />
                        <LoadingStep label="Estimating costs" />
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card
              className={`soft-panel shrink-0 overflow-hidden ${
                result ? "border-emerald-200 bg-[#fbfefd]" : "border-blue-200"
              }`}
            >
              <CardBody className="gap-3 px-5 py-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {result ? "Refine itinerary" : "Generate itinerary"}
                  </p>
                  <p className="text-base leading-7 text-slate-500">
                    {result
                      ? "Send a follow-up change and the itinerary updates above."
                      : "Describe destination, duration, budget, and must-visit places."}
                  </p>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <Textarea
                    minRows={2}
                    maxRows={4}
                    value={composerInput}
                    onValueChange={setComposerInput}
                    placeholder={
                      result
                        ? "Refine your trip (e.g. make day 2 cheaper, add cafes, slow the pace...)"
                        : "Describe your trip. Include destination, duration, budget, and must-visit places."
                    }
                    variant="bordered"
                    isDisabled={isGenerating || isRefining}
                    className="flex-1"
                    disableAutosize
                    classNames={{
                      inputWrapper:
                        "min-h-[112px] rounded-[24px] border-slate-200 bg-[#f8fbff] px-3 py-2 shadow-none data-[hover=true]:border-blue-300 group-data-[focus=true]:border-blue-500",
                      input: "px-2 py-2 text-base leading-8 text-slate-800"
                    }}
                  />
                  <Button
                    className="soft-pill-button min-w-[170px]"
                    isLoading={isGenerating || isRefining}
                    onPress={handleComposerSubmit}
                  >
                    {result ? "Apply" : "Generate itinerary"}
                  </Button>
                </div>
                <div className="flex items-center justify-end">
                  <Button as={Link} href="/accommodation" className="soft-pill-button" isDisabled={!result}>
                    Proceed to stays
                  </Button>
                </div>
              </CardBody>
            </Card>
          </section>

          <aside className="min-h-0">
            <Card className="soft-panel flex h-full min-h-0 flex-col overflow-hidden">
              <CardHeader className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Trip cost</p>
                  <p className="text-base leading-7 text-slate-500">Grouped by day with a running total.</p>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  className="soft-pill-toggle text-blue-600"
                  onPress={() => setIsExpensesOpen((current) => !current)}
                >
                  {isExpensesOpen ? "Collapse" : "Expand"}
                </Button>
              </CardHeader>
              {isExpensesOpen && (
                <CardBody className="min-h-0 gap-4 px-5 pb-5 pt-0">
                  {expenseGroups.length === 0 ? (
                    <div className="soft-subpanel px-4 py-6 text-center text-base text-slate-500">
                      No cost data yet
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      <div className="space-y-4">
                        {expenseGroups.map((group) => (
                          <ExpenseDayTable key={group.day_number} group={group} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="soft-url-panel shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Total
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">
                      {formatCurrency(runningTotal)}
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
        const isCurrent = route.step === "itinerary";

        return (
          <div
            key={route.step}
            className={`flex items-center gap-3 rounded-full border px-4 py-2 shadow-sm ${
              isCurrent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full px-2 py-2 text-sm font-semibold ${
                isCurrent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
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

function ItineraryDayCard({ day }: { day: GeneratedItineraryDay }) {
  return (
    <article className="soft-subpanel p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Chip className="bg-blue-600 px-3 py-1.5 text-base text-white" size="sm">
              Day {day.day_number}
            </Chip>
            <p className="text-base font-medium text-slate-500">{day.city}</p>
            {day.start_area && (
              <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm">
                {day.start_area}
              </span>
            )}
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">{day.title}</h2>
          {day.end_area && (
            <p className="mt-2 text-base leading-7 text-slate-500">Ends near {day.end_area}</p>
          )}
        </div>

        <div className="soft-panel min-w-[150px] px-4 py-3 shadow-none">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Estimated cost
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(day.estimated_day_cost)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {day.activities.map((activity, index) => (
          <div
            key={`${activity.label}-${index}`}
            className="rounded-[22px] border border-white bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-slate-900">{activity.label}</p>
                  <Chip size="sm" variant="flat" className="bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                    {activity.category}
                  </Chip>
                </div>
                {activity.notes && (
                  <p className="mt-2 text-base leading-7 text-slate-600">{activity.notes}</p>
                )}
              </div>
              {activity.estimated_cost != null && (
                <p className="shrink-0 text-lg font-semibold text-slate-900">
                  {formatCurrency(activity.estimated_cost)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ExpenseDayTable({ group }: { group: GeneratedExpenseDay }) {
  const dayTotal = group.items.reduce((total, item) => total + item.estimated_cost, 0);

  return (
    <div className="soft-subpanel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">Day {group.day_number}</p>
          <p className="text-sm text-slate-500">{group.city}</p>
        </div>
        <p className="text-base font-semibold text-slate-900">{formatCurrency(dayTotal)}</p>
      </div>

      <Table
        removeWrapper
        aria-label={`Expenses for day ${group.day_number}`}
        classNames={{
          th: "bg-slate-100 text-[11px] uppercase tracking-[0.16em] text-slate-500",
          td: "align-top text-sm text-slate-600"
        }}
      >
        <TableHeader>
          <TableColumn>Item</TableColumn>
          <TableColumn>URL</TableColumn>
          <TableColumn>Cost</TableColumn>
        </TableHeader>
        <TableBody>
          {group.items.map((item, index) => (
            <TableRow key={`${item.label}-${index}`}>
              <TableCell className="font-medium text-slate-900">{item.label}</TableCell>
              <TableCell>{item.url || "-"}</TableCell>
              <TableCell>{formatCurrency(item.estimated_cost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LoadingStep({ label }: { label: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-[#f8fbff] px-5 py-4 text-base text-slate-600 opacity-90 animate-pulse">
      <span className="font-medium text-blue-600">{">"}</span>
      <span className="ml-3">{label}</span>
    </div>
  );
}

function formatCurrency(amount: number) {
  return `USD ${amount.toFixed(0)}`;
}
