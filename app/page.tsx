export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold tracking-tight">Schrute</h1>
      <p className="max-w-xl text-center text-neutral-600 dark:text-neutral-400">
        Connect your CRM to public event evidence. See which target accounts have
        confirmed presence, score the sponsor / attend / skip decision, and turn
        matches into pre-event outreach targets.
      </p>
      <p className="text-sm text-neutral-500">
        Schema + types + mocks are in place. Wire the UI against{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
          lib/mocks.ts
        </code>
        .
      </p>
    </main>
  );
}
