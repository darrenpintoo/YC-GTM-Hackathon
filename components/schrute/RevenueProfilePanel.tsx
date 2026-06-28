"use client";

import { Briefcase, Factory, Globe, Target, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrmAccount, RevenueProfile } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type RevenueProfilePanelProps = {
  profile: RevenueProfile;
  accounts: CrmAccount[];
};

export function RevenueProfilePanel({
  profile,
  accounts,
}: RevenueProfilePanelProps) {
  const openOpps = accounts.filter((a) => a.accountType === "open_opp");
  const pipeline = openOpps.reduce(
    (sum, a) => sum + (a.openOppValue ?? 0),
    0,
  );

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4 text-primary" />
          Revenue Profile · {profile.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          The lens every event is matched against — learned from your CRM.
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-border bg-background/40 px-2 py-1">
            <span className="font-semibold">{accounts.length}</span>{" "}
            <span className="text-muted-foreground">accounts</span>
          </span>
          <span className="rounded-md border border-border bg-background/40 px-2 py-1">
            <span className="font-semibold">{openOpps.length}</span>{" "}
            <span className="text-muted-foreground">open opps</span>
          </span>
          {pipeline > 0 ? (
            <span className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-success">
              <span className="font-semibold">
                {formatCurrency(pipeline, { compact: true })}
              </span>{" "}
              open pipeline
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ChipRow
          icon={<Factory className="size-3.5" />}
          label="Industries"
          items={profile.industries}
        />
        <ChipRow
          icon={<Users className="size-3.5" />}
          label="Buyer titles"
          items={profile.buyerTitles}
        />
        <ChipRow
          icon={<Globe className="size-3.5" />}
          label="Geographies"
          items={profile.geographies}
        />

        {profile.dealSizeClusters.length > 0 ? (
          <div>
            <Label icon={<Briefcase className="size-3.5" />}>
              Deal-size clusters
            </Label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {profile.dealSizeClusters.map((c) => (
                <div
                  key={c.label}
                  className="rounded-lg border border-border bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.count} deals
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(c.min, { compact: true })} –{" "}
                    {formatCurrency(c.max, { compact: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Label({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

function ChipRow({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <Label icon={icon}>{label}</Label>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
