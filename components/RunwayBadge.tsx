import { BatteryLow, BatteryMedium, BatteryFull, BatteryWarning, Minus } from "lucide-react";
import { runwayLabel, runwayTone, type Runway } from "@/lib/runway";

const ICON = {
  good: BatteryFull,
  warn: BatteryMedium,
  bad: BatteryWarning,
  none: Minus,
} as const;

const CLASS = {
  good: "pill-live",
  warn: "pill-demo",
  bad: "pill-dry",
  none: "pill-cat",
} as const;

/**
 * "How long until this Mind runs out of cognition" — the resource that gates
 * everything else in the product, so it appears anywhere a Mind does.
 */
export default function RunwayBadge({ runway, title }: { runway: Runway | null; title?: string }) {
  const tone = runwayTone(runway);
  const Icon = ICON[tone] ?? BatteryLow;
  const detail =
    runway == null
      ? "runway unknown"
      : runway.status === "idle"
        ? `no cognition spent in the last ${runway.windowDays} days`
        : `${Math.round(runway.balance).toLocaleString()} cognition · burning ≈${runway.perDay}/day over ${runway.windowDays} days`;

  return (
    <span className={`pill ${CLASS[tone]}`} title={title ?? detail}>
      <Icon size={12} aria-hidden /> {runwayLabel(runway)}
    </span>
  );
}
