from typing import Any

from openai import OpenAI


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
