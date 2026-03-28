export type TravelFlowStep = "itinerary" | "accommodation" | "summary";

export type ParsedTripData = {
  destinations: string[];
  duration_days: number | null;
  duration_nights: number | null;
  total_budget_usd: number | null;
  must_visit: string[];
  departure_city: string | null;
  traveler_count: number | null;
  accommodation_type: string | null;
  room_requirements: string[];
  amenity_requirements: string[];
  extra_preferences: string[];
  missing_fields: string[];
};

export type GeneratedItineraryActivity = {
  label: string;
  category: "attraction" | "food" | "transport" | "hotel" | "other";
  notes?: string | null;
  estimated_cost?: number | null;
  url?: string | null;
  start_area?: string | null;
  end_area?: string | null;
};

export type GeneratedItineraryDay = {
  day_number: number;
  city: string;
  title: string;
  activities: GeneratedItineraryActivity[];
  estimated_day_cost: number;
  start_area?: string | null;
  end_area?: string | null;
};

export type GeneratedExpenseItem = {
  label: string;
  url?: string | null;
  estimated_cost: number;
  category: "attraction" | "food" | "transport" | "hotel" | "other";
};

export type GeneratedExpenseDay = {
  day_number: number;
  city: string;
  items: GeneratedExpenseItem[];
};

export type GeneratedBudgetSummary = {
  total_estimated_cost: number;
  total_budget_usd?: number | null;
  remaining_budget_usd?: number | null;
  is_within_budget?: boolean | null;
  accommodation_placeholder_included: boolean;
};

export type GeneratedItineraryResult = {
  trip_summary: string;
  itinerary_days: GeneratedItineraryDay[];
  estimated_expenses: GeneratedExpenseDay[];
  budget_summary: GeneratedBudgetSummary;
};

export type TravelPlanResult = {
  source: "backend" | "mock";
  parsedTrip: ParsedTripData;
  itinerary: GeneratedItineraryResult;
};

export type PreviousSelectedAccommodationInput = {
  name: string;
  city: string;
  area?: string | null;
  address?: string | null;
  url?: string | null;
};

export type AccommodationSearchTask = {
  day_number: number;
  city: string;
  target_area?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  traveler_count?: number | null;
  nightly_budget?: number | null;
  accommodation_type?: string | null;
  room_requirements: string[];
  amenity_requirements: string[];
  previous_selected_accommodation?: PreviousSelectedAccommodationInput | null;
  next_day_start_area?: string | null;
  reuse_flag: boolean;
};

export type AccommodationReuseOption = {
  available: boolean;
  property_name?: string | null;
  platform?: string | null;
  nightly_price?: number | null;
  booking_url?: string | null;
  notes?: string | null;
};

export type AccommodationSearchOption = {
  option_id?: string | null;
  rank?: number | null;
  property_name?: string | null;
  platform?: string | null;
  room_type?: string | null;
  nightly_price?: number | null;
  total_price?: number | null;
  rating?: number | null;
  review_count?: number | null;
  location_summary?: string | null;
  distance_to_target_km?: number | null;
  matched_amenities: string[];
  booking_url?: string | null;
  final_page_before_checkout_url?: string | null;
  is_within_budget?: boolean | null;
  why_recommended?: string | null;
};

export type AccommodationSearchResult = {
  mode: "backend" | "mock";
  day_number: number;
  reuse_flag: boolean;
  reuse_option?: AccommodationReuseOption | null;
  options: AccommodationSearchOption[];
};

export type AccommodationNightGroup = {
  id: string;
  nightLabel: string;
  dayNumber: number;
  city: string;
  area: string;
  checkIn?: string | null;
  checkOut?: string | null;
  task: AccommodationSearchTask;
  options: AccommodationSearchOption[];
  reuseOption?: AccommodationReuseOption | null;
  source: "backend" | "mock";
  status: "loading" | "ready" | "error";
  error?: string | null;
};

export type AccommodationSelectionMap = Record<string, AccommodationSearchOption>;

export type TravelRefinementResult = {
  updated_itinerary_days: GeneratedItineraryDay[];
  updated_estimated_expenses: GeneratedExpenseDay[];
  updated_budget_summary: GeneratedBudgetSummary;
  explanation_summary?: string | null;
};

export type ItineraryConversationMessage = {
  id: string;
  role: "user" | "assistant";
  message: string;
};

export type TravelerBreakdown = {
  adults: number;
  children: number;
  infants: number;
};

export type TripBudget = {
  currency: string;
  total: number;
};

export type TripInput = {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: TravelerBreakdown;
  budget: TripBudget;
  interests: string[];
  notes?: string;
};

export type TripLocation = {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export type ItineraryActivity = {
  id: string;
  title: string;
  description: string;
  category: "transport" | "sightseeing" | "food" | "hotel" | "free-time" | "other";
  startTime?: string;
  endTime?: string;
  location?: TripLocation;
  estimatedCost?: number;
};

export type ItineraryDay = {
  dayNumber: number;
  date: string;
  title: string;
  activities: ItineraryActivity[];
  dailyBudget?: number;
};

export type TripItinerary = {
  destination: string;
  days: ItineraryDay[];
};

export type ExpenseCategory =
  | "transport"
  | "accommodation"
  | "food"
  | "activities"
  | "fees"
  | "other";

export type ExpenseItem = {
  id: string;
  label: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  dayNumber?: number;
  url?: string;
  notes?: string;
};

export type ExpenseSummary = {
  currency: string;
  items: ExpenseItem[];
  estimatedTotal: number;
};

export type AccommodationAmenity =
  | "wifi"
  | "breakfast"
  | "pool"
  | "gym"
  | "parking"
  | "kitchen"
  | "workspace";

export type AccommodationOption = {
  id: string;
  name: string;
  provider: string;
  url?: string;
  imageUrl?: string;
  location: TripLocation;
  nightlyRate: number;
  totalPrice: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  amenities: AccommodationAmenity[];
  summary: string;
};

export type SelectedAccommodation = {
  optionId: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  totalPrice: number;
  currency: string;
};

export type FinalTripSummary = {
  tripInput: TripInput;
  itinerary: TripItinerary;
  expenses: ExpenseSummary;
  accommodationOptions: AccommodationOption[];
  selectedAccommodations: SelectedAccommodation[];
  shareTitle: string;
  summary: string;
};

export type TravelFlowRoute = {
  step: TravelFlowStep;
  href: string;
  title: string;
  description: string;
};

export const travelFlowRoutes: TravelFlowRoute[] = [
  {
    step: "itinerary",
    href: "/itinerary",
    title: "Itinerary Planning",
    description: "Capture trip input and generate the day-by-day plan."
  },
  {
    step: "accommodation",
    href: "/accommodation",
    title: "Accommodation Selection",
    description: "Compare stay options and store user selections."
  },
  {
    step: "summary",
    href: "/summary",
    title: "Summary & Share",
    description: "Combine plan, stays, and expenses into the final trip summary."
  }
];
