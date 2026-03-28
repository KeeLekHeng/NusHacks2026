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
  Input,
  Snippet,
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
  type ParsedTripData,
  type TravelPlanResult
} from "../../lib/trip-planner";

const initialPrompt =
  "I want to go to Ho Chi Minh + Da Lat for 4 days 3 nights. I definitely won't miss The Cafe Apartments in Ho Chi Minh City and budget within 1000 dollars.";

export default function ItineraryPage() {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [refinementInput, setRefinementInput] = useState("");
  const [isExpensesOpen, setIsExpensesOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TravelPlanResult | null>(null);
  const [conversation, setConversation] = useState<ItineraryConversationMessage[]>([]);

  const expenseGroups = useMemo(
    () => result?.itinerary.estimated_expenses ?? [],
    [result]
  );

  const runningTotal = useMemo(
    () =>
      expenseGroups.reduce(
        (total, group) =>
          total + group.items.reduce((dayTotal, item) => dayTotal + item.estimated_cost, 0),
        0
      ),
    [expenseGroups]
  );

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);

    try {
      const nextResult = await generateTravelPlan(prompt);
      setResult(nextResult);
      setConversation([
        {
          id: "initial-user",
          role: "user",
          message: prompt.trim()
        },
        {
          id: "initial-assistant",
          role: "assistant",
          message: nextResult.itinerary.trip_summary
        }
      ]);
      setRefinementInput("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to generate itinerary.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefine() {
    if (!result) {
      setError("Generate an itinerary before sending refinements.");
      return;
    }

    const trimmedRefinement = refinementInput.trim();
    if (!trimmedRefinement) {
      setError("Enter a follow-up refinement request.");
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
      setRefinementInput("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to refine itinerary.");
    } finally {
      setIsRefining(false);
    }
  }

  const parsedTrip = result?.parsedTrip;
  const itineraryDays = result?.itinerary.itinerary_days ?? [];
  const budgetSummary = result?.itinerary.budget_summary;

  useEffect(() => {
    if (result) {
      saveTravelPlanToSession(result);
    }
  }, [result]);

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Travel Planning Workspace
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Build and refine the itinerary before choosing stays
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Page 1 keeps the itinerary preview as the primary artifact, while follow-up edits
              update the plan and the estimated expenses in place.
            </p>
          </div>
          <Stepper />
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="flex flex-col items-start gap-2 px-6 pt-6">
                <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Natural language request</p>
                    <p className="text-sm text-slate-500">
                      Initial submit calls the parser and itinerary generator in sequence.
                    </p>
                  </div>
                  <Chip
                    className="border border-blue-100 bg-blue-50 text-blue-700"
                    variant="flat"
                  >
                    {result == null
                      ? "Ready to generate"
                      : result.source === "mock"
                        ? "Mock fallback active"
                        : "Backend response loaded"}
                  </Chip>
                </div>
              </CardHeader>
              <CardBody className="gap-4 px-6 pb-6">
                <Textarea
                  minRows={6}
                  value={prompt}
                  onValueChange={setPrompt}
                  variant="bordered"
                  label="Trip request"
                  labelPlacement="outside"
                  placeholder="Describe destinations, duration, budget, must-visit places, and preferences."
                  classNames={{
                    inputWrapper:
                      "border-slate-200 bg-slate-50 shadow-none data-[hover=true]:border-blue-300 group-data-[focus=true]:border-blue-500",
                    input: "text-sm text-slate-800"
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    color="primary"
                    className="bg-blue-600 font-medium text-white"
                    isLoading={isGenerating}
                    onPress={handleGenerate}
                  >
                    Generate itinerary
                  </Button>
                  {isGenerating && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <CircularProgress aria-label="Generating itinerary" size="sm" />
                      Parsing trip and building itinerary...
                    </div>
                  )}
                </div>
                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}
                {result?.source === "mock" && !error && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Backend endpoints were unavailable, so the page is showing a graceful mock
                    response using the same render structure.
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <RefinementPanel
                conversation={conversation}
                refinementInput={refinementInput}
                setRefinementInput={setRefinementInput}
                onRefine={handleRefine}
                isRefining={isRefining}
                isDisabled={!result}
              />
              <ParsedTripCard parsedTrip={parsedTrip} />
            </div>

            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="flex flex-col items-start gap-2 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Structured itinerary preview</p>
                  <p className="text-sm text-slate-500">
                    This remains the main artifact and updates after each refinement.
                  </p>
                </div>
                <Snippet
                  hideSymbol
                  variant="flat"
                  classNames={{
                    base: "bg-blue-50 text-blue-700"
                  }}
                >
                  {itineraryDays.length} day{itineraryDays.length === 1 ? "" : "s"} planned
                </Snippet>
              </CardHeader>
              <CardBody className="gap-4 px-6 pb-6">
                {itineraryDays.length === 0 ? (
                  <EmptyState message="Generate a trip to see the parsed itinerary preview here." />
                ) : (
                  itineraryDays.map((day) => <ItineraryDayCard key={day.day_number} day={day} />)
                )}
              </CardBody>
            </Card>

            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="px-6 pt-6">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Budget summary</p>
                  <p className="text-sm text-slate-500">
                    Rough estimates update alongside each itinerary refinement.
                  </p>
                </div>
              </CardHeader>
              <CardBody className="grid gap-3 px-6 pb-6 md:grid-cols-4">
                <SummaryTile
                  label="Estimated total"
                  value={budgetSummary ? formatCurrency(budgetSummary.total_estimated_cost) : "-"}
                />
                <SummaryTile
                  label="Budget"
                  value={
                    budgetSummary?.total_budget_usd != null
                      ? formatCurrency(budgetSummary.total_budget_usd)
                      : "-"
                  }
                />
                <SummaryTile
                  label="Remaining"
                  value={
                    budgetSummary?.remaining_budget_usd != null
                      ? formatCurrency(budgetSummary.remaining_budget_usd)
                      : "-"
                  }
                />
                <SummaryTile
                  label="Status"
                  value={
                    budgetSummary?.is_within_budget == null
                      ? "No budget set"
                      : budgetSummary.is_within_budget
                        ? "Within budget"
                        : "Over budget"
                  }
                />
              </CardBody>
            </Card>

            <div className="flex items-center justify-end">
              <Button
                as={Link}
                href="/accommodation"
                color="primary"
                className="bg-blue-600 px-6 text-white"
                isDisabled={!result}
              >
                Proceed to stays
              </Button>
            </div>
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="border border-blue-100 bg-white shadow-sm">
              <CardHeader className="flex items-center justify-between px-5 pt-5">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Estimated expenses</p>
                  <p className="text-sm text-slate-500">
                    Grouped by day and refreshed after every itinerary change.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  className="text-blue-600"
                  onPress={() => setIsExpensesOpen((current) => !current)}
                >
                  {isExpensesOpen ? "Collapse" : "Expand"}
                </Button>
              </CardHeader>
              {isExpensesOpen && (
                <CardBody className="gap-4 px-5 pb-5">
                  {expenseGroups.length === 0 ? (
                    <EmptyState message="Expense estimates appear here after the first itinerary run." />
                  ) : (
                    expenseGroups.map((group) => (
                      <ExpenseDayTable key={group.day_number} group={group} />
                    ))
                  )}
                  <Divider />
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Running total
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
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
            className={`flex items-center gap-3 rounded-full border px-4 py-2 ${
              isCurrent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isCurrent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
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

function RefinementPanel({
  conversation,
  refinementInput,
  setRefinementInput,
  onRefine,
  isRefining,
  isDisabled
}: {
  conversation: ItineraryConversationMessage[];
  refinementInput: string;
  setRefinementInput: (value: string) => void;
  onRefine: () => void;
  isRefining: boolean;
  isDisabled: boolean;
}) {
  return (
    <Card className="border border-blue-100 bg-white shadow-sm">
      <CardHeader className="px-6 pt-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">Refine itinerary</p>
          <p className="text-sm text-slate-500">
            Send focused edits like "Make day 2 cheaper" or "Add more cafes in Ho Chi Minh".
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4 px-6 pb-6">
        <div className="space-y-3">
          {conversation.length === 0 ? (
            <EmptyState message="The initial planner summary and follow-up edits will appear here after the first generation." />
          ) : (
            conversation.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl border p-4 ${
                  message.role === "assistant"
                    ? "border-blue-100 bg-blue-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {message.role === "assistant" ? "Planner" : "You"}
                  </p>
                  <Chip
                    size="sm"
                    variant="flat"
                    className={
                      message.role === "assistant"
                        ? "bg-white text-blue-700"
                        : "bg-white text-slate-700"
                    }
                  >
                    {message.role}
                  </Chip>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{message.message}</p>
              </div>
            ))
          )}
        </div>

        <Divider />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={refinementInput}
            onValueChange={setRefinementInput}
            placeholder="Make day 2 cheaper, add more cafes, or slow the pace."
            variant="bordered"
            isDisabled={isDisabled || isRefining}
            className="flex-1"
            classNames={{
              inputWrapper:
                "border-slate-200 bg-slate-50 shadow-none data-[hover=true]:border-blue-300 group-data-[focus=true]:border-blue-500"
            }}
          />
          <Button
            color="primary"
            className="bg-blue-600 text-white"
            isDisabled={isDisabled}
            isLoading={isRefining}
            onPress={onRefine}
          >
            Apply change
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ParsedTripCard({ parsedTrip }: { parsedTrip: ParsedTripData | null | undefined }) {
  return (
    <Card className="border border-blue-100 bg-white shadow-sm">
      <CardHeader className="px-6 pt-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">Parsed trip summary</p>
          <p className="text-sm text-slate-500">
            Structured fields extracted from the backend parser response.
          </p>
        </div>
      </CardHeader>
      <CardBody className="gap-4 px-6 pb-6">
        {!parsedTrip ? (
          <EmptyState message="Generate a trip to inspect the parsed request fields." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryTile label="Destinations" value={parsedTrip.destinations.join(", ") || "-"} />
              <SummaryTile
                label="Duration"
                value={formatDuration(parsedTrip.duration_days, parsedTrip.duration_nights)}
              />
              <SummaryTile
                label="Budget"
                value={
                  parsedTrip.total_budget_usd != null
                    ? formatCurrency(parsedTrip.total_budget_usd)
                    : "-"
                }
              />
              <SummaryTile
                label="Travelers"
                value={parsedTrip.traveler_count != null ? String(parsedTrip.traveler_count) : "-"}
              />
              <SummaryTile label="Departure city" value={parsedTrip.departure_city ?? "-"} />
              <SummaryTile label="Accommodation" value={parsedTrip.accommodation_type ?? "-"} />
            </div>
            <Divider />
            <TagSection label="Must visit" values={parsedTrip.must_visit} />
            <TagSection label="Extra preferences" values={parsedTrip.extra_preferences} />
            <TagSection label="Missing fields" values={parsedTrip.missing_fields} tone="muted" />
          </>
        )}
      </CardBody>
    </Card>
  );
}

function ItineraryDayCard({ day }: { day: GeneratedItineraryDay }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
            {day.start_area ?? "-"} to {day.end_area ?? "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Daily budget
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
                  {activity.start_area ?? "-"} to {activity.end_area ?? "-"}
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
  );
}

function ExpenseDayTable({ group }: { group: GeneratedExpenseDay }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Day {group.day_number}</p>
          <p className="text-xs text-slate-500">{group.city}</p>
        </div>
        <p className="text-sm text-slate-500">
          {formatCurrency(group.items.reduce((total, item) => total + item.estimated_cost, 0))}
        </p>
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function TagSection({
  label,
  values,
  tone = "blue"
}: {
  label: string;
  values: string[];
  tone?: "blue" | "muted";
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length === 0 ? (
          <Chip variant="flat" className="bg-slate-100 text-slate-600">
            None
          </Chip>
        ) : (
          values.map((value) => (
            <Chip
              key={value}
              variant="flat"
              className={tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}
            >
              {value}
            </Chip>
          ))
        )}
      </div>
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

function formatDuration(days: number | null, nights: number | null) {
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
