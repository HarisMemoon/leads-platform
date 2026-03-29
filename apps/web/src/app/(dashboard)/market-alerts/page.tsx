"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createMarketAlert,
  deleteMarketAlert,
  getMarketAlertsMe,
  patchMarketAlert,
  type MarketAlertDto,
} from "@/lib/market-alerts-api";
import { queryKeys } from "@/lib/query-keys";

const FREQ = ["instant", "every_15min", "hourly", "daily"] as const;

export default function MarketAlertsPage() {
  const qc = useQueryClient();
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: queryKeys.marketAlerts.me,
    queryFn: getMarketAlertsMe,
  });

  const [market, setMarket] = useState("");
  const [frequency, setFrequency] = useState<(typeof FREQ)[number]>("daily");

  const createM = useMutation({
    mutationFn: () =>
      createMarketAlert({
        market: market.trim() || "Any",
        frequency,
      }),
    onSuccess: () => {
      setMarket("");
      void qc.invalidateQueries({ queryKey: queryKeys.marketAlerts.me });
    },
  });

  if (isLoading) {
    return <div style={{ padding: 40, color: "#888" }}>Loading alerts…</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px", color: "#fff", fontFamily: "DM Sans, sans-serif" }}>
      <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 26, marginBottom: 8 }}>Market alerts</h1>
      <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 24, fontSize: 14 }}>
        Get notified when inventory matches markets you care about (delivery is logged in-app; email wiring can follow).
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        <input
          placeholder="Market name"
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.25)",
            color: "#fff",
          }}
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as (typeof FREQ)[number])}
          style={{ padding: "10px 12px", borderRadius: 8, background: "#1a1d26", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {FREQ.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => createM.mutate()}
          disabled={createM.isPending}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add alert
        </button>
      </div>
      {createM.isError && <p style={{ color: "#f87171", marginBottom: 16 }}>{(createM.error as Error).message}</p>}

      {alerts.map((a) => (
        <AlertRow key={a.id} alert={a} onChange={() => qc.invalidateQueries({ queryKey: queryKeys.marketAlerts.me })} />
      ))}
    </div>
  );
}

function AlertRow({ alert, onChange }: { alert: MarketAlertDto; onChange: () => void }) {
  const del = useMutation({
    mutationFn: () => deleteMarketAlert(alert.id),
    onSuccess: onChange,
  });
  const toggle = useMutation({
    mutationFn: () => patchMarketAlert(alert.id, { is_active: !alert.is_active }),
    onSuccess: onChange,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 12,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>{alert.market}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          {alert.frequency} · {alert.is_active ? "active" : "paused"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => toggle.mutate()}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#fff", cursor: "pointer" }}
        >
          {alert.is_active ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={() => del.mutate()}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.4)", background: "transparent", color: "#f87171", cursor: "pointer" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
