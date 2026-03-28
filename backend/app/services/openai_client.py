import json
import re
from typing import Any

from openai import OpenAI


def _extract_json_payload(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError(f"Model response did not contain JSON. Raw response: {text[:500]}")

    parsed = json.loads(match.group())
    if not isinstance(parsed, dict):
        raise ValueError("Model response JSON was not an object.")
    return parsed


def _normalize_trip_itinerary_result_shape(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    normalized.setdefault("trip_summary", "")
    normalized.setdefault("itinerary_days", [])
    normalized.setdefault("estimated_expenses", [])
    normalized.setdefault("budget_summary", {})
    return normalized


def _normalize_trip_itinerary_refinement_shape(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    normalized.setdefault("updated_itinerary_days", [])
    normalized.setdefault("updated_estimated_expenses", [])
    normalized.setdefault("updated_budget_summary", {})
    normalized.setdefault("explanation_summary", None)
    return normalized


def _normalize_accommodation_prep_shape(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    normalized.setdefault("accommodation_search_tasks", [])
    return normalized


def plan_goal(goal: str, api_key: str | None, model: str) -> list[str]:
    if not api_key:
        return [
            "Understand the user goal and target context",
            "Extract relevant website information with TinyFish",
            "Summarize key findings for the demo output",
        ]

    client = OpenAI(api_key=api_key)
    prompt = (
        "Create a short execution plan in 2-4 bullet points for this goal.\n"
        f"Goal: {goal}\n"
        "Return plain text with one step per line, no numbering prefix."
    )
    response = client.responses.create(model=model, input=prompt)
    text = getattr(response, "output_text", "") or ""
    steps = [line.strip("- ").strip() for line in text.splitlines() if line.strip()]
    return steps[:4] or ["Break goal into extraction and summary steps"]


def summarize_result(goal: str, extracted_data: dict[str, Any], api_key: str | None, model: str) -> str:
    if not api_key:
        return (
            f"Mock summary: completed '{goal}'. "
            "Set OPENAI_API_KEY to enable model-generated summaries."
        )

    client = OpenAI(api_key=api_key)
    prompt = (
        "Write a concise 2-3 sentence summary of the extraction result.\n"
        f"Goal: {goal}\n"
        f"Data: {extracted_data}"
    )
    response = client.responses.create(model=model, input=prompt)
    text = getattr(response, "output_text", "") or ""
    return text.strip() or "Summary unavailable."


def parse_trip_request(user_input: str, api_key: str | None, model: str) -> dict[str, Any]:
    heuristic_result = _parse_trip_request_heuristically(user_input)

    if not api_key:
        return heuristic_result

    client = OpenAI(api_key=api_key)
    prompt = (
        "Extract structured trip-planning data from the user request.\n"
        "Return JSON only with exactly these keys:\n"
        "destinations, duration_days, duration_nights, total_budget_usd, must_visit, "
        "departure_city, traveler_count, accommodation_type, room_requirements, "
        "amenity_requirements, extra_preferences, missing_fields.\n"
        "Rules:\n"
        "- Infer duration_days and duration_nights when phrased like '4 days 3 nights'.\n"
        "- Normalize destination city names where reasonable.\n"
        "- Preserve named must-visit places exactly when possible.\n"
        "- Do not invent missing values.\n"
        "- missing_fields should list fields that are still absent but useful for trip planning.\n"
        f"User input: {user_input}"
    )
    response = client.responses.create(model=model, input=prompt)
    text = getattr(response, "output_text", "") or ""

    try:
        parsed = _extract_json_payload(text)
        return _normalize_trip_parser_result(parsed)
    except Exception:
        return heuristic_result


def generate_trip_itinerary(parsed_trip: dict[str, Any], api_key: str | None, model: str) -> dict[str, Any]:
    heuristic_result = _generate_trip_itinerary_heuristically(parsed_trip)

    if not api_key:
        return heuristic_result

    client = OpenAI(api_key=api_key)
    prompt = (
        "Generate a practical travel itinerary from parsed trip JSON.\n"
        "Return JSON only with exactly these keys: trip_summary, itinerary_days, estimated_expenses, budget_summary.\n"
        "Each itinerary_days item must contain: day_number, city, title, activities, estimated_day_cost, start_area, end_area.\n"
        "Each activity must contain: label, category, notes, estimated_cost, url, start_area, end_area.\n"
        "Allowed categories: attraction, food, transport, hotel, other.\n"
        "Each estimated_expenses item must be grouped by day and contain: day_number, city, items.\n"
        "Each expense item must contain: label, url, estimated_cost, category.\n"
        "Rules:\n"
        "- Itinerary should be realistic and practical.\n"
        "- Include all must_visit places.\n"
        "- Avoid unreasonable travel flow.\n"
        "- Budget estimates can be rough.\n"
        "- Accommodation costs can be placeholders.\n"
        "- Return structured JSON only.\n"
        f"Parsed trip JSON: {parsed_trip}"
    )
    response = client.responses.create(model=model, input=prompt)
    text = getattr(response, "output_text", "") or ""

    try:
        parsed = _normalize_trip_itinerary_result_shape(_extract_json_payload(text))
        return _normalize_trip_itinerary_result(parsed, parsed_trip)
    except Exception:
        return heuristic_result


def refine_trip_itinerary(
    parsed_trip: dict[str, Any],
    itinerary_days: list[dict[str, Any]],
    estimated_expenses: list[dict[str, Any]],
    budget_summary: dict[str, Any],
    user_refinement_message: str,
    api_key: str | None,
    model: str,
) -> dict[str, Any]:
    heuristic_result = _refine_trip_itinerary_heuristically(
        parsed_trip=parsed_trip,
        itinerary_days=itinerary_days,
        estimated_expenses=estimated_expenses,
        budget_summary=budget_summary,
        user_refinement_message=user_refinement_message,
    )

    if not api_key:
        return heuristic_result

    client = OpenAI(api_key=api_key)
    prompt = (
        "Refine an existing travel itinerary using a follow-up user edit request.\n"
        "Return JSON only with exactly these keys: updated_itinerary_days, updated_estimated_expenses, "
        "updated_budget_summary, explanation_summary.\n"
        "Rules:\n"
        "- Preserve must-visit places unless the user explicitly removes them.\n"
        "- Preserve overall trip constraints unless the user explicitly changes them.\n"
        "- Update only what is necessary.\n"
        "- Maintain feasibility and rough budget awareness.\n"
        "- Keep categories within: attraction, food, transport, hotel, other.\n"
        f"Parsed trip state: {parsed_trip}\n"
        f"Current itinerary JSON: {itinerary_days}\n"
        f"Current estimated expenses: {estimated_expenses}\n"
        f"Current budget summary: {budget_summary}\n"
        f"User refinement message: {user_refinement_message}"
    )
    response = client.responses.create(model=model, input=prompt)
    text = getattr(response, "output_text", "") or ""

    try:
        parsed = _normalize_trip_itinerary_refinement_shape(_extract_json_payload(text))
        return _normalize_trip_itinerary_refinement_result(parsed, parsed_trip, itinerary_days)
    except Exception:
        return heuristic_result


def prepare_accommodation_search_tasks(
    parsed_trip: dict[str, Any],
    itinerary_days: list[dict[str, Any]],
    budget_summary: dict[str, Any] | None,
    previous_selected_accommodations: list[dict[str, Any]],
    api_key: str | None,
    model: str,
) -> dict[str, Any]:
    heuristic_result = _prepare_accommodation_search_tasks_heuristically(
        parsed_trip=parsed_trip,
        itinerary_days=itinerary_days,
        budget_summary=budget_summary,
        previous_selected_accommodations=previous_selected_accommodations,
    )

    if not api_key:
        return heuristic_result

    client = OpenAI(api_key=api_key)
    prompt = (
        "Convert a finalized trip itinerary into structured accommodation search tasks for each required night.\n"
        "Return JSON only with exactly this key: accommodation_search_tasks.\n"
        "Each task must include: day_number, city, target_area, check_in_date, check_out_date, "
        "traveler_count, nightly_budget, accommodation_type, room_requirements, amenity_requirements, "
        "previous_selected_accommodation, next_day_start_area, reuse_flag.\n"
        "Rules:\n"
        "- Generate one task per required night.\n"
        "- If previous selected accommodation exists and the current day end area and next day first area are within about 30 km, set reuse_flag=true.\n"
        "- Keep output ready for accommodation search execution.\n"
        "- Do not invent check-in/check-out dates if unavailable.\n"
        f"Parsed trip state: {parsed_trip}\n"
        f"Final itinerary JSON: {itinerary_days}\n"
        f"Budget summary: {budget_summary}\n"
        f"Previous selected accommodations: {previous_selected_accommodations}"
    )
    response = client.responses.create(model=model, input=prompt)
    text = getattr(response, "output_text", "") or ""

    try:
        parsed = _normalize_accommodation_prep_shape(_extract_json_payload(text))
        return _normalize_accommodation_search_tasks_result(
            raw_result=parsed,
            parsed_trip=parsed_trip,
            itinerary_days=itinerary_days,
            budget_summary=budget_summary,
            previous_selected_accommodations=previous_selected_accommodations,
        )
    except Exception:
        return heuristic_result


def _parse_trip_request_heuristically(user_input: str) -> dict[str, Any]:
    text = user_input.strip()
    lower_text = text.lower()

    duration_days = None
    duration_nights = None
    duration_match = re.search(r"(\d+)\s*days?\s*(\d+)\s*nights?", lower_text)
    if duration_match:
        duration_days = int(duration_match.group(1))
        duration_nights = int(duration_match.group(2))
    else:
        days_match = re.search(r"(\d+)\s*days?", lower_text)
        nights_match = re.search(r"(\d+)\s*nights?", lower_text)
        if days_match:
            duration_days = int(days_match.group(1))
        if nights_match:
            duration_nights = int(nights_match.group(1))

    budget_match = re.search(
        r"(?:budget(?:ed)?(?:\s*within|\s*under|\s*of)?|under|within)\s*\$?(\d+(?:,\d{3})*(?:\.\d+)?)",
        lower_text,
    )
    if not budget_match:
        budget_match = re.search(
            r"\$ ?(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:usd|dollars?)",
            lower_text,
        )
    total_budget_usd = None
    if budget_match:
        raw_budget = budget_match.group(1) or budget_match.group(2)
        total_budget_usd = float(raw_budget.replace(",", ""))

    must_visit = _extract_must_visit_places(text)
    text_without_must_visit = text
    for place in must_visit:
        text_without_must_visit = text_without_must_visit.replace(place, "")
    lower_text_without_must_visit = text_without_must_visit.lower()

    traveler_count = None
    traveler_match = re.search(
        r"\bfor\s+(\d+)\s*(?:adults?|people|persons?|travelers?|guests?)\b",
        lower_text,
    )
    if not traveler_match:
        traveler_match = re.search(r"\b(\d+)\s*(?:adults?|people|persons?|travelers?|guests?)\b", lower_text)
    if traveler_match:
        traveler_count = int(traveler_match.group(1))

    departure_city = None
    departure_match = re.search(
        r"(?:from|departing from|leaving from)\s+([A-Za-z\s]+?)(?:[,.]| to | for | with | and |$)",
        text,
        re.IGNORECASE,
    )
    if departure_match:
        departure_city = departure_match.group(1).strip()

    accommodation_type = None
    for accommodation_keyword in [
        "hotel",
        "hostel",
        "resort",
        "villa",
        "apartment",
        "homestay",
        "airbnb",
    ]:
        if accommodation_keyword in lower_text_without_must_visit:
            accommodation_type = accommodation_keyword
            break

    room_requirements: list[str] = []
    for pattern in [
        r"\b\d+\s+rooms?\b",
        r"\bking bed\b",
        r"\bqueen bed\b",
        r"\btwin beds?\b",
        r"\bdouble bed\b",
        r"\bconnecting rooms?\b",
        r"\bfamily room\b",
    ]:
        for match in re.finditer(pattern, lower_text):
            value = match.group(0).strip()
            if value not in room_requirements:
                room_requirements.append(value)

    amenity_requirements: list[str] = []
    for amenity in ["wifi", "breakfast", "pool", "gym", "parking", "kitchen", "workspace", "bathtub"]:
        if amenity in lower_text:
            amenity_requirements.append(amenity)

    extra_preferences: list[str] = []
    preference_patterns = [
        r"(?:prefer|preferably)\s+(.+?)(?:[.,]|$)",
        r"(?:with|including)\s+(.+?)(?:[.,]|$)",
        r"(?:budget-conscious|luxury|family-friendly|romantic|slow pace|packed schedule)",
    ]
    for pattern in preference_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            value = match.group(0).strip(" .")
            if value and value not in extra_preferences:
                extra_preferences.append(value)

    destinations = _extract_destinations(text, must_visit)
    result = {
        "destinations": destinations,
        "duration_days": duration_days,
        "duration_nights": duration_nights,
        "total_budget_usd": total_budget_usd,
        "must_visit": must_visit,
        "departure_city": departure_city,
        "traveler_count": traveler_count,
        "accommodation_type": accommodation_type,
        "room_requirements": room_requirements,
        "amenity_requirements": amenity_requirements,
        "extra_preferences": extra_preferences,
        "missing_fields": [],
    }
    return _normalize_trip_parser_result(result)


def _generate_trip_itinerary_heuristically(parsed_trip: dict[str, Any]) -> dict[str, Any]:
    destinations = [destination for destination in parsed_trip.get("destinations", []) if destination]
    total_days = _coerce_int(parsed_trip.get("duration_days")) or max(len(destinations), 1)
    total_budget = _coerce_float(parsed_trip.get("total_budget_usd"))
    must_visit = [str(place).strip() for place in parsed_trip.get("must_visit", []) if str(place).strip()]
    extra_preferences = [
        str(preference).strip()
        for preference in parsed_trip.get("extra_preferences", [])
        if str(preference).strip()
    ]

    if not destinations:
        destinations = ["Destination TBD"]

    city_sequence = _build_city_sequence(destinations, total_days)
    itinerary_days: list[dict[str, Any]] = []
    estimated_expenses: list[dict[str, Any]] = []
    remaining_must_visit = must_visit[:]

    for index, city in enumerate(city_sequence, start=1):
        activities: list[dict[str, Any]] = []
        expense_items: list[dict[str, Any]] = []

        start_area = _default_area_for_city(city, "start")
        end_area = _default_area_for_city(city, "end")

        if index == 1:
            hotel_cost = 90.0
            hotel_activity = {
                "label": f"Hotel check-in in {start_area}",
                "category": "hotel",
                "notes": "Placeholder accommodation hold until stay selection is confirmed.",
                "estimated_cost": hotel_cost,
                "url": None,
                "start_area": start_area,
                "end_area": start_area,
            }
            activities.append(hotel_activity)
            expense_items.append(_expense_from_activity(hotel_activity))

        if index > 1 and city_sequence[index - 2] != city:
            transport_cost = 35.0 if "Da Lat" in city or "flight" in city.lower() else 18.0
            transport_activity = {
                "label": f"Transfer from {city_sequence[index - 2]} to {city}",
                "category": "transport",
                "notes": "Keep the move early enough to preserve half-day sightseeing time.",
                "estimated_cost": transport_cost,
                "url": None,
                "start_area": _default_area_for_city(city_sequence[index - 2], "start"),
                "end_area": start_area,
            }
            activities.append(transport_activity)
            expense_items.append(_expense_from_activity(transport_activity))

        if remaining_must_visit:
            must_visit_place = remaining_must_visit.pop(0)
            visit_activity = {
                "label": must_visit_place,
                "category": "attraction",
                "notes": "Must-visit stop preserved directly from the parser output.",
                "estimated_cost": 12.0,
                "url": None,
                "start_area": start_area,
                "end_area": start_area,
            }
            activities.append(visit_activity)
            expense_items.append(_expense_from_activity(visit_activity))

        attraction_activity = {
            "label": _default_attraction_label(city, index),
            "category": "attraction",
            "notes": "Cluster nearby sights to keep travel practical.",
            "estimated_cost": 20.0,
            "url": None,
            "start_area": start_area,
            "end_area": end_area,
        }
        food_activity = {
            "label": f"Local dining in {end_area}",
            "category": "food",
            "notes": "Flexible meal slot near the final area of the day.",
            "estimated_cost": 18.0,
            "url": None,
            "start_area": end_area,
            "end_area": end_area,
        }
        activities.extend([attraction_activity, food_activity])
        expense_items.extend([
            _expense_from_activity(attraction_activity),
            _expense_from_activity(food_activity),
        ])

        estimated_day_cost = round(
            sum(item.get("estimated_cost") or 0 for item in activities),
            2,
        )
        itinerary_days.append(
            {
                "day_number": index,
                "city": city,
                "title": _build_day_title(city, index, city_sequence, activities),
                "activities": activities,
                "estimated_day_cost": estimated_day_cost,
                "start_area": activities[0].get("start_area") if activities else start_area,
                "end_area": activities[-1].get("end_area") if activities else end_area,
            }
        )
        estimated_expenses.append(
            {
                "day_number": index,
                "city": city,
                "items": expense_items,
            }
        )

    while remaining_must_visit and itinerary_days:
        last_day = itinerary_days[-1]
        last_expenses = estimated_expenses[-1]["items"]
        must_visit_place = remaining_must_visit.pop(0)
        extra_activity = {
            "label": must_visit_place,
            "category": "attraction",
            "notes": "Added to the latest practical day to ensure all must-visit items are included.",
            "estimated_cost": 12.0,
            "url": None,
            "start_area": last_day["end_area"],
            "end_area": last_day["end_area"],
        }
        last_day["activities"].append(extra_activity)
        last_day["estimated_day_cost"] = round(last_day["estimated_day_cost"] + 12.0, 2)
        last_expenses.append(_expense_from_activity(extra_activity))

    total_estimated_cost = round(
        sum(day["estimated_day_cost"] for day in itinerary_days),
        2,
    )
    remaining_budget_usd = round(total_budget - total_estimated_cost, 2) if total_budget is not None else None
    budget_summary = {
        "total_estimated_cost": total_estimated_cost,
        "total_budget_usd": total_budget,
        "remaining_budget_usd": remaining_budget_usd,
        "is_within_budget": total_estimated_cost <= total_budget if total_budget is not None else None,
        "accommodation_placeholder_included": True,
    }

    trip_summary = _build_trip_summary(
        destinations=destinations,
        total_days=total_days,
        must_visit=must_visit,
        extra_preferences=extra_preferences,
    )

    result = {
        "trip_summary": trip_summary,
        "itinerary_days": itinerary_days,
        "estimated_expenses": estimated_expenses,
        "budget_summary": budget_summary,
    }
    return _normalize_trip_itinerary_result(result, parsed_trip)


def _refine_trip_itinerary_heuristically(
    parsed_trip: dict[str, Any],
    itinerary_days: list[dict[str, Any]],
    estimated_expenses: list[dict[str, Any]],
    budget_summary: dict[str, Any],
    user_refinement_message: str,
) -> dict[str, Any]:
    del estimated_expenses  # Rebuilt from itinerary after refinement.
    refined_days = json.loads(json.dumps(itinerary_days))
    message = user_refinement_message.strip()
    message_lower = message.lower()
    must_visit_places = {
        str(place).strip().lower()
        for place in parsed_trip.get("must_visit", [])
        if str(place).strip()
    }
    explanation_parts: list[str] = []

    target_day_number = _extract_day_number(message_lower)
    target_city = _extract_target_city(message_lower, parsed_trip, refined_days)

    if "cheaper" in message_lower or "budget" in message_lower:
        target_days = [
            day for day in refined_days
            if target_day_number is None or _coerce_int(day.get("day_number")) == target_day_number
        ]
        if not target_days:
            target_days = refined_days[:1]

        for day in target_days:
            changed = False
            for activity in day.get("activities", []):
                label = str(activity.get("label", "")).strip().lower()
                if label in must_visit_places:
                    continue
                cost = _coerce_float(activity.get("estimated_cost"))
                if cost and cost > 0:
                    activity["estimated_cost"] = round(max(cost * 0.75, 8.0), 2)
                    note = _coerce_optional_string(activity.get("notes")) or ""
                    activity["notes"] = (note + " Adjusted to keep this day more budget-friendly.").strip()
                    changed = True
                    break
            if changed:
                day["title"] = f"{day.get('title', 'Day plan')} (lighter spend)"
                explanation_parts.append(
                    f"Reduced spend on day {_coerce_int(day.get('day_number')) or '?'} while keeping key stops intact."
                )
    elif "more relaxed" in message_lower or "relaxed" in message_lower:
        target_day = max(
            refined_days,
            key=lambda day: len(day.get("activities", [])),
            default=None,
        )
        if target_day:
            removable_index = None
            for index, activity in enumerate(target_day.get("activities", [])):
                label = str(activity.get("label", "")).strip().lower()
                category = str(activity.get("category", "")).strip().lower()
                if label in must_visit_places or category in {"hotel", "transport"}:
                    continue
                removable_index = index
                break
            if removable_index is not None:
                removed = target_day["activities"].pop(removable_index)
                target_day["title"] = f"{target_day.get('title', 'Day plan')} with a slower pace"
                explanation_parts.append(
                    f"Relaxed the plan by removing '{removed.get('label', 'one activity')}' from day "
                    f"{_coerce_int(target_day.get('day_number')) or '?'}."
                )
    elif "add more cafes" in message_lower or "add cafe" in message_lower or "more cafes" in message_lower:
        target_day = _find_day_for_city(refined_days, target_city) or refined_days[0] if refined_days else None
        if target_day:
            cafe_area = _coerce_optional_string(target_day.get("end_area")) or _coerce_optional_string(target_day.get("start_area")) or "city center"
            cafe_city = _coerce_optional_string(target_day.get("city")) or "the destination"
            new_activity = {
                "label": f"Cafe crawl in {cafe_city}",
                "category": "food",
                "notes": "Added in response to the refinement request for more cafes.",
                "estimated_cost": 16.0,
                "url": None,
                "start_area": cafe_area,
                "end_area": cafe_area,
            }
            target_day.setdefault("activities", []).append(new_activity)
            explanation_parts.append(
                f"Added a cafe-focused stop to day {_coerce_int(target_day.get('day_number')) or '?'} in {cafe_city}."
            )
    elif "replace" in message_lower and "attraction" in message_lower:
        target_day = _find_day_for_city(refined_days, target_city)
        if target_day:
            for activity in target_day.get("activities", []):
                label = str(activity.get("label", "")).strip().lower()
                category = str(activity.get("category", "")).strip().lower()
                if category == "attraction" and label not in must_visit_places:
                    city_name = _coerce_optional_string(target_day.get("city")) or "the city"
                    activity["label"] = _replacement_attraction_label(city_name)
                    activity["notes"] = "Replaced one attraction while keeping the day practical."
                    explanation_parts.append(
                        f"Replaced one attraction on day {_coerce_int(target_day.get('day_number')) or '?'} in {city_name}."
                    )
                    break

    normalized_days = _normalize_itinerary_days(refined_days, parsed_trip)
    rebuilt_expenses = _rebuild_estimated_expenses(normalized_days)
    rebuilt_budget = _rebuild_budget_summary(
        normalized_days=normalized_days,
        parsed_trip=parsed_trip,
        budget_summary=budget_summary,
    )

    return {
        "updated_itinerary_days": normalized_days,
        "updated_estimated_expenses": rebuilt_expenses,
        "updated_budget_summary": rebuilt_budget,
        "explanation_summary": " ".join(explanation_parts) or "Applied a light itinerary refinement while preserving the trip constraints.",
    }


def _prepare_accommodation_search_tasks_heuristically(
    parsed_trip: dict[str, Any],
    itinerary_days: list[dict[str, Any]],
    budget_summary: dict[str, Any] | None,
    previous_selected_accommodations: list[dict[str, Any]],
) -> dict[str, Any]:
    normalized_days = _normalize_itinerary_days(itinerary_days, parsed_trip)
    total_nights = _coerce_int(parsed_trip.get("duration_nights"))
    if total_nights is None:
        total_nights = max(len(normalized_days) - 1, 1 if normalized_days else 0)

    traveler_count = _coerce_int(parsed_trip.get("traveler_count"))
    accommodation_type = _coerce_optional_string(parsed_trip.get("accommodation_type"))
    room_requirements = [
        str(item).strip()
        for item in parsed_trip.get("room_requirements", [])
        if str(item).strip()
    ]
    amenity_requirements = [
        str(item).strip()
        for item in parsed_trip.get("amenity_requirements", [])
        if str(item).strip()
    ]

    nightly_budget = _estimate_nightly_budget(
        parsed_trip=parsed_trip,
        budget_summary=budget_summary,
        total_nights=total_nights,
    )

    search_tasks: list[dict[str, Any]] = []
    running_previous_selection = None

    for index in range(total_nights):
        if not normalized_days:
            break

        day = normalized_days[min(index, len(normalized_days) - 1)]
        next_day = normalized_days[index + 1] if index + 1 < len(normalized_days) else None

        city = _coerce_optional_string(day.get("city")) or "Destination TBD"
        target_area = _coerce_optional_string(day.get("end_area")) or _coerce_optional_string(day.get("start_area"))
        next_day_start_area = (
            _coerce_optional_string(next_day.get("start_area")) if next_day is not None else None
        )
        previous_selected = _find_previous_selected_accommodation(
            previous_selected_accommodations,
            city=city,
        )
        if previous_selected is None and running_previous_selection is not None:
            running_previous_city = _coerce_optional_string(running_previous_selection.get("city"))
            if running_previous_city == city:
                previous_selected = running_previous_selection

        reuse_flag = False
        if previous_selected is not None and next_day_start_area is not None and target_area is not None:
            reuse_flag = _areas_are_within_reuse_range(
                city=city,
                current_end_area=target_area,
                next_day_start_area=next_day_start_area,
                previous_area=_coerce_optional_string(previous_selected.get("area")),
            )

        task = {
            "day_number": _coerce_int(day.get("day_number")) or (index + 1),
            "city": city,
            "target_area": target_area,
            "check_in_date": None,
            "check_out_date": None,
            "traveler_count": traveler_count,
            "nightly_budget": nightly_budget,
            "accommodation_type": accommodation_type,
            "room_requirements": list(dict.fromkeys(room_requirements)),
            "amenity_requirements": list(dict.fromkeys(amenity_requirements)),
            "previous_selected_accommodation": previous_selected,
            "next_day_start_area": next_day_start_area,
            "reuse_flag": reuse_flag,
        }
        search_tasks.append(task)

        if previous_selected is not None and reuse_flag:
            running_previous_selection = previous_selected
        else:
            running_previous_selection = None

    result = {"accommodation_search_tasks": search_tasks}
    return _normalize_accommodation_search_tasks_result(
        raw_result=result,
        parsed_trip=parsed_trip,
        itinerary_days=itinerary_days,
        budget_summary=budget_summary,
        previous_selected_accommodations=previous_selected_accommodations,
    )


def _extract_destinations(user_input: str, must_visit: list[str]) -> list[str]:
    working_text = user_input
    for place in must_visit:
        working_text = working_text.replace(place, "")

    destination_patterns = [
        r"(?:from)\s+[A-Za-z\s]+?\s+to\s+(.+?)(?:\s+for\s+\d+\s*days?|\s+within\s+\$?\d+|\s+with\s+|\s+budget|\s*\.\s*|[.,]|$)",
        r"(?:to)\s+(.+?)(?:\s+for\s+\d+\s*days?|\s+within\s+\$?\d+|\s+with\s+|\s+budget|\s*\.\s*|[.,]|$)",
        r"(?:go to|visit|travel to)\s+(.+?)(?:\s+for\s+\d+\s*days?|\s+within\s+\$?\d+|[.,]|$)",
        r"(?:trip to)\s+(.+?)(?:\s+for\s+\d+\s*days?|\s+within\s+\$?\d+|[.,]|$)",
    ]

    candidates: list[str] = []
    for pattern in destination_patterns:
        for match in re.finditer(pattern, working_text, re.IGNORECASE):
            chunk = match.group(1)
            parts = re.split(r"\s*\+\s*|\s*,\s*|\s+and\s+", chunk)
            for part in parts:
                cleaned_part = re.sub(
                    r"\b(?:for|with|within|budget|under|hotel|hotels|hostel|hostels)\b.*$",
                    "",
                    part,
                    flags=re.IGNORECASE,
                ).strip(" .")
                normalized = _normalize_destination_name(cleaned_part)
                if normalized and normalized not in candidates:
                    candidates.append(normalized)

    return candidates


def _extract_must_visit_places(user_input: str) -> list[str]:
    must_visit: list[str] = []
    must_visit_patterns = [
        r"(?:won(?:['’?])?t miss|will not miss|must visit|definitely won(?:['’?])?t miss|definitely will not miss)\s+(.+?)(?=\s+and\s+budget|\s+within\s+\$?\d+|[.,]|$)",
        r"(?:definitely want to visit|really want to visit)\s+(.+?)(?=\s+and\s+budget|\s+within\s+\$?\d+|[.,]|$)",
    ]

    for pattern in must_visit_patterns:
        for match in re.finditer(pattern, user_input, re.IGNORECASE):
            candidate = match.group(1).strip(" .")
            if candidate and candidate not in must_visit:
                must_visit.append(candidate)

    return must_visit


def _normalize_destination_name(value: str) -> str | None:
    if not value:
        return None

    normalized_map = {
        "hcm": "Ho Chi Minh City",
        "hcmc": "Ho Chi Minh City",
        "ho chi minh": "Ho Chi Minh City",
        "ho chi minh city": "Ho Chi Minh City",
        "saigon": "Ho Chi Minh City",
        "da lat": "Da Lat",
        "dalat": "Da Lat",
        "ho chi minh city vietnam": "Ho Chi Minh City",
    }

    compact = re.sub(r"\s+", " ", value.strip()).lower()
    if compact in normalized_map:
        return normalized_map[compact]

    return value.strip()


def _normalize_trip_parser_result(raw_result: dict[str, Any]) -> dict[str, Any]:
    destinations = [
        _normalize_destination_name(str(destination)) or str(destination)
        for destination in raw_result.get("destinations", [])
        if str(destination).strip()
    ]
    must_visit = [str(item).strip() for item in raw_result.get("must_visit", []) if str(item).strip()]
    room_requirements = [
        str(item).strip() for item in raw_result.get("room_requirements", []) if str(item).strip()
    ]
    amenity_requirements = [
        str(item).strip() for item in raw_result.get("amenity_requirements", []) if str(item).strip()
    ]
    extra_preferences = [
        str(item).strip() for item in raw_result.get("extra_preferences", []) if str(item).strip()
    ]

    result = {
        "destinations": list(dict.fromkeys(destinations)),
        "duration_days": _coerce_int(raw_result.get("duration_days")),
        "duration_nights": _coerce_int(raw_result.get("duration_nights")),
        "total_budget_usd": _coerce_float(raw_result.get("total_budget_usd")),
        "must_visit": list(dict.fromkeys(must_visit)),
        "departure_city": _coerce_optional_string(raw_result.get("departure_city")),
        "traveler_count": _coerce_int(raw_result.get("traveler_count")),
        "accommodation_type": _coerce_optional_string(raw_result.get("accommodation_type")),
        "room_requirements": list(dict.fromkeys(room_requirements)),
        "amenity_requirements": list(dict.fromkeys(amenity_requirements)),
        "extra_preferences": list(dict.fromkeys(extra_preferences)),
        "missing_fields": [],
    }

    if result["duration_days"] is not None and result["duration_nights"] is None and result["duration_days"] > 0:
        result["duration_nights"] = max(result["duration_days"] - 1, 0)

    missing_fields = []
    for field_name in [
        "destinations",
        "duration_days",
        "duration_nights",
        "total_budget_usd",
        "departure_city",
        "traveler_count",
        "accommodation_type",
        "room_requirements",
        "amenity_requirements",
    ]:
        value = result[field_name]
        if value is None or value == []:
            missing_fields.append(field_name)

    result["missing_fields"] = missing_fields
    return result


def _normalize_trip_itinerary_result(raw_result: dict[str, Any], parsed_trip: dict[str, Any]) -> dict[str, Any]:
    normalized_days = _normalize_itinerary_days(raw_result.get("itinerary_days", []), parsed_trip)
    normalized_expenses = _normalize_estimated_expenses(
        raw_result.get("estimated_expenses", []),
        parsed_trip,
    )

    total_estimated_cost = round(
        sum(day["estimated_day_cost"] for day in normalized_days),
        2,
    )
    total_budget_usd = _coerce_float(
        raw_result.get("budget_summary", {}).get("total_budget_usd")
        if isinstance(raw_result.get("budget_summary"), dict)
        else None
    )
    if total_budget_usd is None:
        total_budget_usd = _coerce_float(parsed_trip.get("total_budget_usd"))
    remaining_budget_usd = (
        round(total_budget_usd - total_estimated_cost, 2) if total_budget_usd is not None else None
    )

    return {
        "trip_summary": _coerce_optional_string(raw_result.get("trip_summary"))
        or _build_trip_summary(
            destinations=parsed_trip.get("destinations", []),
            total_days=_coerce_int(parsed_trip.get("duration_days")) or len(normalized_days),
            must_visit=parsed_trip.get("must_visit", []),
            extra_preferences=parsed_trip.get("extra_preferences", []),
        ),
        "itinerary_days": normalized_days,
        "estimated_expenses": normalized_expenses,
        "budget_summary": {
            "total_estimated_cost": total_estimated_cost,
            "total_budget_usd": total_budget_usd,
            "remaining_budget_usd": remaining_budget_usd,
            "is_within_budget": total_estimated_cost <= total_budget_usd if total_budget_usd is not None else None,
            "accommodation_placeholder_included": True,
        },
    }


def _normalize_trip_itinerary_refinement_result(
    raw_result: dict[str, Any],
    parsed_trip: dict[str, Any],
    original_itinerary_days: list[dict[str, Any]],
) -> dict[str, Any]:
    normalized_days = _normalize_itinerary_days(
        raw_result.get("updated_itinerary_days", original_itinerary_days),
        parsed_trip,
    )
    normalized_expenses = _normalize_estimated_expenses(
        raw_result.get("updated_estimated_expenses", []),
        parsed_trip,
    )
    if not normalized_expenses:
        normalized_expenses = _rebuild_estimated_expenses(normalized_days)

    budget_input = raw_result.get("updated_budget_summary", {})
    if not isinstance(budget_input, dict):
        budget_input = {}
    normalized_budget = _rebuild_budget_summary(
        normalized_days=normalized_days,
        parsed_trip=parsed_trip,
        budget_summary=budget_input,
    )

    return {
        "updated_itinerary_days": normalized_days,
        "updated_estimated_expenses": normalized_expenses,
        "updated_budget_summary": normalized_budget,
        "explanation_summary": _coerce_optional_string(raw_result.get("explanation_summary")),
    }


def _normalize_accommodation_search_tasks_result(
    raw_result: dict[str, Any],
    parsed_trip: dict[str, Any],
    itinerary_days: list[dict[str, Any]],
    budget_summary: dict[str, Any] | None,
    previous_selected_accommodations: list[dict[str, Any]],
) -> dict[str, Any]:
    normalized_days = _normalize_itinerary_days(itinerary_days, parsed_trip)
    raw_tasks = raw_result.get("accommodation_search_tasks", [])
    normalized_tasks: list[dict[str, Any]] = []
    fallback_nightly_budget = _estimate_nightly_budget(
        parsed_trip=parsed_trip,
        budget_summary=budget_summary,
        total_nights=max(_coerce_int(parsed_trip.get("duration_nights")) or 0, 1),
    )

    for index, raw_task in enumerate(raw_tasks, start=1):
        fallback_day = normalized_days[min(index - 1, len(normalized_days) - 1)] if normalized_days else {}
        city = _coerce_optional_string(raw_task.get("city")) or _coerce_optional_string(fallback_day.get("city")) or "Destination TBD"
        previous_selected = raw_task.get("previous_selected_accommodation")
        normalized_previous_selected = None
        if isinstance(previous_selected, dict):
            name = _coerce_optional_string(previous_selected.get("name"))
            previous_city = _coerce_optional_string(previous_selected.get("city"))
            if name and previous_city:
                normalized_previous_selected = {
                    "name": name,
                    "city": previous_city,
                    "area": _coerce_optional_string(previous_selected.get("area")),
                    "address": _coerce_optional_string(previous_selected.get("address")),
                    "url": _coerce_optional_string(previous_selected.get("url")),
                }
        if normalized_previous_selected is None:
            normalized_previous_selected = _find_previous_selected_accommodation(
                previous_selected_accommodations,
                city=city,
            )

        normalized_tasks.append(
            {
                "day_number": _coerce_int(raw_task.get("day_number")) or _coerce_int(fallback_day.get("day_number")) or index,
                "city": city,
                "target_area": _coerce_optional_string(raw_task.get("target_area"))
                or _coerce_optional_string(fallback_day.get("end_area"))
                or _coerce_optional_string(fallback_day.get("start_area")),
                "check_in_date": _coerce_optional_string(raw_task.get("check_in_date")),
                "check_out_date": _coerce_optional_string(raw_task.get("check_out_date")),
                "traveler_count": _coerce_int(raw_task.get("traveler_count"))
                or _coerce_int(parsed_trip.get("traveler_count")),
                "nightly_budget": _coerce_float(raw_task.get("nightly_budget")) or fallback_nightly_budget,
                "accommodation_type": _coerce_optional_string(raw_task.get("accommodation_type"))
                or _coerce_optional_string(parsed_trip.get("accommodation_type")),
                "room_requirements": list(
                    dict.fromkeys(
                        [
                            str(item).strip()
                            for item in raw_task.get("room_requirements", parsed_trip.get("room_requirements", []))
                            if str(item).strip()
                        ]
                    )
                ),
                "amenity_requirements": list(
                    dict.fromkeys(
                        [
                            str(item).strip()
                            for item in raw_task.get(
                                "amenity_requirements",
                                parsed_trip.get("amenity_requirements", []),
                            )
                            if str(item).strip()
                        ]
                    )
                ),
                "previous_selected_accommodation": normalized_previous_selected,
                "next_day_start_area": _coerce_optional_string(raw_task.get("next_day_start_area")),
                "reuse_flag": bool(raw_task.get("reuse_flag", False)),
            }
        )

    return {"accommodation_search_tasks": normalized_tasks}


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_itinerary_days(raw_days: list[dict[str, Any]], parsed_trip: dict[str, Any]) -> list[dict[str, Any]]:
    normalized_days: list[dict[str, Any]] = []
    for index, raw_day in enumerate(raw_days, start=1):
        activities = []
        for raw_activity in raw_day.get("activities", []):
            category = str(raw_activity.get("category") or "other").strip().lower()
            if category not in {"attraction", "food", "transport", "hotel", "other"}:
                category = "other"
            activities.append(
                {
                    "label": str(raw_activity.get("label") or "Planned activity").strip(),
                    "category": category,
                    "notes": _coerce_optional_string(raw_activity.get("notes")),
                    "estimated_cost": _coerce_float(raw_activity.get("estimated_cost")),
                    "url": _coerce_optional_string(raw_activity.get("url")),
                    "start_area": _coerce_optional_string(raw_activity.get("start_area")),
                    "end_area": _coerce_optional_string(raw_activity.get("end_area")),
                }
            )

        normalized_days.append(
            {
                "day_number": _coerce_int(raw_day.get("day_number")) or index,
                "city": _coerce_optional_string(raw_day.get("city")) or _fallback_city_for_day(parsed_trip, index),
                "title": _coerce_optional_string(raw_day.get("title")) or f"Day {index} plan",
                "activities": activities,
                "estimated_day_cost": round(
                    _coerce_float(raw_day.get("estimated_day_cost"))
                    or sum(activity.get("estimated_cost") or 0 for activity in activities),
                    2,
                ),
                "start_area": _coerce_optional_string(raw_day.get("start_area")),
                "end_area": _coerce_optional_string(raw_day.get("end_area")),
            }
        )
    return normalized_days


def _normalize_estimated_expenses(
    raw_groups: list[dict[str, Any]],
    parsed_trip: dict[str, Any],
) -> list[dict[str, Any]]:
    normalized_expenses: list[dict[str, Any]] = []
    for raw_group in raw_groups:
        items = []
        for raw_item in raw_group.get("items", []):
            category = str(raw_item.get("category") or "other").strip().lower()
            if category not in {"attraction", "food", "transport", "hotel", "other"}:
                category = "other"
            items.append(
                {
                    "label": str(raw_item.get("label") or "Expense item").strip(),
                    "url": _coerce_optional_string(raw_item.get("url")),
                    "estimated_cost": round(_coerce_float(raw_item.get("estimated_cost")) or 0, 2),
                    "category": category,
                }
            )
        normalized_expenses.append(
            {
                "day_number": _coerce_int(raw_group.get("day_number")) or len(normalized_expenses) + 1,
                "city": _coerce_optional_string(raw_group.get("city"))
                or _fallback_city_for_day(parsed_trip, len(normalized_expenses) + 1),
                "items": items,
            }
        )
    return normalized_expenses


def _rebuild_estimated_expenses(normalized_days: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rebuilt_groups: list[dict[str, Any]] = []
    for day in normalized_days:
        items = [_expense_from_activity(activity) for activity in day.get("activities", [])]
        rebuilt_groups.append(
            {
                "day_number": day["day_number"],
                "city": day["city"],
                "items": items,
            }
        )
    return rebuilt_groups


def _rebuild_budget_summary(
    normalized_days: list[dict[str, Any]],
    parsed_trip: dict[str, Any],
    budget_summary: dict[str, Any],
) -> dict[str, Any]:
    total_estimated_cost = round(sum(day["estimated_day_cost"] for day in normalized_days), 2)
    total_budget_usd = _coerce_float(budget_summary.get("total_budget_usd"))
    if total_budget_usd is None:
        total_budget_usd = _coerce_float(parsed_trip.get("total_budget_usd"))
    remaining_budget_usd = (
        round(total_budget_usd - total_estimated_cost, 2) if total_budget_usd is not None else None
    )
    accommodation_placeholder_included = budget_summary.get("accommodation_placeholder_included")
    return {
        "total_estimated_cost": total_estimated_cost,
        "total_budget_usd": total_budget_usd,
        "remaining_budget_usd": remaining_budget_usd,
        "is_within_budget": total_estimated_cost <= total_budget_usd if total_budget_usd is not None else None,
        "accommodation_placeholder_included": bool(
            True if accommodation_placeholder_included is None else accommodation_placeholder_included
        ),
    }


def _build_city_sequence(destinations: list[str], total_days: int) -> list[str]:
    if len(destinations) == 1:
        return [destinations[0]] * total_days

    if total_days <= len(destinations):
        return destinations[:total_days]

    sequence = [destinations[0]]
    remaining_days = total_days - 1
    remaining_cities = len(destinations) - 1

    for index, city in enumerate(destinations[1:], start=1):
        days_for_city = max(1, remaining_days // remaining_cities)
        if index == len(destinations) - 1:
            days_for_city = remaining_days
        sequence.extend([city] * days_for_city)
        remaining_days -= days_for_city
        remaining_cities -= 1

    return sequence[:total_days]


def _default_area_for_city(city: str, position: str) -> str:
    city_key = city.lower()
    if "ho chi minh" in city_key:
        return "District 1" if position == "start" else "District 3"
    if "da lat" in city_key:
        return "Da Lat Center" if position == "start" else "Xuan Huong Lake"
    if "tokyo" in city_key:
        return "Ueno" if position == "start" else "Shibuya"
    return f"{city} Center"


def _default_attraction_label(city: str, day_number: int) -> str:
    city_key = city.lower()
    if "ho chi minh" in city_key:
        return "Cafe apartments and central district walk" if day_number == 1 else "Ben Thanh and nearby city highlights"
    if "da lat" in city_key:
        return "Da Lat viewpoints and cafe stops"
    if "tokyo" in city_key:
        return "Neighborhood highlights and flexible sightseeing block"
    return f"Core sights in {city}"


def _build_day_title(city: str, day_number: int, city_sequence: list[str], activities: list[dict[str, Any]]) -> str:
    if day_number > 1 and city_sequence[day_number - 2] != city:
        return f"Transfer to {city} and settle into the area"
    if any(activity["category"] == "hotel" for activity in activities):
        return f"Arrival and first look at {city}"
    return f"Explore {city} at a practical pace"


def _expense_from_activity(activity: dict[str, Any]) -> dict[str, Any]:
    return {
        "label": activity["label"],
        "url": activity.get("url"),
        "estimated_cost": round(_coerce_float(activity.get("estimated_cost")) or 0, 2),
        "category": activity["category"],
    }


def _build_trip_summary(
    destinations: list[Any],
    total_days: int,
    must_visit: list[Any],
    extra_preferences: list[Any],
) -> str:
    destination_text = ", ".join(str(destination) for destination in destinations if str(destination).strip()) or "the planned destinations"
    must_visit_text = ""
    if must_visit:
        must_visit_text = " It preserves must-visit stops such as " + ", ".join(
            str(place) for place in must_visit if str(place).strip()
        ) + "."
    preference_text = ""
    cleaned_preferences = [str(item).strip() for item in extra_preferences if str(item).strip()]
    if cleaned_preferences:
        preference_text = " Preferences carried into the plan: " + ", ".join(cleaned_preferences) + "."
    return (
        f"A practical {total_days}-day trip across {destination_text} with balanced sightseeing, food, "
        "transport, and placeholder accommodation coverage."
        + must_visit_text
        + preference_text
    )


def _fallback_city_for_day(parsed_trip: dict[str, Any], day_number: int) -> str:
    destinations = [str(destination) for destination in parsed_trip.get("destinations", []) if str(destination).strip()]
    if not destinations:
        return "Destination TBD"
    city_sequence = _build_city_sequence(destinations, max(day_number, len(destinations)))
    return city_sequence[day_number - 1]


def _extract_day_number(message_lower: str) -> int | None:
    match = re.search(r"\bday\s+(\d+)\b", message_lower)
    return _coerce_int(match.group(1)) if match else None


def _extract_target_city(
    message_lower: str,
    parsed_trip: dict[str, Any],
    itinerary_days: list[dict[str, Any]],
) -> str | None:
    candidate_cities = []
    for destination in parsed_trip.get("destinations", []):
        destination_text = str(destination).strip()
        if destination_text:
            candidate_cities.append(destination_text)
    for day in itinerary_days:
        city = _coerce_optional_string(day.get("city"))
        if city and city not in candidate_cities:
            candidate_cities.append(city)

    message_tokens = message_lower.replace("+", " ").split()
    normalized_message = " ".join(message_tokens)
    for city in candidate_cities:
        if city.lower() in normalized_message:
            return city
    return None


def _find_day_for_city(itinerary_days: list[dict[str, Any]], city: str | None) -> dict[str, Any] | None:
    if city is None:
        return itinerary_days[0] if itinerary_days else None
    for day in itinerary_days:
        if _coerce_optional_string(day.get("city")) == city:
            return day
    return itinerary_days[0] if itinerary_days else None


def _replacement_attraction_label(city_name: str) -> str:
    city_key = city_name.lower()
    if "da lat" in city_key:
        return "Da Lat flower gardens and hillside views"
    if "ho chi minh" in city_key:
        return "Nguyen Hue and nearby heritage walk"
    if "tokyo" in city_key:
        return "Neighborhood stroll with lower walking intensity"
    return f"Alternative highlights in {city_name}"


def _estimate_nightly_budget(
    parsed_trip: dict[str, Any],
    budget_summary: dict[str, Any] | None,
    total_nights: int,
) -> float | None:
    if total_nights <= 0:
        return None

    total_budget_usd = _coerce_float(parsed_trip.get("total_budget_usd"))
    total_estimated_cost = _coerce_float(budget_summary.get("total_estimated_cost")) if budget_summary else None
    if total_budget_usd is None:
        return None

    remaining_budget = total_budget_usd - (total_estimated_cost or 0)
    rough_total_for_stays = max(remaining_budget, total_budget_usd * 0.35)
    return round(max(rough_total_for_stays / total_nights, 35.0), 2)


def _find_previous_selected_accommodation(
    previous_selected_accommodations: list[dict[str, Any]],
    city: str | None,
) -> dict[str, Any] | None:
    if not previous_selected_accommodations:
        return None
    if city is None:
        first = previous_selected_accommodations[0]
        return {
            "name": _coerce_optional_string(first.get("name")),
            "city": _coerce_optional_string(first.get("city")),
            "area": _coerce_optional_string(first.get("area")),
            "address": _coerce_optional_string(first.get("address")),
            "url": _coerce_optional_string(first.get("url")),
        } if _coerce_optional_string(first.get("name")) and _coerce_optional_string(first.get("city")) else None

    for accommodation in previous_selected_accommodations:
        if _coerce_optional_string(accommodation.get("city")) == city:
            name = _coerce_optional_string(accommodation.get("name"))
            accommodation_city = _coerce_optional_string(accommodation.get("city"))
            if name and accommodation_city:
                return {
                    "name": name,
                    "city": accommodation_city,
                    "area": _coerce_optional_string(accommodation.get("area")),
                    "address": _coerce_optional_string(accommodation.get("address")),
                    "url": _coerce_optional_string(accommodation.get("url")),
                }
    return None


def _areas_are_within_reuse_range(
    city: str,
    current_end_area: str,
    next_day_start_area: str,
    previous_area: str | None,
) -> bool:
    city_key = city.lower()
    current_key = current_end_area.strip().lower()
    next_key = next_day_start_area.strip().lower()
    previous_key = previous_area.strip().lower() if previous_area else None

    if current_key == next_key:
        return True
    if previous_key is not None and (previous_key == current_key or previous_key == next_key):
        return True

    nearby_area_pairs = {
        "ho chi minh city": {
            frozenset({"district 1", "district 3"}),
            frozenset({"district 1", "binh thanh"}),
            frozenset({"district 3", "binh thanh"}),
        },
        "da lat": {
            frozenset({"da lat center", "xuan huong lake"}),
            frozenset({"da lat center", "ward 1"}),
            frozenset({"xuan huong lake", "ward 1"}),
        },
        "tokyo": {
            frozenset({"ueno", "asakusa"}),
            frozenset({"shibuya", "shinjuku"}),
            frozenset({"ginza", "tokyo station"}),
        },
    }

    city_pairs = nearby_area_pairs.get(city_key, set())
    area_pair = frozenset({current_key, next_key})
    return area_pair in city_pairs
