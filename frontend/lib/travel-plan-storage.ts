import type { AccommodationSelectionMap, TravelPlanResult } from "./trip-planner";

const TRAVEL_PLAN_STORAGE_KEY = "nushacks.travel-plan";
const ACCOMMODATION_SELECTIONS_STORAGE_KEY = "nushacks.accommodation-selections";

export function saveTravelPlanToSession(plan: TravelPlanResult) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(TRAVEL_PLAN_STORAGE_KEY, JSON.stringify(plan));
}

export function loadTravelPlanFromSession(): TravelPlanResult | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(TRAVEL_PLAN_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as TravelPlanResult;
  } catch {
    return null;
  }
}

export function saveAccommodationSelectionsToSession(
  selections: AccommodationSelectionMap
) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    ACCOMMODATION_SELECTIONS_STORAGE_KEY,
    JSON.stringify(selections)
  );
}

export function loadAccommodationSelectionsFromSession(): AccommodationSelectionMap {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = window.sessionStorage.getItem(ACCOMMODATION_SELECTIONS_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    return JSON.parse(rawValue) as AccommodationSelectionMap;
  } catch {
    return {};
  }
}
