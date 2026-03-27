"use client";

import { FormEvent, useState } from "react";
import { runAgent, type AgentRunResponse } from "../lib/api";

export default function HomePage() {
  const [goal, setGoal] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRunResponse | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await runAgent({
        goal: goal.trim(),
        url: url.trim() || undefined
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">AI Hackathon Starter</h1>
        <p className="text-sm text-slate-300">
          Enter a goal, optionally add a target URL, and run a minimal agent flow.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4"
      >
        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="goal">
            Goal
          </label>
          <textarea
            id="goal"
            className="min-h-28 w-full rounded-md border border-slate-700 bg-slate-950 p-3 text-sm outline-none ring-blue-500/50 focus:ring-2"
            placeholder="Find the latest pricing tiers and key differences."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="url">
            Target URL (optional)
          </label>
          <input
            id="url"
            className="w-full rounded-md border border-slate-700 bg-slate-950 p-3 text-sm outline-none ring-blue-500/50 focus:ring-2"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-800"
          disabled={loading || !goal.trim()}
        >
          {loading ? "Running..." : "Run Agent"}
        </button>
      </form>

      {error && (
        <section className="rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </section>
      )}

      {result && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-300">
            <span className="font-medium text-slate-100">Status:</span> {result.status}
          </p>
          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-200">Plan</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
              {result.plan.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-200">Summary</h2>
            <p className="text-sm text-slate-300">{result.summary}</p>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-200">Data</h2>
            <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-200">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-200">Sources</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
              {result.sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
