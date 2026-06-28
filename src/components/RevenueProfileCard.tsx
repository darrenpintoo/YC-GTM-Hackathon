import { Building2, Crosshair, MapPin, Target, Users } from "lucide-react";
import type { RevenueProfile } from "@/lib/types";
import { Card, SectionLabel } from "./ui/primitives";

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-faint">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={
        accent
          ? "rounded-md border border-[rgba(52,211,153,0.22)] bg-[var(--signal-dim)] px-2 py-1 text-xs text-signal"
          : "rounded-md border border-border bg-white/[0.02] px-2 py-1 text-xs text-muted"
      }
    >
      {children}
    </span>
  );
}

export function RevenueProfileCard({ profile }: { profile: RevenueProfile }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <SectionLabel className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5" /> Revenue Profile
        </SectionLabel>
        <span className="font-mono text-[10px] text-faint">inferred from CRM</span>
      </div>

      <div className="mt-3">
        <div className="text-lg font-semibold text-fg">{profile.company}</div>
        <div className="text-sm text-muted">{profile.tagline}</div>
      </div>

      <div className="mt-5 space-y-4">
        <Row icon={<Crosshair className="h-3.5 w-3.5" />} label="Who we win (closed-won lookalikes)">
          {profile.closedWonLookalikes.map((c) => (
            <Chip key={c} accent>
              {c}
            </Chip>
          ))}
        </Row>
        <Row icon={<Users className="h-3.5 w-3.5" />} label="Buyer personas">
          {profile.buyerPersonas.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </Row>
        <div className="grid grid-cols-2 gap-4">
          <Row icon={<Target className="h-3.5 w-3.5" />} label="Deal band">
            <Chip>{profile.dealSizeBand}</Chip>
          </Row>
          <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Geographies">
            {profile.geographies.map((g) => (
              <Chip key={g}>{g}</Chip>
            ))}
          </Row>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-white/[0.015] p-3.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          Event goal
        </div>
        <div className="mt-1 text-sm text-fg">{profile.eventGoal}</div>
      </div>
    </Card>
  );
}
