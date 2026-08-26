"use client";

import { useState } from "react";

/** Study cadence slider (Jarvis-style) with live burn/points estimates. */
const STOPS = [1, 2, 3, 6, 12, 24];
const EST_COGNITION_PER_CYCLE = 25; // observed ballpark: research + in-character reply

export function estimate(hours: number) {
  const cyclesPerDay = 24 / hours;
  return {
    cyclesPerDay: Math.round(cyclesPerDay * 10) / 10,
    burnPerDay: Math.round(cyclesPerDay * EST_COGNITION_PER_CYCLE),
    pointsPerDay: Math.round(cyclesPerDay * 5),
  };
}

export default function FrequencySlider({
  value,
  onChange,
  onCommit,
  disabled,
  compact = false,
}: {
  value: number;
  onChange: (hours: number) => void;
  onCommit?: (hours: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const idx = STOPS.indexOf(value) >= 0 ? STOPS.indexOf(value) : 3;
  const est = estimate(STOPS[idx] ?? 6);

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
    </div>
  );
}
