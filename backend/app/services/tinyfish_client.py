from __future__ import annotations

from collections.abc import Iterable
import json
import re
import time
from typing import Any

import httpx

from app.services.prompt_templates import build_accommodation_search_tinyfish_prompt


def _tinyfish_has_usable_result(payload: dict[str, Any]) -> bool:
    if not isinstance(payload, dict):
        return False
    return bool(_find_candidate_item_lists(payload) or _find_json_objects(payload))


def _tinyfish_is_terminal_status(status: str | None) -> bool:
    return (status or "").upper() in {"COMPLETED", "FAILED", "CANCELLED", "ERROR"}


def _poll_tinyfish_run(
    client: httpx.Client,
    run_id: str,
    headers: dict[str, str],
    base_url: str,
    timeout_seconds: int = 300,
    poll_interval_seconds: float = 1.0,
) -> dict[str, Any] | None:
    endpoint_candidates = [
        f"{base_url.rstrip('/')}/v1/automation/runs/{run_id}",
        f"{base_url.rstrip('/')}/v1/automation/run/{run_id}",
    ]
    deadline = time.monotonic() + timeout_seconds
    latest_payload: dict[str, Any] | None = None

    while time.monotonic() < deadline:
        for endpoint in endpoint_candidates:
            try:
                response = client.get(endpoint, headers=headers)
                response.raise_for_status()
                payload = response.json()
                latest_payload = payload
                if _tinyfish_has_usable_result(payload):
                    return payload
                if _tinyfish_is_terminal_status(payload.get("status")):
                    return payload
            except Exception:
                continue
        time.sleep(poll_interval_seconds)

    return latest_payload


def run_tinyfish(goal: str, url: str | None, api_key: str | None, base_url: str) -> dict[str, Any]:
    if not url:
        return {
            "provider": "tinyfish",
            "mode": "skipped",
            "result": {},
            "note": "No URL provided. TinyFish step skipped.",
        }

    if not api_key:
        return {
            "provider": "tinyfish",
            "mode": "mock",
            "result": {
                "message": f"Mock extraction for goal '{goal}' on {url}",
                "items": [],
            },
            "note": "Set TINYFISH_API_KEY to run live extraction.",
        }

    endpoint = f"{base_url.rstrip('/')}/v1/automation/run"
    payload = {"goal": goal, "url": url}
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

    with httpx.Client(timeout=60) as client:
        response = client.post(endpoint, json=payload, headers=headers)
        response.raise_for_status()
        initial_payload = response.json()

        if _tinyfish_has_usable_result(initial_payload):
            return initial_payload

        run_id = initial_payload.get("run_id")
        if isinstance(run_id, str) and run_id.strip():
            polled_payload = _poll_tinyfish_run(
                client=client,
                run_id=run_id,
                headers=headers,
                base_url=base_url,
            )
            if polled_payload is not None:
                return polled_payload

        return initial_payload


def search_accommodations_with_tinyfish(
    search_request: dict[str, Any],
    api_key: str | None,
    base_url: str,
) -> dict[str, Any]:
    if not api_key:
        return {
            "mode": "mock",
            "reuse_option": _build_mock_reuse_option(search_request),
            "results": _build_mock_accommodation_options(search_request),
        }

    platform_targets = [
        ("Trip.com", "https://www.trip.com/hotels/"),
    ]

    normalized_options: list[dict[str, Any]] = []
    reuse_option: dict[str, Any] | None = None

    for platform, url in platform_targets:
        goal = build_accommodation_search_tinyfish_prompt(
            {**search_request, "preferred_platform": platform}
        )
        try:
            response = run_tinyfish(goal=goal, url=url, api_key=api_key, base_url=base_url)
        except Exception as exc:
            print("[tinyfish][accommodation_search][platform_error]", platform, repr(exc))
            continue

        print(
            "[tinyfish][accommodation_search][platform_response]",
            platform,
            _describe_payload_shape(response),
        )
        extracted_reuse_option = _normalize_tinyfish_reuse_option(response, platform)
        if reuse_option is None and extracted_reuse_option is not None:
            reuse_option = extracted_reuse_option
        platform_options = _normalize_tinyfish_accommodation_results(response, platform)
        print(
            "[tinyfish][accommodation_search][platform_normalized_count]",
            platform,
            len(platform_options),
        )
        normalized_options.extend(platform_options)

    unique_options = _dedupe_accommodation_options(normalized_options)
    if not unique_options:
        return {
            "mode": "fallback",
            "reuse_option": reuse_option or _build_mock_reuse_option(search_request),
            "results": _build_mock_accommodation_options(search_request)[:3],
        }

    return {
        "mode": "live",
        "reuse_option": reuse_option,
        "results": unique_options[:3],
    }


