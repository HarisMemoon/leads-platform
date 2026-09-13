// app/admin/console/components/Pill.tsx
import { ReactNode } from "react";

export type Tone = "default" | "good" | "warn" | "bad" | "info";

interface PillProps {
  children: ReactNode;
  tone?: Tone;
}

export function Pill({ children, tone = "default" }: PillProps) {
  const bg: Record<Tone, string> = {
    default: "rgba(255,255,255,0.08)",
    good: "rgba(16,185,129,0.18)",
    warn: "rgba(245,158,11,0.18)",
    bad: "rgba(239,68,68,0.18)",
    info: "rgba(99,102,241,0.18)",
  };

  const fg: Record<Tone, string> = {
    default: "rgba(255,255,255,0.7)",
    good: "#6ee7b7",
    warn: "#fcd34d",
    bad: "#fca5a5",
    info: "#a5b4fc",
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        background: bg[tone],
        color: fg[tone],
        border: `1px solid ${bg[tone].replace("0.18", "0.25")}`, // Subtle matching border
      }}
    >
      {children}
    </span>
  );
}
