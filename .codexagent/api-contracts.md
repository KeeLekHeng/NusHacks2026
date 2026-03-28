# API Contracts

## `GET /health`

Response:
```json
{
  "status": "ok"
}
```

## `POST /agent/run`

Request:
```json
{
  "goal": "Find the latest prices for X",
  "url": "https://example.com"
}
```

Response:
```json
{
  "status": "completed",
  "plan": ["step 1", "step 2"],
  "summary": "short summary",
  "data": {},
  "sources": ["https://example.com"],
  "error": null
}
```

## Status Enum

- `completed`
- `completed_with_warnings`
- `failed`

## Error Response Shape

For recoverable flow errors, `POST /agent/run` returns:
```json
{
  "status": "completed_with_warnings",
  "plan": ["..."],
  "summary": "Plan completed, but extraction failed.",
  "data": {},
  "sources": [],
  "error": {
    "code": "AGENT_RUN_PARTIAL_FAILURE",
    "message": "Error details"
  }
}
```

For framework-level validation errors, FastAPI default `422` response applies.

## `POST /trip/parse`

Request:
```json
{
  "user_input": "I want to go to Ho Chi Minh + Da Lat for 4 days 3 nights."
}
```

## `POST /trip/itinerary`

Request:
```json
{
  "parsed_trip": {
    "destinations": ["Ho Chi Minh City", "Da Lat"],
    "duration_days": 4,
    "duration_nights": 3,
    "total_budget_usd": 1000,
    "must_visit": ["The Cafe Apartments in Ho Chi Minh City"],
    "departure_city": null,
    "traveler_count": null,
    "accommodation_type": null,
    "room_requirements": [],
    "amenity_requirements": [],
    "extra_preferences": [],
    "missing_fields": []
  }
}
```

## `POST /trip/itinerary/refine`

Request:
```json
{
  "parsed_trip": {
    "destinations": ["Ho Chi Minh City", "Da Lat"],
    "duration_days": 4,
    "duration_nights": 3,
    "total_budget_usd": 1000,
    "must_visit": ["The Cafe Apartments in Ho Chi Minh City"],
    "departure_city": null,
    "traveler_count": null,
    "accommodation_type": null,
    "room_requirements": [],
    "amenity_requirements": [],
    "extra_preferences": [],
    "missing_fields": []
  },
  "itinerary_days": [],
  "estimated_expenses": [],
  "budget_summary": {
    "total_estimated_cost": 520,
    "total_budget_usd": 1000,
    "remaining_budget_usd": 480,
    "is_within_budget": true,
    "accommodation_placeholder_included": true
  },
  "user_refinement_message": "Make day 2 cheaper"
}
```

## `POST /trip/accommodation-tasks`

Request:
```json
{
  "parsed_trip": {
    "destinations": ["Ho Chi Minh City", "Da Lat"],
    "duration_days": 4,
    "duration_nights": 3,
    "total_budget_usd": 1000,
    "must_visit": ["The Cafe Apartments in Ho Chi Minh City"],
    "departure_city": null,
    "traveler_count": 2,
    "accommodation_type": "hotel",
    "room_requirements": ["1 room"],
    "amenity_requirements": ["wifi"],
    "extra_preferences": [],
    "missing_fields": []
  },
  "itinerary_days": [],
  "budget_summary": {
    "total_estimated_cost": 520,
    "total_budget_usd": 1000,
    "remaining_budget_usd": 480,
    "is_within_budget": true,
    "accommodation_placeholder_included": true
  },
  "previous_selected_accommodations": []
}
```

## `POST /trip/accommodation-search`

Request:
```json
{
  "day_number": 2,
  "city": "Da Lat",
  "target_area": "Xuan Huong Lake",
  "traveler_count": 2,
  "nightly_budget": 90,
  "accommodation_type": "boutique hotel",
  "room_requirements": ["queen bed"],
  "amenity_requirements": ["wifi", "workspace"],
  "previous_selected_accommodation": null,
  "next_day_start_area": "Da Lat Center",
  "reuse_flag": false
}
```

Response:
```json
{
  "mode": "mock",
  "day_number": 2,
  "reuse_flag": false,
  "reuse_option": null,
  "options": [
    {
      "option_id": "airbnb-https-airbnb-example-com-mock-atelier-loft",
      "rank": 1,
      "property_name": "Da Lat Atelier Loft",
      "platform": "Airbnb",
      "room_type": "Entire studio",
      "nightly_price": 82,
      "total_price": 96.76,
      "rating": 4.9,
      "review_count": 128,
      "location_summary": "Stylish stay in Xuan Huong Lake with easy evening access and a quieter feel.",
      "distance_to_target_km": 1.2,
      "matched_amenities": ["wifi", "workspace"],
      "booking_url": "https://airbnb.example.com/mock-atelier-loft",
      "final_page_before_checkout_url": "https://airbnb.example.com/mock-atelier-loft/details",
      "is_within_budget": true,
      "why_recommended": "Strong fit for 2 traveler(s) with a premium home-style setup."
    }
  ]
}
```

## `POST /trip/accommodation-rank`