def _normalize_tinyfish_accommodation_results(
    response: dict[str, Any],
    platform: str,
) -> list[dict[str, Any]]:
    candidate_items = _find_candidate_item_lists(response)
    if not candidate_items:
        for payload in _find_json_objects(response):
            candidate_items.extend(_find_candidate_item_lists(payload))
    normalized: list[dict[str, Any]] = []

    for item in candidate_items:
        property_name = _coerce_string(
            item,
            ["property_name", "name", "title", "listing_name", "hotel_name"],
        )
        booking_url = _coerce_string(item, ["booking_url", "url", "link"])
        final_url = _coerce_string(
            item,
            ["final_page_before_checkout_url", "final_url", "page_url", "detail_url"],
        )

        if not property_name and not booking_url and not final_url:
            continue

        normalized.append(
            {
                "property_name": property_name,
                "platform": _coerce_string(item, ["platform"]) or platform,
                "room_type": _coerce_string(item, ["room_type", "room_name", "unit_type"]),
                "nightly_price": _coerce_float(
                    item,
                    ["nightly_price", "price_per_night", "night_price", "price"],
                ),
                "total_price": _coerce_float(item, ["total_price", "total", "stay_total"]),
                "rating": _coerce_float(item, ["rating", "review_score", "stars"]),
                "review_count": _coerce_int(item, ["review_count", "reviews", "review_total"]),
                "location_summary": _coerce_string(
                    item,
                    ["location_summary", "location", "address_summary", "area_summary"],
                ),
                "distance_to_target_km": _coerce_float(
                    item,
                    ["distance_to_target_km", "distance_km", "distance"],
                ),
                "matched_amenities": _coerce_string_list(
                    item,
                    ["matched_amenities", "amenities", "key_amenities"],
                ),
                "booking_url": booking_url,
                "final_page_before_checkout_url": final_url,
                "why_recommended": _coerce_string(
                    item,
                    ["why_recommended", "recommendation_reason", "reason"],
                ),
            }
        )

    return normalized


def _normalize_tinyfish_reuse_option(
    response: dict[str, Any],
    platform: str,
) -> dict[str, Any] | None:
    if not isinstance(response, dict):
        return None

    raw_reuse = response.get("reuse_option")
    if not isinstance(raw_reuse, dict):
        result = response.get("result")
        if isinstance(result, dict):
            raw_reuse = result.get("reuse_option")

    if not isinstance(raw_reuse, dict):
        for payload in _find_json_objects(response):
            if isinstance(payload, dict):
                nested_reuse = payload.get("reuse_option")
                if isinstance(nested_reuse, dict):
                    raw_reuse = nested_reuse
                    break

    if not isinstance(raw_reuse, dict):
        return None

    return {
        "available": bool(raw_reuse.get("available", False)),
        "property_name": _coerce_string(raw_reuse, ["property_name", "name", "title"]),
        "platform": _coerce_string(raw_reuse, ["platform"]) or platform,
        "nightly_price": _coerce_float(raw_reuse, ["nightly_price", "price", "price_per_night"]),
        "booking_url": _coerce_string(raw_reuse, ["booking_url", "url", "link"]),
        "notes": _coerce_string(raw_reuse, ["notes", "reason", "summary"]),
    }


