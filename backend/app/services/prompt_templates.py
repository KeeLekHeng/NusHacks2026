from __future__ import annotations

import json
from typing import Any


DEFAULT_REUSE_DISTANCE_KM = 30


def build_accommodation_search_tinyfish_prompt(
    search_request: dict[str, Any],
    reuse_distance_km: int = DEFAULT_REUSE_DISTANCE_KM,
) -> str:
    previous_selected = search_request.get("previous_selected_accommodation") or {}

    context_lines = [
        "You are the accommodation web search agent.",
        "",
        "Search for accommodation options for a specific trip night using the provided structured trip context.",
        "",
        "Context:",
        f"- Day number: {_value_or_null(search_request.get('day_number'))}",
        f"- City: {_value_or_null(search_request.get('city'))}",
        f"- End-of-day target area: {_value_or_null(search_request.get('target_area'))}",
        f"- Next-day first area: {_value_or_null(search_request.get('next_day_start_area'))}",
        f"- Nightly budget: {_value_or_null(search_request.get('nightly_budget'))}",
        f"- Number of travelers: {_value_or_null(search_request.get('traveler_count'))}",
        f"- Accommodation type: {_value_or_null(search_request.get('accommodation_type'))}",
        f"- Room requirements: {_list_or_null(search_request.get('room_requirements'))}",
        f"- Amenity requirements: {_list_or_null(search_request.get('amenity_requirements'))}",
        "- Preferred platforms: Airbnb and Trip.com",
        f"- Current platform focus: {_value_or_null(search_request.get('preferred_platform'))}",
        "",
        "Previous selected accommodation context:",
        json.dumps(
            {
                "name": previous_selected.get("name"),
                "city": previous_selected.get("city"),
                "area": previous_selected.get("area"),
                "address": previous_selected.get("address"),
                "url": previous_selected.get("url"),
            },
            ensure_ascii=True,
        ),
        "",
        "Hotel reuse logic:",
        "- If the previous night's selected accommodation exists",
        f"- And the distance between the current day end area and next day first area is within {reuse_distance_km} km",
        "- Then also check whether staying a second night at the previous accommodation is available and what the updated price is",
        "",
        "Search requirements:",
        "- Search Airbnb and Trip.com",
        "- Find the best available accommodation options near the target area",
        "- Prioritize options that satisfy budget, rating, location relevance, and required amenities",
        "- Return up to 9 strong options total across both platforms",
        "- If possible, include the previous hotel second-night option when reuse flag is true",
        "",
        "Return output as valid JSON only with this schema:",
        "{",
        '  "day_number": number,',
        '  "reuse_flag": boolean,',
        '  "reuse_option": {',
        '    "available": boolean,',
        '    "property_name": string | null,',
        '    "platform": string | null,',
        '    "nightly_price": number | null,',
        '    "booking_url": string | null,',
        '    "notes": string | null',
        "  },",
        '  "results": [',
        "    {",
        '      "property_name": string,',
        '      "platform": "Airbnb" | "Trip.com",',
        '      "room_type": string | null,',
        '      "nightly_price": number | null,',
        '      "total_price": number | null,',
        '      "rating": number | null,',
        '      "review_count": number | null,',
        '      "location_summary": string | null,',
        '      "distance_to_target_km": number | null,',
        '      "matched_amenities": string[],',
        '      "booking_url": string | null,',
        '      "final_page_before_checkout_url": string | null,',
        '      "why_recommended": string | null',
        "    }",
        "  ]",
        "}",
    ]

    return "\n".join(context_lines)


def _value_or_null(value: Any) -> str:
    if value is None or value == "":
        return "null"
    return str(value)


def _list_or_null(value: Any) -> str:
    if not value:
        return "[]"
    if isinstance(value, list):
        return json.dumps([str(item) for item in value], ensure_ascii=True)
    return json.dumps([str(value)], ensure_ascii=True)
