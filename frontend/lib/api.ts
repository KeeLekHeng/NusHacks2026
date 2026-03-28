import type {
  AccommodationSearchResult,
  AccommodationSearchTask,
  GeneratedBudgetSummary,
  GeneratedExpenseDay,
  GeneratedItineraryDay,
  ParsedTripData,
  PreviousSelectedAccommodationInput,
  TravelRefinementResult,
  TravelPlanResult
} from "./trip-planner";

export type AgentRunRequest = {
  goal: string;
  url?: string;
};

export type AgentRunResponse = {
  status: "completed" | "completed_with_warnings" | "failed";
  plan: string[];
  summary: string;
  data: Record<string, unknown>;
  sources: string[];
  error?: {
    code: string;
    message: string;
  };
};

export type ParseTripRequest = {
  user_input: string;
};

export type GenerateItineraryRequest = {
  parsed_trip: ParsedTripData;
};

export type GenerateItineraryResponse = {
  trip_summary: string;
  itinerary_days: GeneratedItineraryDay[];
  estimated_expenses: GeneratedExpenseDay[];
  budget_summary: GeneratedBudgetSummary;
};

export type RefineItineraryRequest = {
  parsed_trip: ParsedTripData;
  itinerary_days: GeneratedItineraryDay[];
  estimated_expenses: GeneratedExpenseDay[];
  budget_summary: GeneratedBudgetSummary;
  user_refinement_message: string;
};

export type RefineItineraryResponse = TravelRefinementResult;

export type PrepareAccommodationTasksRequest = {
  parsed_trip: ParsedTripData;
  itinerary_days: GeneratedItineraryDay[];
  budget_summary: GeneratedBudgetSummary;
  previous_selected_accommodations: PreviousSelectedAccommodationInput[];
};