Request:
```json
{
  "search_request": {
    "day_number": 2,
    "city": "Da Lat",
    "target_area": "Xuan Huong Lake",
    "traveler_count": 2,
    "nightly_budget": 90,
    "accommodation_type": "boutique hotel",
    "room_requirements": ["queen bed"],
    "amenity_requirements": ["wifi", "workspace"],
    "previous_selected_accommodation": null,
    "next_day_start_area": "Da Lat Center",
    "reuse_flag": true
  },
  "reuse_option": {
    "available": true,
    "property_name": "Le Lac Quiet House",
    "platform": "Trip.com",
    "nightly_price": 86,
    "booking_url": "https://trip.example.com/le-lac-quiet-house",
    "notes": "Second night is still available."
  },
  "raw_results": [
    {
      "property_name": "Da Lat Atelier Loft",
      "platform": "Airbnb",
      "room_type": "Entire studio",
      "nightly_price": 82,
      "total_price": 96.76,
      "rating": 4.9,
      "review_count": 128,
      "location_summary": "Stylish stay in Xuan Huong Lake with easy evening access and a quieter feel.",
      "distance_to_target_km": 1.2,
      "matched_amenities": ["wifi", "workspace"],
      "booking_url": "https://airbnb.example.com/mock-atelier-loft",
      "final_page_before_checkout_url": "https://airbnb.example.com/mock-atelier-loft/details",
      "why_recommended": null
    }
  ]
}
```

Response:
```json
{
  "day_number": 2,
  "reuse_flag": true,
  "reuse_option": {
    "available": true,
    "property_name": "Le Lac Quiet House",
    "platform": "Trip.com",
    "nightly_price": 86,
    "booking_url": "https://trip.example.com/le-lac-quiet-house",
    "notes": "Second night is still available."
  },
  "options": [
    {
      "option_id": "airbnb-https-airbnb-example-com-mock-atelier-loft",
      "rank": 1,
      "property_name": "Da Lat Atelier Loft",
      "platform": "Airbnb",
      "room_type": "Entire studio",
      "nightly_price": 82,
      "total_price": 96.76,
      "rating": 4.9,
      "review_count": 128,
      "location_summary": "Stylish stay in Xuan Huong Lake with easy evening access and a quieter feel.",
      "distance_to_target_km": 1.2,
      "matched_amenities": ["wifi", "workspace"],
      "booking_url": "https://airbnb.example.com/mock-atelier-loft",
      "final_page_before_checkout_url": "https://airbnb.example.com/mock-atelier-loft/details",
      "is_within_budget": true,
      "why_recommended": "Da Lat Atelier Loft matches the required amenities"
    }
  ]
}
```

Response:
```json
{
  "accommodation_search_tasks": [
    {
      "day_number": 1,
      "city": "Ho Chi Minh City",
      "target_area": "District 1",
      "check_in_date": null,
      "check_out_date": null,
      "traveler_count": 2,
      "nightly_budget": 160,
      "accommodation_type": "hotel",
      "room_requirements": ["1 room"],
      "amenity_requirements": ["wifi"],
      "previous_selected_accommodation": null,
      "next_day_start_area": "District 3",
      "reuse_flag": true
    }
  ]
}
```

Response:
```json
{
  "updated_itinerary_days": [],
  "updated_estimated_expenses": [],
  "updated_budget_summary": {
    "total_estimated_cost": 470,
    "total_budget_usd": 1000,
    "remaining_budget_usd": 530,
    "is_within_budget": true,
    "accommodation_placeholder_included": true
  },
  "explanation_summary": "Reduced spend on day 2 while keeping key stops intact."
}
```

Response:
```json
{
  "trip_summary": "A practical 4-day trip across Ho Chi Minh City, Da Lat.",
  "itinerary_days": [
    {
      "day_number": 1,
      "city": "Ho Chi Minh City",
      "title": "Arrival and first look at Ho Chi Minh City",
      "activities": [
        {
          "label": "The Cafe Apartments in Ho Chi Minh City",
          "category": "attraction",
          "notes": "Must-visit stop preserved directly from the parser output.",
          "estimated_cost": 12,
          "url": null,
          "start_area": "District 1",
          "end_area": "District 1"
        }
      ],
      "estimated_day_cost": 140,
      "start_area": "District 1",
      "end_area": "District 3"
    }
  ],
  "estimated_expenses": [
    {
      "day_number": 1,
      "city": "Ho Chi Minh City",
      "items": [
        {
          "label": "The Cafe Apartments in Ho Chi Minh City",
          "url": null,
          "estimated_cost": 12,
          "category": "attraction"
        }
      ]
    }
  ],
  "budget_summary": {
    "total_estimated_cost": 520,
    "total_budget_usd": 1000,
    "remaining_budget_usd": 480,
    "is_within_budget": true,
    "accommodation_placeholder_included": true
  }
}
```

Response:
```json
{
  "destinations": ["Ho Chi Minh City", "Da Lat"],
  "duration_days": 4,
  "duration_nights": 3,
  "total_budget_usd": 1000,
  "must_visit": ["The Cafe Apartments in Ho Chi Minh City"],
  "departure_city": null,
  "traveler_count": null,
  "accommodation_type": null,
  "room_requirements": [],
  "amenity_requirements": [],
  "extra_preferences": [],
  "missing_fields": ["departure_city", "traveler_count", "accommodation_type", "room_requirements", "amenity_requirements"]
}
```
