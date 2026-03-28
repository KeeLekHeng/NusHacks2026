from __future__ import annotations

import re
from typing import Any

from app.schemas.trip_accommodation_ranking import (
    AccommodationRankingRequest,
    AccommodationRankingResponse,
)


def run_trip_accommodation_ranking(
    payload: AccommodationRankingRequest,
) -> AccommodationRankingResponse:
    search_request = payload.search_request.model_dump()
    ranked_options = _rank_accommodation_results(
        search_request=search_request,
        raw_results=[item.model_dump() for item in payload.raw_results],
    )

    return AccommodationRankingResponse(
        day_number=payload.search_request.day_number,
        reuse_flag=payload.search_request.reuse_flag,
        reuse_option=payload.reuse_option,
        options=ranked_options,
    )


def rank_accommodation_results(
    search_request: dict[str, Any],
    raw_results: list[dict[str, Any]],
    reuse_option: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ranked_options = _rank_accommodation_results(
        search_request=search_request,
        raw_results=raw_results,
    )
    return {
        "day_number": search_request.get("day_number"),
        "reuse_flag": bool(search_request.get("reuse_flag", False)),
        "reuse_option": reuse_option,
        "options": ranked_options,
    }


def _rank_accommodation_results(
    search_request: dict[str, Any],
    raw_results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    normalized_candidates = [_normalize_candidate(raw_result) for raw_result in raw_results]
    deduped_candidates = _dedupe_candidates(normalized_candidates)

    scored_candidates: list[dict[str, Any]] = []
    for candidate in deduped_candidates:
        if not candidate.get("property_name") and not candidate.get("booking_url"):
            continue

        score, reason = _score_candidate(search_request, candidate)
        option = {
            **candidate,
            "option_id": _build_option_id(candidate),
            "why_recommended": _build_why_recommended(candidate, reason),
            "_score": score,
        }
        scored_candidates.append(option)

    scored_candidates.sort(
        key=lambda item: (
            -(item.get("_score") or 0),
            item.get("nightly_price") if item.get("nightly_price") is not None else float("inf"),
            -(item.get("rating") or 0),
            item.get("property_name") or "",
        )
    )

    frontend_ready: list[dict[str, Any]] = []
    for index, option in enumerate(scored_candidates[:9], start=1):
        cleaned = {
            key: value
            for key, value in option.items()
            if not key.startswith("_")
        }
        cleaned["rank"] = index
        frontend_ready.append(cleaned)

    return frontend_ready


def _normalize_candidate(raw_result: dict[str, Any]) -> dict[str, Any]:
    matched_amenities = [
        str(item).strip()
        for item in raw_result.get("matched_amenities", [])
        if str(item).strip()
    ]

    property_name = _optional_string(raw_result.get("property_name"))
    platform = _normalize_platform(raw_result.get("platform"))
    room_type = _optional_string(raw_result.get("room_type"))
    booking_url = _optional_string(raw_result.get("booking_url"))
    final_url = _optional_string(raw_result.get("final_page_before_checkout_url"))
    nightly_price = _optional_float(raw_result.get("nightly_price"))
    total_price = _optional_float(raw_result.get("total_price"))
    rating = _optional_float(raw_result.get("rating"))
    review_count = _optional_int(raw_result.get("review_count"))
    location_summary = _optional_string(raw_result.get("location_summary"))
    distance_to_target_km = _optional_float(raw_result.get("distance_to_target_km"))

    return {
        "property_name": property_name,
        "platform": platform,
        "room_type": room_type,
        "nightly_price": nightly_price,
        "total_price": total_price,
        "rating": rating,
        "review_count": review_count,
        "location_summary": location_summary,
        "distance_to_target_km": distance_to_target_km,
        "matched_amenities": list(dict.fromkeys(matched_amenities)),
        "booking_url": booking_url,
        "final_page_before_checkout_url": final_url,
        "is_within_budget": None,
        "why_recommended": _optional_string(raw_result.get("why_recommended")),
    }


def _dedupe_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    best_index_by_key: dict[tuple[str | None, str], int] = {}

    for candidate in candidates:
        key = (
            candidate.get("platform"),
            _canonical_listing_key(candidate),
        )
        existing_index = best_index_by_key.get(key)
        if existing_index is None:
            best_index_by_key[key] = len(deduped)
            deduped.append(candidate)
            continue

        existing = deduped[existing_index]
        deduped[existing_index] = _merge_duplicate_candidate(existing, candidate)

    return deduped


def _merge_duplicate_candidate(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = dict(existing)

    for key in [
        "property_name",
        "platform",
        "room_type",
        "location_summary",
        "booking_url",
        "final_page_before_checkout_url",
        "why_recommended",
    ]:
        if not merged.get(key) and incoming.get(key):
            merged[key] = incoming[key]

    for key in ["nightly_price", "total_price", "distance_to_target_km"]:
        merged[key] = _prefer_smaller_number(merged.get(key), incoming.get(key))

    for key in ["rating", "review_count"]:
        merged[key] = _prefer_larger_number(merged.get(key), incoming.get(key))

    merged["matched_amenities"] = list(
        dict.fromkeys(
            [*merged.get("matched_amenities", []), *incoming.get("matched_amenities", [])]
        )
    )

    return merged


def _score_candidate(search_request: dict[str, Any], candidate: dict[str, Any]) -> tuple[float, str]:
    required_amenities = {
        str(item).strip().lower()
        for item in search_request.get("amenity_requirements", [])
        if str(item).strip()
    }
    matched_amenities = {
        str(item).strip().lower()
        for item in candidate.get("matched_amenities", [])
        if str(item).strip()
    }
    room_requirements = [
        str(item).strip().lower()
        for item in search_request.get("room_requirements", [])
        if str(item).strip()
    ]
    accommodation_type = _optional_string(search_request.get("accommodation_type"))
    nightly_budget = _optional_float(search_request.get("nightly_budget"))
    nightly_price = _optional_float(candidate.get("nightly_price"))
    distance = _optional_float(candidate.get("distance_to_target_km"))
    rating = _optional_float(candidate.get("rating"))
    review_count = _optional_int(candidate.get("review_count")) or 0
    room_type = (candidate.get("room_type") or "").lower()
    property_name = candidate.get("property_name") or "This option"

    amenity_score = 0.0
    if required_amenities:
        amenity_score = 35.0 * (len(required_amenities & matched_amenities) / len(required_amenities))
    else:
        amenity_score = 20.0 if matched_amenities else 8.0

    room_score = 0.0
    if room_requirements:
        matches = sum(1 for requirement in room_requirements if requirement in room_type)
        room_score = 20.0 * (matches / len(room_requirements))
    else:
        room_score = 8.0 if room_type else 3.0

    type_score = 0.0
    if accommodation_type:
        type_score = 10.0 if accommodation_type.lower() in room_type or accommodation_type.lower() in property_name.lower() else 4.0
    else:
        type_score = 4.0

    budget_score = 0.0
    is_within_budget = None
    if nightly_budget is not None and nightly_price is not None:
        is_within_budget = nightly_price <= nightly_budget
        if is_within_budget:
            budget_score = 20.0 + min(8.0, ((nightly_budget - nightly_price) / max(nightly_budget, 1.0)) * 8.0)
        else:
            over_ratio = (nightly_price - nightly_budget) / max(nightly_budget, 1.0)
            budget_score = max(0.0, 14.0 - (over_ratio * 20.0))

    proximity_score = 6.0
    if distance is not None:
        proximity_score = max(0.0, 15.0 - min(distance, 15.0))

    rating_score = 0.0
    if rating is not None:
        rating_score += min((rating / 5.0) * 10.0, 10.0)
    rating_score += min(review_count / 250.0, 5.0)

    value_score = 0.0
    if nightly_price is not None:
        if nightly_budget is not None and nightly_budget > 0:
            value_score = max(0.0, min(10.0, ((nightly_budget - nightly_price) / nightly_budget) * 10.0 + 5.0))
        else:
            value_score = max(1.0, 10.0 - min(nightly_price / 30.0, 9.0))

    total_score = round(
        amenity_score + room_score + type_score + budget_score + proximity_score + rating_score + value_score,
        2,
    )
    candidate["is_within_budget"] = is_within_budget

    if required_amenities and required_amenities <= matched_amenities:
        reason = "matches the required amenities"
    elif is_within_budget:
        reason = "stays within budget"
    elif distance is not None and distance <= 1.5:
        reason = "is close to the target area"
    elif rating is not None and rating >= 4.6:
        reason = "has strong review quality"
    else:
        reason = "offers balanced overall value"

    return total_score, f"{property_name} {reason}"


def _build_why_recommended(candidate: dict[str, Any], fallback_reason: str) -> str:
    existing = _optional_string(candidate.get("why_recommended"))
    if existing:
        return existing.strip()[:180]
    return fallback_reason[:180]


def _build_option_id(candidate: dict[str, Any]) -> str:
    platform = (candidate.get("platform") or "option").lower()
    booking_url = candidate.get("booking_url") or ""
    if booking_url:
        slug_source = booking_url
    else:
        slug_source = candidate.get("property_name") or "listing"
    slug = re.sub(r"[^a-z0-9]+", "-", slug_source.lower()).strip("-")
    return f"{platform}-{slug[:48] or 'listing'}"


def _canonical_listing_key(candidate: dict[str, Any]) -> str:
    booking_url = _optional_string(candidate.get("booking_url"))
    if booking_url:
        return booking_url.lower().rstrip("/")

    property_name = _optional_string(candidate.get("property_name")) or "listing"
    room_type = _optional_string(candidate.get("room_type")) or ""
    return re.sub(r"[^a-z0-9]+", "", f"{property_name}-{room_type}".lower())


def _normalize_platform(value: Any) -> str | None:
    platform = _optional_string(value)
    if platform is None:
        return None
    lowered = platform.lower()
    if "trip" in lowered:
        return "Trip.com"
    if "airbnb" in lowered:
        return "Airbnb"
    return platform


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _prefer_smaller_number(left: float | None, right: float | None) -> float | None:
    if left is None:
        return right
    if right is None:
        return left
    return min(left, right)


def _prefer_larger_number(left: float | int | None, right: float | int | None) -> float | int | None:
    if left is None:
        return right
    if right is None:
        return left
    return left if left >= right else right