export type PrepareAccommodationTasksResponse = {
  accommodation_search_tasks: AccommodationSearchTask[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const DEMO_TRIP_PROMPT =
  "I want to go to Ho Chi Minh + Da Lat for 4 days 3 nights. I definitely won't miss The Cafe Apartments in Ho Chi Minh City and budget within 1000 dollars.";

export async function runAgent(payload: AgentRunRequest): Promise<AgentRunResponse> {
  const response = await fetch(`${API_BASE_URL}/agent/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const maybeError = await response.json().catch(() => ({}));
    const message =
      maybeError?.error?.message ??
      maybeError?.detail ??
      "Backend request failed. Check backend logs.";
    throw new Error(message);
  }

  return response.json();
}

export async function generateTravelPlan(userInput: string): Promise<TravelPlanResult> {
  const trimmedInput = userInput.trim();
  if (!trimmedInput) {
    throw new Error("Enter a travel request before generating an itinerary.");
  }

  const optimisticParsedTrip = buildOptimisticParsedTrip(trimmedInput);

  try {
    const parsedTrip = await parseTrip({ user_input: trimmedInput }).catch(() => null);
    if (parsedTrip) {
      const itinerary = await generateItinerary({ parsed_trip: parsedTrip });
      return {
        source: "backend",
        parsedTrip,
        itinerary
      };
    }

    const optimisticItinerary = await generateItinerary({
      parsed_trip: optimisticParsedTrip
    }).catch(() => null);

    if (optimisticItinerary) {
      return {
        source: "backend",
        parsedTrip: optimisticParsedTrip,
        itinerary: optimisticItinerary
      };
    }

    throw new Error("Trip parser and itinerary requests both failed.");
  } catch {
    return createMockTravelPlan(trimmedInput);
  }
}

function buildOptimisticParsedTrip(userInput: string): ParsedTripData {
  return createMockTravelPlan(userInput).parsedTrip;
}

export async function refineTravelPlan(
  currentPlan: TravelPlanResult,
  userRefinementMessage: string
): Promise<TravelRefinementResult> {
  const trimmedMessage = userRefinementMessage.trim();
  if (!trimmedMessage) {
    throw new Error("Enter a refinement request before updating the itinerary.");
  }

  try {
    return await refineItinerary({
      parsed_trip: currentPlan.parsedTrip,
      itinerary_days: currentPlan.itinerary.itinerary_days,
      estimated_expenses: currentPlan.itinerary.estimated_expenses,
      budget_summary: currentPlan.itinerary.budget_summary,
      user_refinement_message: trimmedMessage
    });
  } catch {
    return createMockRefinementResult(currentPlan, trimmedMessage);
  }
}

export async function prepareAccommodationTasks(
  currentPlan: TravelPlanResult,
  previousSelectedAccommodations: PreviousSelectedAccommodationInput[] = []
): Promise<AccommodationSearchTask[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/trip/accommodation-tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        parsed_trip: currentPlan.parsedTrip,
        itinerary_days: currentPlan.itinerary.itinerary_days,
        budget_summary: currentPlan.itinerary.budget_summary,
        previous_selected_accommodations: previousSelectedAccommodations
      } satisfies PrepareAccommodationTasksRequest)
    });

    if (!response.ok) {
      throw new Error("Accommodation preparation request failed.");
    }

    const payload = (await response.json()) as PrepareAccommodationTasksResponse;
    return payload.accommodation_search_tasks;
  } catch {
    return createMockAccommodationTasks(currentPlan, previousSelectedAccommodations);
  }
}

export async function searchAccommodationForNight(
  task: AccommodationSearchTask
): Promise<AccommodationSearchResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/trip/accommodation-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(task)
    });

    if (!response.ok) {
      throw new Error("Accommodation search request failed.");
    }

    const payload = (await response.json()) as {
      mode?: string;
      day_number: number;
      reuse_flag: boolean;
      reuse_option?: AccommodationSearchResult["reuse_option"];
      options: AccommodationSearchResult["options"];
    };

    return {
      mode:
        payload.mode === "mock"
          ? "mock"
          : payload.mode === "fallback"
            ? "fallback"
            : "backend",
      day_number: payload.day_number,
      reuse_flag: payload.reuse_flag,
      reuse_option: payload.reuse_option ?? null,
      options: payload.options ?? []
    };
  } catch {
    return createMockAccommodationSearchResult(task);
  }
}

export function getDemoTravelPlan(): TravelPlanResult {
  return createMockTravelPlan(DEMO_TRIP_PROMPT);
}

async function parseTrip(payload: ParseTripRequest): Promise<ParsedTripData> {
  const response = await fetch(`${API_BASE_URL}/trip/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Trip parser request failed.");
  }

  return response.json();
}

async function generateItinerary(
  payload: GenerateItineraryRequest
): Promise<GenerateItineraryResponse> {
  const response = await fetch(`${API_BASE_URL}/trip/itinerary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Itinerary generator request failed.");
  }

  return response.json();
}

async function refineItinerary(
  payload: RefineItineraryRequest
): Promise<RefineItineraryResponse> {
  const response = await fetch(`${API_BASE_URL}/trip/itinerary/refine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Itinerary refinement request failed.");
  }

  return response.json();
}

function createMockTravelPlan(userInput: string): TravelPlanResult {
  const normalizedInput = userInput.toLowerCase();
  const parsedTrip: ParsedTripData = {
    destinations: normalizedInput.includes("tokyo")
      ? ["Tokyo"]
      : ["Ho Chi Minh City", "Da Lat"],
    duration_days: normalizedInput.includes("4") ? 4 : 3,
    duration_nights: normalizedInput.includes("3") ? 3 : 2,
    total_budget_usd: normalizedInput.includes("1000") ? 1000 : 1800,
    must_visit: normalizedInput.includes("cafe apartments")
      ? ["The Cafe Apartments in Ho Chi Minh City"]
      : ["Shibuya Sky"],
    departure_city: null,
    traveler_count: normalizedInput.includes("2") ? 2 : null,
    accommodation_type: null,
    room_requirements: [],
    amenity_requirements: [],
    extra_preferences: normalizedInput.includes("budget")
      ? ["Budget-conscious pace"]
      : ["Food-focused itinerary"],
    missing_fields: ["departure_city", "accommodation_type", "room_requirements", "amenity_requirements"]
  };

  const itinerary: GenerateItineraryResponse = normalizedInput.includes("tokyo")
    ? {
        trip_summary:
          "A practical 4-day Tokyo trip with balanced neighborhoods, one scenic day trip, and manageable transport blocks.",
        itinerary_days: [
          {
            day_number: 1,
            city: "Tokyo",
            title: "Arrival and Akihabara reset",
            start_area: "Ueno",
            end_area: "Akihabara",
            estimated_day_cost: 140,
            activities: [
              {
                label: "Hotel check-in near Ueno",
                category: "hotel",
                notes: "Placeholder stay block until the accommodation step is confirmed.",
                estimated_cost: 90,
                url: null,
                start_area: "Ueno",
                end_area: "Ueno"
              },
              {
                label: "Akihabara anime and figure crawl",
                category: "attraction",
                notes: "Cluster hobby stores in the same district to avoid backtracking.",
                estimated_cost: 22,
                url: null,
                start_area: "Akihabara",
                end_area: "Akihabara"
              },
              {
                label: "Casual sushi dinner",
                category: "food",
                notes: "Flexible dinner near the final stop of the day.",
                estimated_cost: 28,
                url: null,
                start_area: "Akihabara",
                end_area: "Akihabara"
              }
            ]
          },
          {
            day_number: 2,
            city: "Tokyo",
            title: "Fuji day escape",
            start_area: "Shinjuku",
            end_area: "Shinjuku",
            estimated_day_cost: 165,
            activities: [
              {
                label: "Train to Kawaguchiko",
                category: "transport",
                notes: "Reserve an early departure to protect the sightseeing window.",
                estimated_cost: 55,
                url: null,
                start_area: "Shinjuku",
                end_area: "Kawaguchiko"
              },
              {
                label: "Lake Kawaguchi viewpoints",
                category: "attraction",
                notes: "Keep the middle of the day flexible for weather changes.",
                estimated_cost: 40,
                url: null,
                start_area: "Kawaguchiko",
                end_area: "Kawaguchiko"
              },
              {
                label: "Return to Tokyo",
                category: "transport",
                notes: "Back to the city in time for a relaxed dinner.",
                estimated_cost: 45,
                url: null,
                start_area: "Kawaguchiko",
                end_area: "Shinjuku"
              },
              {
                label: "Late ramen stop",
                category: "food",
                notes: "Easy meal near the station after returning.",
                estimated_cost: 25,
                url: null,
                start_area: "Shinjuku",
                end_area: "Shinjuku"
              }
            ]
          },
          {
            day_number: 3,
            city: "Tokyo",
            title: "Asakusa and Ginza food corridor",
            start_area: "Asakusa",
            end_area: "Ginza",
            estimated_day_cost: 132,
            activities: [
              {
                label: "Senso-ji and Nakamise walk",
                category: "attraction",
                notes: "Front-load the temple district before lunch crowds build.",
                estimated_cost: 18,
                url: null,
                start_area: "Asakusa",
                end_area: "Asakusa"
              },
              {
                label: "Ginza food halls",
                category: "food",
                notes: "Snack-style tasting block that keeps the pace light.",
                estimated_cost: 34,
                url: null,
                start_area: "Ginza",
                end_area: "Ginza"
              },
              {
                label: "Evening omakase slot",
                category: "food",
                notes: "Signature meal block for the trip.",
                estimated_cost: 80,
                url: null,
                start_area: "Ginza",
                end_area: "Ginza"
              }
            ]
          },
          {
            day_number: 4,
            city: "Tokyo",
            title: "Shibuya finale and departure",
            start_area: "Shibuya",
            end_area: "Narita transfer",
            estimated_day_cost: 120,
            activities: [
              {
                label: "Shibuya Sky",
                category: "attraction",
                notes: "Must-visit skyline stop before departure.",
                estimated_cost: 24,
                url: null,
                start_area: "Shibuya",
                end_area: "Shibuya"
              },
              {
                label: "Last-minute shopping",
                category: "other",
                notes: "Open block for anything the traveler wants to revisit.",
                estimated_cost: 36,
                url: null,
                start_area: "Shibuya",
                end_area: "Shibuya"
              },
              {
                label: "Airport transfer",
                category: "transport",
                notes: "Leave enough margin for baggage and evening departure.",
                estimated_cost: 60,
                url: null,
                start_area: "Shibuya",
                end_area: "Narita transfer"
              }
            ]
          }
        ],
        estimated_expenses: [
          {
            day_number: 1,
            city: "Tokyo",
            items: [
              { label: "Hotel check-in near Ueno", url: null, estimated_cost: 90, category: "hotel" },
              { label: "Akihabara anime and figure crawl", url: null, estimated_cost: 22, category: "attraction" },
              { label: "Casual sushi dinner", url: null, estimated_cost: 28, category: "food" }
            ]
          },
          {
            day_number: 2,
            city: "Tokyo",
            items: [
              { label: "Train to Kawaguchiko", url: null, estimated_cost: 55, category: "transport" },
              { label: "Lake Kawaguchi viewpoints", url: null, estimated_cost: 40, category: "attraction" },
              { label: "Return to Tokyo", url: null, estimated_cost: 45, category: "transport" },
              { label: "Late ramen stop", url: null, estimated_cost: 25, category: "food" }
            ]
          },
          {
            day_number: 3,
            city: "Tokyo",
            items: [
              { label: "Senso-ji and Nakamise walk", url: null, estimated_cost: 18, category: "attraction" },
              { label: "Ginza food halls", url: null, estimated_cost: 34, category: "food" },
              { label: "Evening omakase slot", url: null, estimated_cost: 80, category: "food" }
            ]
          },
          {
            day_number: 4,
            city: "Tokyo",
            items: [
              { label: "Shibuya Sky", url: null, estimated_cost: 24, category: "attraction" },
              { label: "Last-minute shopping", url: null, estimated_cost: 36, category: "other" },
              { label: "Airport transfer", url: null, estimated_cost: 60, category: "transport" }
            ]
          }
        ],
        budget_summary: {
          total_estimated_cost: 557,
          total_budget_usd: 1800,
          remaining_budget_usd: 1243,
          is_within_budget: true,
          accommodation_placeholder_included: true
        }
      }
    : {
        trip_summary:
          "A practical 4-day split trip across Ho Chi Minh City and Da Lat, keeping major transfers realistic while preserving the must-visit stop.",
        itinerary_days: [
          {
            day_number: 1,
            city: "Ho Chi Minh City",
            title: "Arrival and central district walk",
            start_area: "District 1",
            end_area: "District 1",
            estimated_day_cost: 128,
            activities: [
              {
                label: "Hotel check-in in District 1",
                category: "hotel",
                notes: "Placeholder accommodation cost before the stays step.",
                estimated_cost: 78,
                url: null,
                start_area: "District 1",
                end_area: "District 1"
              },
              {
                label: "The Cafe Apartments in Ho Chi Minh City",
                category: "attraction",
                notes: "Must-visit preserved directly from the prompt.",
                estimated_cost: 14,
                url: null,
                start_area: "District 1",
                end_area: "District 1"
              },
              {
                label: "Ben Thanh food stop",
                category: "food",
                notes: "Short local dinner loop without extra transport.",
                estimated_cost: 36,
                url: null,
                start_area: "District 1",
                end_area: "District 1"
              }
            ]
          },
          {
            day_number: 2,
            city: "Ho Chi Minh City",
            title: "District 3 and local cafe day",
            start_area: "District 3",
            end_area: "District 1",
            estimated_day_cost: 92,
            activities: [
              {
                label: "War Remnants and nearby cultural stops",
                category: "attraction",
                notes: "Compact route around central attractions.",
                estimated_cost: 20,
                url: null,
                start_area: "District 3",
                end_area: "District 3"
              },
              {
                label: "Cafe hopping block",
                category: "food",
                notes: "Flexible midday slot around the central districts.",
                estimated_cost: 24,
                url: null,
                start_area: "District 3",
                end_area: "District 1"
              },
              {
                label: "Evening transfer prep",
                category: "other",
                notes: "Keep the evening lighter before moving cities.",
                estimated_cost: 48,
                url: null,
                start_area: "District 1",
                end_area: "District 1"
              }
            ]
          },
          {
            day_number: 3,
            city: "Da Lat",
            title: "Transfer to Da Lat and scenic reset",
            start_area: "Da Lat Center",
            end_area: "Xuan Huong Lake",
            estimated_day_cost: 152,
            activities: [
              {
                label: "Transfer from Ho Chi Minh City to Da Lat",
                category: "transport",
                notes: "Move early enough to preserve half a day in Da Lat.",
                estimated_cost: 42,
                url: null,
                start_area: "District 1",
                end_area: "Da Lat Center"
              },
              {
                label: "Hotel check-in in Da Lat Center",
                category: "hotel",
                notes: "Placeholder stay block until accommodation is selected.",
                estimated_cost: 72,
                url: null,
                start_area: "Da Lat Center",
                end_area: "Da Lat Center"
              },
              {
                label: "Xuan Huong Lake evening walk",
                category: "attraction",
                notes: "Low-friction first stop after arrival.",
                estimated_cost: 14,
                url: null,
                start_area: "Da Lat Center",
                end_area: "Xuan Huong Lake"
              },
              {
                label: "Night market snacks",
                category: "food",
                notes: "Easy dinner near the lake area.",
                estimated_cost: 24,
                url: null,
                start_area: "Xuan Huong Lake",
                end_area: "Xuan Huong Lake"
              }
            ]
          },
          {
            day_number: 4,
            city: "Da Lat",
            title: "Da Lat highlights before departure",
            start_area: "Da Lat Center",
            end_area: "Da Lat Center",
            estimated_day_cost: 96,
            activities: [
              {
                label: "Da Lat viewpoints and gardens",
                category: "attraction",
                notes: "Keep sites clustered to avoid over-transit.",
                estimated_cost: 26,
                url: null,
                start_area: "Da Lat Center",
                end_area: "Da Lat Center"
              },
              {
                label: "Cafe and pastry stop",
                category: "food",
                notes: "Relaxed final meal block before wrapping the trip.",
                estimated_cost: 22,
                url: null,
                start_area: "Da Lat Center",
                end_area: "Da Lat Center"
              },
              {
                label: "Departure transfer buffer",
                category: "transport",
                notes: "Reserve some budget and time for the exit leg.",
                estimated_cost: 48,
                url: null,
                start_area: "Da Lat Center",
                end_area: "Da Lat Center"
              }
            ]
          }
        ],
        estimated_expenses: [
          {
            day_number: 1,
            city: "Ho Chi Minh City",
            items: [
              { label: "Hotel check-in in District 1", url: null, estimated_cost: 78, category: "hotel" },
              { label: "The Cafe Apartments in Ho Chi Minh City", url: null, estimated_cost: 14, category: "attraction" },
              { label: "Ben Thanh food stop", url: null, estimated_cost: 36, category: "food" }
            ]
          },
          {
            day_number: 2,
            city: "Ho Chi Minh City",
            items: [
              { label: "War Remnants and nearby cultural stops", url: null, estimated_cost: 20, category: "attraction" },
              { label: "Cafe hopping block", url: null, estimated_cost: 24, category: "food" },
              { label: "Evening transfer prep", url: null, estimated_cost: 48, category: "other" }
            ]
          },
          {
            day_number: 3,
            city: "Da Lat",
            items: [
              { label: "Transfer from Ho Chi Minh City to Da Lat", url: null, estimated_cost: 42, category: "transport" },
              { label: "Hotel check-in in Da Lat Center", url: null, estimated_cost: 72, category: "hotel" },
              { label: "Xuan Huong Lake evening walk", url: null, estimated_cost: 14, category: "attraction" },
              { label: "Night market snacks", url: null, estimated_cost: 24, category: "food" }
            ]
          },
          {
            day_number: 4,
            city: "Da Lat",
            items: [
              { label: "Da Lat viewpoints and gardens", url: null, estimated_cost: 26, category: "attraction" },
              { label: "Cafe and pastry stop", url: null, estimated_cost: 22, category: "food" },
              { label: "Departure transfer buffer", url: null, estimated_cost: 48, category: "transport" }
            ]
          }
        ],
        budget_summary: {
          total_estimated_cost: 468,
          total_budget_usd: 1000,
          remaining_budget_usd: 532,
          is_within_budget: true,
          accommodation_placeholder_included: true
        }
      };

  return {
    source: "mock",
    parsedTrip,
    itinerary
  };
}

function createMockAccommodationTasks(
  currentPlan: TravelPlanResult,
  previousSelectedAccommodations: PreviousSelectedAccommodationInput[] = []
): AccommodationSearchTask[] {
  const durationNights =
    currentPlan.parsedTrip.duration_nights ??
    Math.max(currentPlan.itinerary.itinerary_days.length - 1, 1);
  const itineraryDays = currentPlan.itinerary.itinerary_days.slice(0, durationNights);
  const remainingBudget =
    currentPlan.itinerary.budget_summary.remaining_budget_usd ??
    currentPlan.parsedTrip.total_budget_usd ??
    null;
  const fallbackNightlyBudget =
    remainingBudget == null ? null : Math.max(Math.round(remainingBudget / Math.max(durationNights, 1)), 45);

  return itineraryDays.map((day, index) => {
    const nextDay = currentPlan.itinerary.itinerary_days[index + 1];
    const previousSelected = previousSelectedAccommodations.find(
      (accommodation) => accommodation.city.toLowerCase() === day.city.toLowerCase()
    );

    return {
      day_number: day.day_number,
      city: day.city,
      target_area: day.end_area ?? day.start_area ?? `${day.city} Center`,
      check_in_date: `2026-04-${String(15 + index).padStart(2, "0")}`,
      check_out_date: `2026-04-${String(16 + index).padStart(2, "0")}`,
      traveler_count: currentPlan.parsedTrip.traveler_count ?? 2,
      nightly_budget: fallbackNightlyBudget,
      accommodation_type: currentPlan.parsedTrip.accommodation_type ?? "hotel",
      room_requirements: currentPlan.parsedTrip.room_requirements,
      amenity_requirements: currentPlan.parsedTrip.amenity_requirements,
      previous_selected_accommodation: previousSelected ?? null,
      next_day_start_area: nextDay?.start_area ?? null,
      reuse_flag: previousSelected != null && previousSelected.city.toLowerCase() === day.city.toLowerCase()
    };
  });
}

function createMockAccommodationSearchResult(
  task: AccommodationSearchTask
): AccommodationSearchResult {
  const city = task.city;
  const area = task.target_area ?? `${city} Center`;
  const budgetAnchor = task.nightly_budget ?? 95;
  const amenitySeed = Array.from(
    new Set([...(task.amenity_requirements ?? []), "wifi"].filter(Boolean))
  ).slice(0, 4);

  return {
    mode: "mock",
    day_number: task.day_number,
    reuse_flag: task.reuse_flag,
    reuse_option:
      task.reuse_flag && task.previous_selected_accommodation
        ? {
            available: true,
            property_name: task.previous_selected_accommodation.name,
            platform: "Reuse check",
            nightly_price: Math.round((task.nightly_budget ?? 95) * 0.95),
            booking_url: task.previous_selected_accommodation.url ?? null,
            notes: "Mock reuse option carried forward from the previous selected stay."
          }
        : null,
    options: [
      {
        option_id: `airbnb-${task.day_number}-atelier`,
        rank: 1,
        property_name: `${city} Atelier Loft`,
        platform: "Airbnb",
        room_type: "Entire studio",
        nightly_price: Math.max(budgetAnchor - 8, 58),
        total_price: Math.max(Math.round((budgetAnchor - 8) * 1.18), 68),
        rating: 4.9,
        review_count: 128,
        location_summary: `Stylish stay near ${area} with easy evening access and a quieter feel.`,
        distance_to_target_km: 1.2,
        matched_amenities: amenitySeed,
        booking_url: "https://airbnb.example.com/mock-atelier-loft",
        final_page_before_checkout_url: "https://airbnb.example.com/mock-atelier-loft/details",
        is_within_budget: budgetAnchor - 8 <= budgetAnchor,
        why_recommended: "Strong overall fit for amenities, location, and premium comfort."
      },
      {
        option_id: `trip-${task.day_number}-central`,
        rank: 2,
        property_name: `${city} Central Suites`,
        platform: "Trip.com",
        room_type: "Deluxe room",
        nightly_price: Math.max(budgetAnchor - 15, 52),
        total_price: Math.max(Math.round((budgetAnchor - 15) * 1.16), 62),
        rating: 4.6,
        review_count: 684,
        location_summary: `Practical hotel base close to ${area} for shorter transfers and easier mornings.`,
        distance_to_target_km: 0.8,
        matched_amenities: amenitySeed,
        booking_url: "https://trip.example.com/mock-central-suites",
        final_page_before_checkout_url: "https://trip.example.com/mock-central-suites/details",
        is_within_budget: budgetAnchor - 15 <= budgetAnchor,
        why_recommended: "Balanced value pick with strong review volume and central positioning."
      },
      {
        option_id: `airbnb-${task.day_number}-residence`,
        rank: 3,
        property_name: `${city} Residence House`,
        platform: "Airbnb",
        room_type: "Private apartment",
        nightly_price: budgetAnchor + 6,
        total_price: Math.round((budgetAnchor + 6) * 1.2),
        rating: 4.8,
        review_count: 211,
        location_summary: `Relaxed apartment stay around ${area} with more breathing room and home-style comfort.`,
        distance_to_target_km: 1.7,
        matched_amenities: Array.from(new Set([...amenitySeed, ...task.room_requirements.slice(0, 2)])),
        booking_url: "https://airbnb.example.com/mock-residence-house",
        final_page_before_checkout_url: "https://airbnb.example.com/mock-residence-house/details",
        is_within_budget: budgetAnchor + 6 <= budgetAnchor,
        why_recommended: "Best when comfort and flexibility matter more than the lowest nightly price."
      }
    ]
  };
}

function createMockRefinementResult(
  currentPlan: TravelPlanResult,
  userRefinementMessage: string
): TravelRefinementResult {
  const trimmedMessage = userRefinementMessage.trim();
  const normalizedMessage = trimmedMessage.toLowerCase();
  const updatedItineraryDays = currentPlan.itinerary.itinerary_days.map((day) => ({
    ...day,
    activities: day.activities.map((activity) => ({ ...activity }))
  }));
  const mustVisitLabels = new Set(
    currentPlan.parsedTrip.must_visit.map((place) => place.trim().toLowerCase())
  );
  let explanationSummary =
    "Applied a lightweight refinement mock while preserving the itinerary structure.";

  if (normalizedMessage.includes("day 2") && normalizedMessage.includes("cheaper")) {
    const dayTwo = updatedItineraryDays.find((day) => day.day_number === 2);
    if (dayTwo) {
      const target = dayTwo.activities.find(
        (activity) => !mustVisitLabels.has(activity.label.trim().toLowerCase())
      );
      if (target?.estimated_cost != null) {
        target.estimated_cost = Math.max(Math.round(target.estimated_cost * 0.75), 8);
        target.notes = `${target.notes ?? "Adjusted"} Lowered to keep day 2 more budget-friendly.`;
      }
      explanationSummary = "Reduced one spend-heavy stop on day 2 while keeping the rest of the day intact.";
    }
  } else if (normalizedMessage.includes("more cafes")) {
    const targetDay =
      updatedItineraryDays.find((day) => day.city.toLowerCase().includes("ho chi minh")) ??
      updatedItineraryDays[0];
    if (targetDay) {
      targetDay.activities.push({
        label: `Cafe crawl in ${targetDay.city}`,
        category: "food",
        notes: "Added as a light cafe-focused refinement.",
        estimated_cost: 16,
        url: null,
        start_area: targetDay.end_area ?? targetDay.start_area ?? targetDay.city,
        end_area: targetDay.end_area ?? targetDay.start_area ?? targetDay.city
      });
      explanationSummary = `Added an extra cafe-focused stop in ${targetDay.city}.`;
    }
  } else if (normalizedMessage.includes("relaxed")) {
    const busiestDay = [...updatedItineraryDays].sort(
      (left, right) => right.activities.length - left.activities.length
    )[0];
    if (busiestDay && busiestDay.activities.length > 1) {
      const removableIndex = busiestDay.activities.findIndex(
        (activity) =>
          !mustVisitLabels.has(activity.label.trim().toLowerCase()) &&
          activity.category !== "hotel" &&
          activity.category !== "transport"
      );
      if (removableIndex >= 0) {
        const [removedActivity] = busiestDay.activities.splice(removableIndex, 1);
        busiestDay.title = `${busiestDay.title} with a slower pace`;
        explanationSummary = `Relaxed the trip by removing ${removedActivity.label} from day ${busiestDay.day_number}.`;
      }
    }
  } else if (normalizedMessage.includes("replace") && normalizedMessage.includes("da lat")) {
    const daLatDay = updatedItineraryDays.find((day) => day.city.toLowerCase().includes("da lat"));
    if (daLatDay) {
      const target = daLatDay.activities.find(
        (activity) =>
          activity.category === "attraction" &&
          !mustVisitLabels.has(activity.label.trim().toLowerCase())
      );
      if (target) {
        target.label = "Da Lat flower gardens and hillside views";
        target.notes = "Swapped in as a gentler alternative attraction.";
        explanationSummary = "Replaced one Da Lat attraction while keeping the overall route practical.";
      }
    }
  }

  const updatedEstimatedExpenses = updatedItineraryDays.map((day) => ({
    day_number: day.day_number,
    city: day.city,
    items: day.activities.map((activity) => ({
      label: activity.label,
      url: activity.url ?? null,
      estimated_cost: activity.estimated_cost ?? 0,
      category: activity.category
    }))
  }));

  const updatedItineraryWithTotals = updatedItineraryDays.map((day) => ({
    ...day,
    estimated_day_cost: day.activities.reduce(
      (total, activity) => total + (activity.estimated_cost ?? 0),
      0
    )
  }));

  const totalEstimatedCost = updatedItineraryWithTotals.reduce(
    (total, day) => total + day.estimated_day_cost,
    0
  );
  const totalBudgetUsd = currentPlan.itinerary.budget_summary.total_budget_usd ?? null;

  return {
    updated_itinerary_days: updatedItineraryWithTotals,
    updated_estimated_expenses: updatedEstimatedExpenses,
    updated_budget_summary: {
      total_estimated_cost: totalEstimatedCost,
      total_budget_usd: totalBudgetUsd,
      remaining_budget_usd: totalBudgetUsd == null ? null : totalBudgetUsd - totalEstimatedCost,
      is_within_budget: totalBudgetUsd == null ? null : totalEstimatedCost <= totalBudgetUsd,
      accommodation_placeholder_included:
        currentPlan.itinerary.budget_summary.accommodation_placeholder_included
    },
    explanation_summary: explanationSummary
  };
}
