import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WORKSPACES, getWorkspace } from "@/lib/demo-data";
import { TopNav } from "@/components/TopNav";
import { AnalyzeFlow } from "@/components/AnalyzeFlow";

export function generateStaticParams() {
  return WORKSPACES.map((w) => ({ workspace: w.id }));
}

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const ws = getWorkspace(workspace);
  if (!ws) notFound();

  const examples = ws.events.map((e) => ({ id: e.id, name: e.name }));

  return (
    <>
      <TopNav workspaces={WORKSPACES} currentId={ws.id} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8">
        <Link
          href={`/w/${ws.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>
        <div className="mt-10">
          <AnalyzeFlow workspaceId={ws.id} examples={examples} />
        </div>
      </main>
    </>
  );
}
