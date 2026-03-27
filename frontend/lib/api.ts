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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
