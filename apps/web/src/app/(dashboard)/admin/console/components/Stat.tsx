// app/admin/console/components/Stat.tsx
import { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  accent?: string;
  hint?: string;
}

export function Stat({ label, value, accent, hint }: StatProps) {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "20px 20px 18px",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxShadow: "0 4px 20px -2px rgba(0,0,0,0.2)",
      }}
    >
      {accent && (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: accent,
          }}
        />
      )}
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          fontFamily: "Manrope, sans-serif",
          lineHeight: 1.1,
          color: "#fff",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
