"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export default function Home() {
  const seedDemo = useAction(api.orchestrate.seedDemo);
  const demoEvent = useQuery(api.events.getBySlug, {
    slug: "world-of-concrete-2026",
  });
  const matches = useQuery(
    api.contracts.listAccountMatchesByEvent,
    demoEvent ? { eventId: demoEvent._id } : "skip",
  );
  const score = useQuery(
    api.contracts.getEventScore,
    demoEvent ? { eventId: demoEvent._id } : "skip",
  );
  const memo = useQuery(
    api.contracts.getDecisionMemo,
    demoEvent ? { eventId: demoEvent._id } : "skip",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSeedDemo() {
    setLoading(true);
    setError(null);
    try {
      await seedDemo({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "seedDemo failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schrute</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Confirmed account presence → underwriting verdict → outreach sidecar.
        </p>
      </div>

      <button
        type="button"
        onClick={handleSeedDemo}
        disabled={loading}
        className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {loading ? "Running core spine…" : "Run demo seed (SafeSite × WoC)"}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {demoEvent ? (
        <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">{demoEvent.name}</h2>
          {score ? (
            <p className="text-sm">
              <span className="font-medium">Verdict:</span> {score.recommendation}{" "}
              · {score.tier1MatchCount} Tier-1 matches ·{" "}
              {score.requiredQualifiedMeetings} meetings to break even
            </p>
          ) : null}
          {memo ? (
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {memo.headline}
            </p>
          ) : null}
          {matches && matches.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {matches.map((match) => (
                <li
                  key={match._id}
                  className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900"
                >
                  <span className="font-medium">{match.companyName}</span>{" "}
                  <span className="text-neutral-500">
                    ({match.tier}) · fit {Math.round(match.fitScore * 100)}% ·
                    conf {Math.round(match.confidence * 100)}%
                  </span>
                  {match.boothOrSession ? (
                    <span className="block text-neutral-600 dark:text-neutral-400">
                      {match.boothOrSession} — &quot;{match.evidence[0]?.quote}&quot;
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">
              No live matches yet. Run the demo seed above.
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}
