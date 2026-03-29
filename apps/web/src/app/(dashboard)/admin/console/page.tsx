"use client";

import type { CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getAdminAuditLogs,
  getAdminExtendedMetrics,
  getAdminLeads,
  getDistributionEngineSettings,
  patchDistributionEngineSettings,
  postAdminWalletCredit,
  type AuditLogRow,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

export default function AdminConsolePage() {
  const qc = useQueryClient();
  const metrics = useQuery({
    queryKey: queryKeys.admin.metrics,
    queryFn: getAdminExtendedMetrics,
  });
  const audit = useQuery({
    queryKey: queryKeys.admin.audit,
    queryFn: getAdminAuditLogs,
  });
  const engine = useQuery({
    queryKey: queryKeys.admin.engine,
    queryFn: getDistributionEngineSettings,
  });
  const leads = useQuery({
    queryKey: ["admin", "leads", 1],
    queryFn: () => getAdminLeads({ page: 1, limit: 15 }),
  });

  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("5000");
  const [desc, setDesc] = useState("Admin credit");

  const credit = useMutation({
    mutationFn: () =>
      postAdminWalletCredit({
        user_id: userId.trim(),
        amount_cents: Number(amount) || 0,
        description: desc,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metrics });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.me });
    },
  });

  const patchEngine = useMutation({
    mutationFn: (body: { queue_paused?: boolean }) =>
      patchDistributionEngineSettings(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.engine }),
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 100px", color: "#fff", fontFamily: "DM Sans, sans-serif" }}>
      <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 28, marginBottom: 8 }}>Admin console</h1>
      <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 32 }}>Metrics, inventory snapshot, wallet credits, queue controls, and audit trail.</p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, color: "#a5b4fc" }}>Extended metrics</h2>
        {metrics.isLoading && <p style={{ color: "#888" }}>Loading…</p>}
        {metrics.isError && <p style={{ color: "#f87171" }}>{(metrics.error as Error).message}</p>}
        {metrics.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 12 }}>
            <Stat label="Active subscriptions" value={String(metrics.data.activeSubscriptions)} />
            <Stat label="Distinct buyers" value={String(metrics.data.distinctBuyers)} />
            <Stat label="Total assignments" value={String(metrics.data.totalAssignments)} />
            <Stat label="Revenue (¢)" value={metrics.data.totalRevenueCents} />
            <Stat label="Wallet deposits (¢)" value={metrics.data.totalWalletDepositsCents} />
            {Object.entries(metrics.data.countByStatus).map(([k, v]) => (
              <Stat key={k} label={`Leads: ${k}`} value={String(v)} />
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, color: "#a5b4fc" }}>Distribution engine (Phase H)</h2>
        {engine.isLoading && <p style={{ color: "#888" }}>Loading…</p>}
        {engine.data && (
          <div style={{ padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
            <p style={{ marginBottom: 12, fontSize: 14 }}>
              Queue paused: <strong>{engine.data.queue_paused ? "yes" : "no"}</strong> · Max auto runs:{" "}
              {engine.data.max_auto_distribution_runs} · Cooldown: {engine.data.cooldown_minutes_between_runs}m · Markdown:{" "}
              {engine.data.markdown_percent}% after {engine.data.markdown_after_days}d
            </p>
            <button
              type="button"
              onClick={() => patchEngine.mutate({ queue_paused: !engine.data!.queue_paused })}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: engine.data.queue_paused ? "#10b981" : "#f59e0b",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {engine.data.queue_paused ? "Resume queue" : "Pause queue"}
            </button>
            {patchEngine.isError && (
              <p style={{ color: "#f87171", marginTop: 8 }}>{(patchEngine.error as Error).message}</p>
            )}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, color: "#a5b4fc" }}>Wallet credit</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            User ID (UUID)
            <input value={userId} onChange={(e) => setUserId(e.target.value)} style={inp} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Amount (cents)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} style={inp} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Description
            <input value={desc} onChange={(e) => setDesc(e.target.value)} style={inp} />
          </label>
          <button
            type="button"
            onClick={() => credit.mutate()}
            disabled={credit.isPending}
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
            Credit wallet
          </button>
        </div>
        {credit.isError && <p style={{ color: "#f87171", marginTop: 8 }}>{(credit.error as Error).message}</p>}
        {credit.isSuccess && <p style={{ color: "#6ee7b7", marginTop: 8 }}>Credit applied.</p>}
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, color: "#a5b4fc" }}>Lead inventory (first page)</h2>
        {leads.isLoading && <p style={{ color: "#888" }}>Loading…</p>}
        {leads.data && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "rgba(255,255,255,0.45)" }}>
                  <th style={th}>Title</th>
                  <th style={th}>Market</th>
                  <th style={th}>Status</th>
                  <th style={th}>Price $</th>
                </tr>
              </thead>
              <tbody>
                {leads.data.items.map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td style={td}>{l.title}</td>
                    <td style={td}>{l.market}</td>
                    <td style={td}>{l.status}</td>
                    <td style={td}>{(Number(l.price_cents) / 100).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 16, color: "#a5b4fc" }}>Audit log (recent)</h2>
        {audit.isLoading && <p style={{ color: "#888" }}>Loading…</p>}
        {audit.data && (
          <div style={{ maxHeight: 360, overflow: "auto", fontSize: 12 }}>
            {audit.data.map((row: AuditLogRow) => (
              <div
                key={row.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr",
                  gap: 8,
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.35)" }}>
                  {new Date(row.created_at).toLocaleString()}
                </span>
                <span>
                  <strong>{row.action}</strong> {row.target_type}/{row.target_id}
                  {row.actor?.email ? ` · ${row.actor.email}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.25)",
  color: "#fff",
  minWidth: 220,
};

const th: CSSProperties = { padding: "8px 10px" };
const td: CSSProperties = { padding: "10px" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "Syne, sans-serif" }}>{value}</div>
    </div>
  );
}
