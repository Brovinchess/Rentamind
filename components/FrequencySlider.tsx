"use client";

import { useState } from "react";

/** Study cadence slider (Jarvis-style) with live burn/points estimates. */
const STOPS = [1, 2, 3, 6, 12, 24];
/** Fallback only — used until we've measured what a cycle actually costs. */
const EST_COGNITION_PER_CYCLE = 25;

export function estimate(hours: number, costPerCycle = EST_COGNITION_PER_CYCLE) {
  const cyclesPerDay = 24 / hours;
  return {
    cyclesPerDay: Math.round(cyclesPerDay * 10) / 10,
    burnPerDay: Math.round(cyclesPerDay * costPerCycle),
    pointsPerDay: Math.round(cyclesPerDay * 5),
  };
}

/**
 * What one study cycle really costs this Mind, from its measured daily burn at
 * its current cadence. Falls back to the generic estimate when we have no
 * measurement yet (a brand-new plan, or a Mind that hasn't spent anything).
 */
export function measureCostPerCycle(perDay: number | null | undefined, currentHours: number): number {
  if (!perDay || perDay <= 0 || !currentHours) return EST_COGNITION_PER_CYCLE;
  const cyclesPerDay = 24 / currentHours;
  const cost = perDay / cyclesPerDay;
  // Guard against nonsense from a Mind whose burn is dominated by rentals.
  return cost > 0.5 && cost < 5000 ? cost : EST_COGNITION_PER_CYCLE;
}

export default function FrequencySlider({
  value,
  onChange,
  onCommit,
  disabled,
  compact = false,
  balance,
  costPerCycle,
}: {
  value: number;
  onChange: (hours: number) => void;
  onCommit?: (hours: number) => void;
  disabled?: boolean;
  compact?: boolean;
  /** Mind's live cognition balance — turns the estimate into "days left". */
  balance?: number | null;
  /** Measured cost of one study cycle; falls back to a generic estimate. */
  costPerCycle?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const idx = STOPS.indexOf(value) >= 0 ? STOPS.indexOf(value) : 3;
  const est = estimate(STOPS[idx] ?? 6, costPerCycle);
  // Runway at this cadence, same idea as the Core API's /runway endpoint:
  // balance ÷ daily burn. Studying is usually a Mind's main expense.
  const days =
    balance != null && balance > 0 && est.burnPerDay > 0
      ? Math.round((balance / est.burnPerDay) * 10) / 10
      : null;

  return (
    <div style={{ display: "grid", gap: 4, width: "100%", maxWidth: compact ? 340 : 480 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="mono" style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
          Studies every <b style={{ color: "var(--brand)" }}>{value}h</b>
        </span>
        <span className="mono" style={{ fontSize: "0.68rem", color: dragging ? "var(--accent-deep)" : "var(--muted)" }}>
          {est.cyclesPerDay}×/day · ≈{est.burnPerDay} cognition · +{est.pointsPerDay} pts/day
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={STOPS.length - 1}
        step={1}
        value={idx}
        disabled={disabled}
        onChange={(e) => onChange(STOPS[Number(e.target.value)])}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => {
          setDragging(false);
          onCommit?.(value);
        }}
        onKeyUp={() => onCommit?.(value)}
        style={{ width: "100%", accentColor: "var(--brand)" }}
        aria-label="Study frequency"
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {STOPS.map((s) => (
          <span key={s} className="mono" style={{ fontSize: "0.62rem", color: s === value ? "var(--brand)" : "var(--muted)" }}>
            {s}h
          </span>
        ))}
      </div>
      {days != null ? (
        <span
          className="mono"
          style={{
            fontSize: "0.68rem",
            color: days < 3 ? "var(--danger)" : days < 10 ? "var(--warn)" : "var(--muted)",
          }}
        >
          {days < 1 ? "under a day" : `≈${days < 10 ? days : Math.round(days)} days`} of cognition left at this
          cadence
          {days < 3 ? " — it will go quiet soon" : ""}
        </span>
      ) : null}
    </div>
  );
}