def _find_candidate_item_lists(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if isinstance(payload, str):
        discovered: list[dict[str, Any]] = []
        for parsed in _extract_json_payloads_from_text(payload):
            discovered.extend(_find_candidate_item_lists(parsed))
        return discovered

    if not isinstance(payload, dict):
        return []

    if _looks_like_listing(payload):
        return [payload]

    common_keys = ["items", "results", "listings", "properties", "data", "result"]
    for key in common_keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = _find_candidate_item_lists(value)
            if nested:
                return nested
        if isinstance(value, str):
            nested = _find_candidate_item_lists(value)
            if nested:
                return nested

    discovered: list[dict[str, Any]] = []
    for value in payload.values():
        if isinstance(value, dict):
            discovered.extend(_find_candidate_item_lists(value))
        elif isinstance(value, list):
            discovered.extend(item for item in value if isinstance(item, dict))
        elif isinstance(value, str):
            discovered.extend(_find_candidate_item_lists(value))

    return discovered


def _find_json_objects(payload: Any) -> list[dict[str, Any]]:
    discovered: list[dict[str, Any]] = []
    if isinstance(payload, dict):
        discovered.append(payload)
        for value in payload.values():
            discovered.extend(_find_json_objects(value))
    elif isinstance(payload, list):
        for item in payload:
            discovered.extend(_find_json_objects(item))
    elif isinstance(payload, str):
        for parsed in _extract_json_payloads_from_text(payload):
            discovered.extend(_find_json_objects(parsed))
    return discovered


def _extract_json_payloads_from_text(text: str) -> list[Any]:
    stripped = text.strip()
    if not stripped:
        return []

    candidates: list[str] = []
    fenced_match = re.search(r"```(?:json)?\s*(.*?)```", stripped, re.DOTALL | re.IGNORECASE)
    if fenced_match:
        candidates.append(fenced_match.group(1).strip())

    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start_index = stripped.find(start_char)
        end_index = stripped.rfind(end_char)
        if start_index != -1 and end_index != -1 and end_index > start_index:
            candidates.append(stripped[start_index : end_index + 1])

    candidates.append(stripped)

    parsed_payloads: list[Any] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            parsed_payloads.append(json.loads(candidate))
        except Exception:
            continue
    return parsed_payloads


def _looks_like_listing(item: dict[str, Any]) -> bool:
    indicative_keys = {
        "property_name",
        "hotel_name",
        "listing_name",
        "name",
        "title",
        "booking_url",
        "final_page_before_checkout_url",
        "url",
        "link",
        "price",
        "nightly_price",
        "price_per_night",
    }
    return any(key in item for key in indicative_keys)


def _describe_payload_shape(payload: Any) -> str:
    if isinstance(payload, dict):
        keys = sorted(str(key) for key in payload.keys())
        return f"dict(keys={keys[:12]})"
    if isinstance(payload, list):
        return f"list(len={len(payload)})"
    if isinstance(payload, str):
        return f"str(len={len(payload)})"
    return type(payload).__name__


def _dedupe_accommodation_options(options: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str | None, str | None]] = set()

    for option in options:
        key = (option.get("platform"), option.get("booking_url") or option.get("property_name"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(option)

    return deduped


def _build_mock_accommodation_options(search_request: dict[str, Any]) -> list[dict[str, Any]]:
    city = search_request.get("city") or "Target city"
    target_area = search_request.get("target_area") or "Central area"
    nightly_budget = search_request.get("nightly_budget")
    budget_anchor = int(nightly_budget) if isinstance(nightly_budget, (int, float)) else 110
    traveler_count = search_request.get("traveler_count") or 2
    room_requirements = search_request.get("room_requirements") or []
    amenity_requirements = search_request.get("amenity_requirements") or []

    amenity_seed = [str(item) for item in amenity_requirements[:3]]
    if "wifi" not in amenity_seed:
        amenity_seed.append("wifi")

    return [
        {
            "property_name": f"{city} Atelier Loft",
            "platform": "Airbnb",
            "room_type": "Entire studio",
            "nightly_price": float(max(budget_anchor - 8, 55)),
            "total_price": float(max((budget_anchor - 8) * 1.18, 65)),
            "rating": 4.9,
            "review_count": 128,
            "location_summary": f"Stylish stay in {target_area} with easy evening access and a quieter feel.",
            "distance_to_target_km": 1.2,
            "matched_amenities": amenity_seed,
            "booking_url": "https://airbnb.example.com/mock-atelier-loft",
            "final_page_before_checkout_url": "https://airbnb.example.com/mock-atelier-loft/details",
            "why_recommended": f"Strong fit for {traveler_count} traveler(s) with a premium home-style setup.",
        },
        {
            "property_name": f"{city} Central Suites",
            "platform": "Trip.com",
            "room_type": "Deluxe double room",
            "nightly_price": float(max(budget_anchor - 16, 49)),
            "total_price": float(max((budget_anchor - 16) * 1.16, 59)),
            "rating": 4.6,
            "review_count": 684,
            "location_summary": f"Practical hotel base near {target_area} for short transfers and easy mornings.",
            "distance_to_target_km": 0.8,
            "matched_amenities": amenity_seed,
            "booking_url": "https://trip.example.com/mock-central-suites",
            "final_page_before_checkout_url": "https://trip.example.com/mock-central-suites/details",
            "why_recommended": "Balanced value pick with strong location convenience.",
        },
        {
            "property_name": f"{city} Residence House",
            "platform": "Airbnb",
            "room_type": "Private apartment",
            "nightly_price": float(max(budget_anchor + 6, 62)),
            "total_price": float(max((budget_anchor + 6) * 1.2, 75)),
            "rating": 4.8,
            "review_count": 211,
            "location_summary": f"Relaxed apartment stay close to {target_area} with more breathing room.",
            "distance_to_target_km": 1.7,
            "matched_amenities": list(dict.fromkeys(amenity_seed + [str(item) for item in room_requirements[:2]])),
            "booking_url": "https://airbnb.example.com/mock-residence-house",
            "final_page_before_checkout_url": "https://airbnb.example.com/mock-residence-house/details",
            "why_recommended": "Good option when comfort and flexibility matter more than the absolute lowest price.",
        },
    ]


def _build_mock_reuse_option(search_request: dict[str, Any]) -> dict[str, Any] | None:
    if not search_request.get("reuse_flag"):
        return None

    previous_selected = search_request.get("previous_selected_accommodation") or {}
    property_name = previous_selected.get("name")
    if not property_name:
        return {
            "available": False,
            "property_name": None,
            "platform": None,
            "nightly_price": None,
            "booking_url": None,
            "notes": "Reuse was requested but no previous accommodation was provided.",
        }

    nightly_budget = search_request.get("nightly_budget")
    nightly_price = (
        round(float(nightly_budget) * 0.96, 2)
        if isinstance(nightly_budget, (int, float))
        else None
    )
    return {
        "available": True,
        "property_name": str(property_name),
        "platform": "Reuse check",
        "nightly_price": nightly_price,
        "booking_url": previous_selected.get("url"),
        "notes": "Mock reuse option carried forward for a second-night availability check.",
    }


def _coerce_string(item: dict[str, Any], keys: list[str]) -> str | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _coerce_float(item: dict[str, Any], keys: list[str]) -> float | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            cleaned = "".join(character for character in value if character.isdigit() or character in ".-")
            if cleaned in {"", ".", "-", "-."}:
                continue
            try:
                return float(cleaned)
            except ValueError:
                continue
    return None


def _coerce_int(item: dict[str, Any], keys: list[str]) -> int | None:
    value = _coerce_float(item, keys)
    if value is None:
        return None
    return int(value)


def _coerce_string_list(item: dict[str, Any], keys: list[str]) -> list[str]:
    for key in keys:
        value = item.get(key)
        if isinstance(value, list):
            return [str(entry).strip() for entry in value if str(entry).strip()]
        if isinstance(value, str) and value.strip():
            return [part.strip() for part in value.split(",") if part.strip()]
    return []
