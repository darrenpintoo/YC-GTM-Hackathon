"use client";

import * as React from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Link2,
  Mail,
  Phone,
  Plus,
  Quote,
} from "lucide-react";
import { toast } from "sonner";

import { TierBadge } from "@/components/schrute/atoms";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToWorklist?: (match: AccountMatch) => void;
};

export function AccountDrawer({
  match,
  contacts,
  outreachDrafts,
  open,
  onOpenChange,
  onAddToWorklist,
}: AccountDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto p-0">
        {match ? (
          <DrawerBody
            match={match}
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

function DrawerBody({
  match,
  contacts,
  drafts,
  onAddToWorklist,
}: {
  match: AccountMatch;
  contacts: Contact[];
  drafts: OutreachDraft[];
  onAddToWorklist?: (match: AccountMatch) => void;
}) {
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
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Enrichment pending — contacts arrive from the Fiber sidecar.
            </p>
          ) : (
            <ul className="space-y-3">
              {contacts.map((c) => (
                <ContactRow key={c._id} contact={c} />
              ))}
            </ul>
          )}
        </Section>

        <Separator />

        <Section title="Outreach drafts" icon={<Mail className="size-4" />}>
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No drafts yet. Outreach is generated once a contact is enriched.
            </p>
          ) : (
            <div className="space-y-4">
              {drafts.map((d) => (
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
    <li className="rounded-lg border border-border bg-background/40 p-3">
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
    </li>
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
