"use client";

import * as React from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Link2,
  Loader2,
  Mail,
  Phone,
  Plus,
  Quote,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { TierBadge } from "@/components/schrute/atoms";
import { useDataMode } from "@/lib/data/DataModeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABEL, VERIFICATION_META } from "@/lib/labels";
import type { AccountMatch, Contact, OutreachDraft } from "@/lib/types";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type AccountDrawerProps = {
  match: AccountMatch | null;
  contacts: Contact[];
  outreachDrafts: OutreachDraft[];
  eventName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToWorklist?: (match: AccountMatch) => void;
};

export function AccountDrawer({
  match,
  contacts,
  outreachDrafts,
  eventName,
  open,
  onOpenChange,
  onAddToWorklist,
}: AccountDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto p-0">
        {match ? (
          <DrawerBody
            // Remount per account so live-enrich state resets cleanly.
            key={match._id}
            match={match}
            eventName={eventName}
            contacts={contacts.filter((c) => c.accountMatchId === match._id)}
            drafts={outreachDrafts.filter(
              (d) => d.accountMatchId === match._id,
            )}
            onAddToWorklist={onAddToWorklist}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

const ENRICH_TITLES = [
  "VP Safety",
  "Director of EHS",
  "Safety Manager",
  "VP Operations",
];
const ENRICH_FIRST = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey"];
const ENRICH_LAST = ["Rivera", "Nguyen", "Patel", "Brooks", "Okafor", "Lopez"];

function hashIndex(seed: string, mod: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % mod;
}

function synthesizeEnrichment(
  match: AccountMatch,
  eventName?: string,
): { contact: Contact; draft: OutreachDraft } {
  const first = ENRICH_FIRST[hashIndex(match.companyName, ENRICH_FIRST.length)]!;
  const last = ENRICH_LAST[hashIndex(match._id, ENRICH_LAST.length)]!;
  const title = ENRICH_TITLES[hashIndex(match.companyName + "t", ENRICH_TITLES.length)]!;
  const domain = match.domain;
  const email = domain
    ? `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`
    : undefined;
  const where = eventName ?? "the show";
  const booth = match.boothOrSession ? ` (${match.boothOrSession})` : "";

  return {
    contact: {
      _id: `enriched_contact_${match._id}`,
      accountMatchId: match._id,
      eventId: match.eventId,
      fullName: `${first} ${last}`,
      title,
      email,
      verification: "likely",
      createdAt: Date.now(),
    },
    draft: {
      _id: `enriched_outreach_${match._id}`,
      accountMatchId: match._id,
      contactId: `enriched_contact_${match._id}`,
      eventId: match.eventId,
      subject: `Meet at ${where}?`,
      body: `Hi ${first} — saw ${match.companyName} is on the floor at ${where}${booth}. We help GCs like yours cut subcontractor-compliance overhead and I'd value 15 minutes while we're both there. Open to a quick coffee?`,
      tone: "direct",
      createdAt: Date.now(),
    },
  };
}

function DrawerBody({
  match,
  contacts,
  drafts,
  eventName,
  onAddToWorklist,
}: {
  match: AccountMatch;
  contacts: Contact[];
  drafts: OutreachDraft[];
  eventName?: string;
  onAddToWorklist?: (match: AccountMatch) => void;
}) {
  const { mode } = useDataMode();
  const [enriching, setEnriching] = React.useState(false);
  const [enrichedContacts, setEnrichedContacts] = React.useState<Contact[]>([]);
  const [enrichedDrafts, setEnrichedDrafts] = React.useState<OutreachDraft[]>(
    [],
  );

  const sourceContact: Contact | null =
    contacts.length === 0 && match.contactName
      ? ({
          _id: `source_${match._id}` as Contact["_id"],
          accountMatchId: match._id,
          eventId: match.eventId,
          fullName: match.contactName,
          title: match.contactTitle ?? "Decision maker",
          verification: "likely" as const,
          createdAt: Date.now(),
        } satisfies Contact)
      : null;

  const allContacts = [
    ...contacts,
    ...(sourceContact ? [sourceContact] : []),
    ...enrichedContacts,
  ];
  const allDrafts = [...drafts, ...enrichedDrafts];

  function findDecisionMakers() {
    if (mode !== "mock") return;
    setEnriching(true);
    setTimeout(() => {
      const { contact, draft } = synthesizeEnrichment(match, eventName);
      setEnrichedContacts([contact]);
      setEnrichedDrafts([draft]);
      setEnriching(false);
      toast.success(`Found a likely contact at ${match.companyName}`);
    }, 1200);
  }

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <TierBadge tier={match.tier} />
          <Badge variant="outline" className="capitalize">
            {ROLE_LABEL[match.role]}
            {match.boothOrSession ? ` · ${match.boothOrSession}` : ""}
          </Badge>
        </div>
        <SheetTitle className="text-xl">{match.companyName}</SheetTitle>
        <SheetDescription>
          {match.domain ?? "Confirmed company presence — not a personal-attendance claim."}
        </SheetDescription>

        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <MiniStat label="Fit" value={formatPercent(match.fitScore)} />
          <MiniStat label="Confidence" value={formatPercent(match.confidence)} />
          {match.matchedOppValue ? (
            <MiniStat
              label="Open pipeline"
              value={formatCurrency(match.matchedOppValue, { compact: true })}
              accent
            />
          ) : null}
        </div>
      </SheetHeader>

      <div className="space-y-6 px-6">
        <Section title="Evidence" icon={<Quote className="size-4" />}>
          <ul className="space-y-2">
            {match.evidence.map((ev, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-background/40 p-3"
              >
                <p className="text-sm">&ldquo;{ev.quote}&rdquo;</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="capitalize">
                    {ev.factType} · conf {Math.round(ev.confidence * 100)}%
                  </span>
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    View source
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Separator />

        <Section title="Decision-makers" icon={<Building2 className="size-4" />}>
          {allContacts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-center">
              <p className="text-sm text-muted-foreground">
                {mode === "live"
                  ? "Decision-maker enrichment runs with the pipeline — check back when the enrich step completes."
                  : "No contact yet — pull a likely decision-maker from demo enrichment."}
              </p>
              {mode === "mock" ? (
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={enriching}
                  onClick={findDecisionMakers}
                >
                  {enriching ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enriching…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Find decision-makers
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-3">
              {allContacts.map((c) => (
                <li
                  key={c._id}
                  className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
                >
                  <ContactRow contact={c} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Separator />

        <Section title="Outreach drafts" icon={<Mail className="size-4" />}>
          {allDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No drafts yet. Outreach is generated once a contact is enriched.
            </p>
          ) : (
            <div className="space-y-4">
              {allDrafts.map((d) => (
                <OutreachEditor key={d._id} draft={d} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <SheetFooter>
        <Button
          onClick={() => {
            onAddToWorklist?.(match);
            toast.success(`${match.companyName} added to worklist`);
          }}
        >
          <Plus className="size-4" />
          Add to worklist
        </Button>
      </SheetFooter>
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span className="rounded-md border border-border bg-background/40 px-2 py-1">
      <span className="text-muted-foreground">{label} </span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          accent ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  const meta = VERIFICATION_META[contact.verification];
  const verTone =
    meta.tone === "success"
      ? "bg-success/15 text-success border-success/30"
      : meta.tone === "warning"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-muted text-muted-foreground border-border";

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{contact.fullName}</p>
          <p className="text-xs text-muted-foreground">{contact.title}</p>
        </div>
        <Badge variant="outline" className={cn("gap-1", verTone)}>
          <BadgeCheck className="size-3" />
          {meta.label}
        </Badge>
      </div>
      <div className="mt-2 space-y-1">
        {contact.email ? (
          <CopyLine icon={<Mail className="size-3.5" />} value={contact.email} />
        ) : null}
        {contact.phone ? (
          <CopyLine
            icon={<Phone className="size-3.5" />}
            value={contact.phone}
          />
        ) : null}
        {contact.linkedinUrl ? (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link2 className="size-3.5" />
            LinkedIn profile
          </a>
        ) : null}
      </div>
    </div>
  );
}

function CopyLine({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      {icon}
      <span className="font-mono">{value}</span>
      {copied ? (
        <Check className="size-3 text-success" />
      ) : (
        <Copy className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

function OutreachEditor({ draft }: { draft: OutreachDraft }) {
  const [subject, setSubject] = React.useState(draft.subject);
  const [body, setBody] = React.useState(draft.body);

  async function copyAll() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.success("Draft copied");
  }

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        {draft.tone ? (
          <Badge variant="secondary" className="capitalize">
            {draft.tone}
          </Badge>
        ) : (
          <span />
        )}
        <Button size="sm" variant="ghost" onClick={copyAll}>
          <Copy className="size-3.5" />
          Copy
        </Button>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="mb-2 w-full rounded-md border border-input bg-background/60 px-2 py-1 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-32 text-sm"
      />
    </div>
  );
}
