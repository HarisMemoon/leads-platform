// app/admin/console/components/Banner.tsx
import { ReactNode } from "react";
import { Tone } from "./Pill";

interface BannerProps {
  tone: Tone;
  children: ReactNode;
}

export function Banner({ tone, children }: BannerProps) {
  const bg: Record<Tone, string> = {
    default: "rgba(255,255,255,0.04)",
    info: "rgba(99,102,241,0.12)",
    warn: "rgba(245,158,11,0.12)",
    good: "rgba(16,185,129,0.12)",
    bad: "rgba(239,68,68,0.12)",
  };

  const border: Record<Tone, string> = {
    default: "rgba(255,255,255,0.1)",
    info: "rgba(99,102,241,0.3)",
    warn: "rgba(245,158,11,0.3)",
    good: "rgba(16,185,129,0.3)",
    bad: "rgba(239,68,68,0.3)",
  };

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: bg[tone],
        border: `1px solid ${border[tone]}`,
        color: "#fff",
        fontSize: 13,
        lineHeight: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}
