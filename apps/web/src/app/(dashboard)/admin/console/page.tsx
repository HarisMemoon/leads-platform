"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAdminResourceItem,
  getAdminAuditLogs,
  getAdminExtendedMetrics,
  getAdminGradingOverrides,
  getAdminGradingQueue,
  getAdminGradingStats,
  getAdminIngestionBatches,
  getAdminIngestionStats,
  getAdminIntegrationsHealth,
  getAdminLeadDuplicateGroups,
  getAdminLeads,
  getAdminMetricsBreakdown,
  getAdminRefundRequests,
  getAdminResourceItems,
  getAdminSubscriptionPlans,
  getDistributionEngineSettings,
  patchAdminRefundRequest,
  patchAdminResourceItem,
  patchAdminSubscriptionPlan,
  patchAdminUserDistributionLock,
  patchDistributionEngineSettings,
  postAdminGradingOverride,
  postAdminIngestionBatch,
  postAdminLeadMarkDuplicate,
  postAdminResourceItem,
  postAdminWalletCredit,
  type AdminRefundRequestRow,
  type AdminSubscriptionPlan,
  type AuditLogRow,
  type DistributionEngineSettingsDto,
  type IngestionRowInput,
} from "@/lib/admin-api";
import { getAuthMe } from "@/lib/auth-api";
import { queryKeys } from "@/lib/query-keys";
import { clearAccessToken } from "@/lib/token";

// ---------- Tabs ----------

type TabId =
  | "overview"
  | "inventory"
  | "ingestion"
  | "duplicates"
  | "grading"
  | "flow"
  | "distribution"
  | "pricing"
  | "wallet"
  | "subscriptions"
  | "customers"
  | "integrations"
  | "notifications"
  | "audit";

type TabDef = { id: TabId; label: string; group: string; hint: string };

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", group: "Insights", hint: "KPIs and revenue health" },
  { id: "inventory", label: "Lead inventory", group: "Inventory", hint: "Browse the live catalog" },
  { id: "ingestion", label: "Ingestion center", group: "Inventory", hint: "Uploads, vendor feeds, batches" },
  { id: "duplicates", label: "Duplicate review", group: "Quality", hint: "Resolve flagged duplicates" },
  { id: "grading", label: "AI grading review", group: "Quality", hint: "Grade overrides and exceptions" },
  { id: "flow", label: "Flow control", group: "Operations", hint: "Real-time queue health" },
  { id: "distribution", label: "Distribution engine", group: "Operations", hint: "Auto-runs and cooldowns" },
  { id: "pricing", label: "Pricing controls", group: "Operations", hint: "Markdown ladders" },
  { id: "wallet", label: "Wallet adjustments", group: "Finance", hint: "Manual credits and debits" },
  { id: "subscriptions", label: "Subscriptions", group: "Finance", hint: "Plans and active members" },
  { id: "customers", label: "Customer accounts", group: "Customers", hint: "Lock, refund, inspect" },
  { id: "integrations", label: "Integrations monitor", group: "Integrations", hint: "GHL, Stripe, webhooks" },
  { id: "notifications", label: "Email & notifications", group: "Engagement", hint: "Resources and broadcasts" },
  { id: "audit", label: "Audit log", group: "Compliance", hint: "Sensitive action history" },
];

// ---------- Shared styles ----------

const S = {
  inp: {
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(11,15,28,0.7)",
    color: "#fff",
    fontSize: 13,
    fontFamily: "DM Sans, sans-serif",
    minWidth: 0,
    width: "100%",
  } as CSSProperties,
  btnPrimary: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  } as CSSProperties,
  btnGhost: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontWeight: 500,
    cursor: "pointer",
    fontSize: 13,
  } as CSSProperties,
  btn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  } as CSSProperties,
  th: {
    padding: "10px 12px",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "rgba(255,255,255,0.45)",
    fontWeight: 500,
  } as CSSProperties,
  td: { padding: "12px", fontSize: 13, verticalAlign: "top" as const } as CSSProperties,
  card: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 20,
  } as CSSProperties,
  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  } as CSSProperties,
};

// ---------- Helper components ----------

type Tone = "default" | "good" | "warn" | "bad" | "info";

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
}) {
  return (
    <div style={{ ...S.card, padding: 18, position: "relative", overflow: "hidden" }}>
      {accent && (
        <span
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }}
        />
      )}
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Syne, sans-serif", lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function Pill({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
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
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: bg[tone],
        color: fg[tone],
      }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <h2 style={{ fontSize: 22, fontFamily: "Syne, sans-serif", margin: 0 }}>{title}</h2>
      {sub && <p style={{ color: "rgba(255,255,255,0.5)", margin: "4px 0 0", fontSize: 13 }}>{sub}</p>}
    </div>
  );
}

function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div style={{ ...S.card, textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.55)" }}>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 16, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
        {title}
      </div>
      {body && <div style={{ fontSize: 13 }}>{body}</div>}
    </div>
  );
}

function MiniBar({
  items,
  max,
}: {
  items: { label: string; value: number; color?: string }[];
  max?: number;
}) {
  const m = (max ?? items.reduce((acc, it) => Math.max(acc, it.value), 0)) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it) => {
        const pct = Math.max(2, (it.value / m) * 100);
        return (
          <div
            key={it.label}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr 70px",
              gap: 10,
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.65)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {it.label}
            </span>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: it.color ?? "linear-gradient(90deg, #6366f1, #8b5cf6)",
                  borderRadius: 999,
                }}
              />
            </div>
            <span
              style={{
                textAlign: "right",
                color: "rgba(255,255,255,0.75)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {it.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Banner({ tone, children }: { tone: Tone; children: ReactNode }) {
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
        borderRadius: 10,
        background: bg[tone],
        border: `1px solid ${border[tone]}`,
        color: "#fff",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function fmtCents(v: string | number | undefined | null): string {
  const n = Number(v ?? 0);
  return `$${(n / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusTone(s: string): Tone {
  if (s === "available" || s === "active") return "good";
  if (s === "sold" || s === "distributed" || s === "assigned") return "info";
  if (s === "duplicate" || s === "pending") return "warn";
  if (s === "rejected" || s === "refunded") return "bad";
  return "default";
}

// ---------- Refund row actions (kept inline, restyled) ----------

function RefundRowActions({ row }: { row: AdminRefundRequestRow }) {
  const qc = useQueryClient();
  const [resolution, setResolution] = useState<"wallet_credit" | "premium_credit">(() =>
    row.lead_assignment.purchase_type === "subscription_distribution" ? "premium_credit" : "wallet_credit",
  );
  const [adminNotes, setAdminNotes] = useState("");
  const resolveMut = useMutation({
    mutationFn: (status: "approved" | "rejected") =>
      patchAdminRefundRequest(row.id, {
        status,
        admin_notes: adminNotes.trim() || undefined,
        ...(status === "approved" ? { resolution } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.refundRequests });
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
      <select
        value={resolution}
        onChange={(e) => setResolution(e.target.value as "wallet_credit" | "premium_credit")}
        style={S.inp}
      >
        <option value="wallet_credit">wallet_credit</option>
        <option value="premium_credit">premium_credit</option>
      </select>
      <input
        placeholder="Admin notes (optional)"
        value={adminNotes}
        onChange={(e) => setAdminNotes(e.target.value)}
        style={S.inp}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          disabled={resolveMut.isPending}
          onClick={() => resolveMut.mutate("approved")}
          style={{ ...S.btn, background: "#10b981", padding: "6px 12px", fontSize: 12 }}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={resolveMut.isPending}
          onClick={() => resolveMut.mutate("rejected")}
          style={{ ...S.btn, background: "#64748b", padding: "6px 12px", fontSize: 12 }}
        >
          Reject
        </button>
      </div>
      {resolveMut.isError && (
        <span style={{ color: "#f87171", fontSize: 11 }}>{(resolveMut.error as Error).message}</span>
      )}
    </div>
  );
}

// ---------- Main page shell ----------

export default function AdminConsolePage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const { data: user } = useQuery({ queryKey: queryKeys.auth.me, queryFn: getAuthMe });
  const grouped = useMemo(() => {
    const out = new Map<string, TabDef[]>();
    for (const t of TABS) {
      const arr = out.get(t.group) ?? [];
      arr.push(t);
      out.set(t.group, arr);
    }
    return Array.from(out.entries());
  }, []);
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const adminName =
    user?.full_name?.trim() ||
    user?.email?.split("@")[0]?.replace(/\./g, " ") ||
    "Admin";
  const adminInitial = (user?.full_name?.trim()?.charAt(0) || user?.email?.charAt(0) || "A").toUpperCase();

  function handleLogout() {
    clearAccessToken();
    router.push("/login");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, rgba(99,102,241,0.08), transparent 60%)",
        color: "#fff",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 24px 100px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 28,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#a5b4fc",
                marginBottom: 6,
              }}
            >
              Admin Console
            </div>
            <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 30, margin: 0 }}>
              Operations control center
            </h1>
            <p style={{ color: "rgba(255,255,255,0.55)", marginTop: 6, fontSize: 14 }}>
              {active.label} · {active.hint}
            </p>
          </div>
          <Pill tone="info">Synced {new Date().toLocaleTimeString()}</Pill>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
          <aside
            style={{
              ...S.card,
              padding: 12,
              position: "sticky",
              top: 16,
              alignSelf: "start",
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(100vh - 32px)",
            }}
          >
            <div style={{ overflowY: "auto", paddingRight: 2 }}>
            {grouped.map(([group, items]) => (
              <div key={group} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.35)",
                    padding: "8px 10px 4px",
                  }}
                >
                  {group}
                </div>
                {items.map((t) => {
                  const a = t.id === tab;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: a
                          ? "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(139,92,246,0.28))"
                          : "transparent",
                        color: a ? "#fff" : "rgba(255,255,255,0.7)",
                        fontWeight: a ? 600 : 500,
                        fontSize: 13,
                        cursor: "pointer",
                        marginBottom: 2,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            ))}
            </div>

            <div
              style={{
                marginTop: "auto",
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {adminInitial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {adminName}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.38)",
                      marginTop: 2,
                    }}
                  >
                    Administrator
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.035)",
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Logout
              </button>
            </div>
          </aside>

          <main style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            {tab === "overview" && <OverviewTab />}
            {tab === "inventory" && <InventoryTab />}
            {tab === "ingestion" && <IngestionTab />}
            {tab === "duplicates" && <DuplicatesTab />}
            {tab === "grading" && <GradingTab />}
            {tab === "flow" && <FlowTab />}
            {tab === "distribution" && <DistributionTab />}
            {tab === "pricing" && <PricingTab />}
            {tab === "wallet" && <WalletTab />}
            {tab === "subscriptions" && <SubscriptionsTab />}
            {tab === "customers" && <CustomersTab />}
            {tab === "integrations" && <IntegrationsTab />}
            {tab === "notifications" && <NotificationsTab />}
            {tab === "audit" && <AuditTab />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ---------- Overview ----------

function OverviewTab() {
  const metrics = useQuery({ queryKey: queryKeys.admin.metrics, queryFn: getAdminExtendedMetrics });
  const refunds = useQuery({ queryKey: queryKeys.admin.refundRequests, queryFn: getAdminRefundRequests });
  const breakdown = useQuery({
    queryKey: queryKeys.admin.metricsBreakdown,
    queryFn: getAdminMetricsBreakdown,
  });

  const m = metrics.data;
  const b = breakdown.data;
  const counts = m?.countByStatus ?? {};
  const inventoryAvailable = Number(counts["available"] ?? 0);
  const totalLeads = Object.values(counts).reduce((a, c) => a + Number(c ?? 0), 0);
  const sold = Number(counts["sold"] ?? 0) + Number(counts["distributed"] ?? 0);

  const byStatus = Object.entries(counts).map(([k, v]) => ({ label: k, value: Number(v) }));
  const byType = (b?.soldByType ?? []).map((t) => ({
    label: t.lead_type,
    value: t.assignment_count,
    color: "linear-gradient(90deg, #ec4899, #f59e0b)" as string,
  }));

  const pendingRefunds = (refunds.data ?? []).filter((r) => r.status === "pending");
  const deliveryPct = b ? `${(b.deliverySuccessRate * 100).toFixed(1)}%` : "—";
  const contactPct = b ? `${(b.contactRate * 100).toFixed(1)}%` : "—";
  const churnPct = b ? `${(b.subscriptionChurn30d.churnRate * 100).toFixed(1)}%` : "—";

  return (
    <>
      <SectionTitle
        title="Overview"
        sub="Live KPIs across inventory, revenue, distribution, and operational health."
      />

      {metrics.isLoading && <Empty title="Loading metrics…" />}
      {metrics.isError && <Banner tone="bad">{(metrics.error as Error).message}</Banner>}

      {m && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))",
              gap: 12,
            }}
          >
            <Stat
              label="Inventory available"
              value={inventoryAvailable.toLocaleString()}
              accent="linear-gradient(90deg, #34d399, #10b981)"
              hint={`${totalLeads.toLocaleString()} total in system`}
            />
            <Stat
              label="Leads sold"
              value={sold.toLocaleString()}
              accent="linear-gradient(90deg, #6366f1, #8b5cf6)"
              hint={`${m.totalAssignments.toLocaleString()} assignments`}
            />
            <Stat
              label="Wallet deposits"
              value={fmtCents(m.totalWalletDepositsCents)}
              accent="linear-gradient(90deg, #38bdf8, #6366f1)"
              hint="Lifetime top-ups"
            />
            <Stat
              label="One-time revenue"
              value={fmtCents(m.totalRevenueCents)}
              accent="linear-gradient(90deg, #f59e0b, #ef4444)"
              hint="Marketplace + auto-distribution"
            />
            <Stat
              label="MRR estimate"
              value={b ? fmtCents(b.mrrEstimateCents) : "—"}
              accent="linear-gradient(90deg, #ec4899, #8b5cf6)"
              hint={`${m.activeSubscriptions} active subs · plan prices`}
            />
            <Stat
              label="Lead delivery success"
              value={deliveryPct}
              accent="linear-gradient(90deg, #10b981, #34d399)"
              hint="CRM-synced / total assignments"
            />
            <Stat
              label="Contact rate"
              value={contactPct}
              accent="linear-gradient(90deg, #34d399, #38bdf8)"
              hint="Twilio-touched / total assignments"
            />
            <Stat
              label="Subscription churn (30d)"
              value={churnPct}
              accent={
                b && b.subscriptionChurn30d.churnRate > 0.1
                  ? "linear-gradient(90deg,#f59e0b,#ef4444)"
                  : "linear-gradient(90deg,#64748b,#94a3b8)"
              }
              hint={
                b
                  ? `${b.subscriptionChurn30d.cancelled} cancelled / ${b.subscriptionChurn30d.activeAtPeriodStart} pool`
                  : "Awaiting data"
              }
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
            <div style={S.card}>
              <h3
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: 16,
                  marginTop: 0,
                  marginBottom: 14,
                }}
              >
                Leads by status
              </h3>
              {byStatus.length === 0 ? <Empty title="No status data yet" /> : <MiniBar items={byStatus} />}
            </div>
            <div style={S.card}>
              <h3
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: 16,
                  marginTop: 0,
                  marginBottom: 14,
                }}
              >
                Leads sold by type
              </h3>
              {breakdown.isLoading ? (
                <Empty title="Loading…" />
              ) : byType.length === 0 ? (
                <Empty title="No assignment data yet" />
              ) : (
                <MiniBar items={byType} />
              )}
            </div>
          </div>

          <div style={S.card}>
            <h3
              style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}
            >
              Top buyers by spend
            </h3>
            {breakdown.isLoading ? (
              <Empty title="Loading…" />
            ) : !b || b.topBuyers.length === 0 ? (
              <Empty title="No buyers yet" body="The leaderboard fills in once assignments are recorded." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "rgba(0,0,0,0.2)" }}>
                    <tr style={{ textAlign: "left" }}>
                      <th style={S.th}>#</th>
                      <th style={S.th}>Buyer</th>
                      <th style={S.th}>Assignments</th>
                      <th style={{ ...S.th, textAlign: "right" }}>Total spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.topBuyers.map((row, i) => (
                      <tr key={row.user_id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={S.td}>{i + 1}</td>
                        <td style={S.td}>
                          <div>{row.email}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                            {row.user_id.slice(0, 8)}…
                          </div>
                        </td>
                        <td style={S.td}>{row.assignment_count.toLocaleString()}</td>
                        <td style={{ ...S.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {fmtCents(row.total_spend_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={S.card}>
            <h3
              style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}
            >
              Pending refund requests
            </h3>
            {pendingRefunds.length === 0 ? (
              <Empty title="Inbox zero" body="No pending refund requests at the moment." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pendingRefunds.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.lead_assignment.lead.title}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                        {r.buyer.email} · {fmtCents(r.lead_assignment.amount_charged_cents)}
                      </div>
                    </div>
                    <Pill tone="warn">pending</Pill>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ---------- Inventory ----------

function InventoryTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const leads = useQuery({
    queryKey: ["admin", "leads", page],
    queryFn: () => getAdminLeads({ page, limit: 20 }),
  });
  const items = leads.data?.items ?? [];
  const filtered = statusFilter ? items.filter((l) => l.status === statusFilter) : items;
  const statuses = Array.from(new Set(items.map((l) => l.status)));

  return (
    <>
      <SectionTitle
        title="Lead inventory"
        sub="Browse the live catalog. Use filters to drill in by status."
      />

      <div
        style={{
          ...S.card,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          padding: 14,
        }}
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...S.inp, width: "auto" }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 12,
            marginLeft: "auto",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Showing {filtered.length} of {leads.data?.pagination.total ?? 0}
        </span>
        <button
          type="button"
          style={S.btnGhost}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <button type="button" style={S.btnGhost} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      {leads.isLoading && <Empty title="Loading inventory…" />}
      {leads.isError && <Banner tone="bad">{(leads.error as Error).message}</Banner>}
      {leads.data && filtered.length === 0 && <Empty title="No leads match that filter" />}

      {filtered.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,0.2)" }}>
              <tr style={{ textAlign: "left" }}>
                <th style={S.th}>Title</th>
                <th style={S.th}>Type</th>
                <th style={S.th}>Market</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Price</th>
                <th style={S.th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={S.td}>{l.title}</td>
                  <td style={S.td}>
                    <Pill>{l.lead_type}</Pill>
                  </td>
                  <td style={S.td}>{l.market}</td>
                  <td style={S.td}>
                    <Pill tone={statusTone(l.status)}>{l.status}</Pill>
                  </td>
                  <td style={S.td}>{fmtCents(l.price_cents)}</td>
                  <td style={S.td}>{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------- Ingestion ----------

function parseIngestionCsv(text: string): { rows: IngestionRowInput[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ["File is empty"] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (key: string) => header.indexOf(key);
  const required = ["market", "lead_type", "price_cents"];
  for (const r of required) {
    if (idx(r) < 0) errors.push(`Missing required column: ${r}`);
  }
  if (errors.length) return { rows: [], errors };

  const rows: IngestionRowInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const price = Number(cells[idx("price_cents")] ?? 0);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Row ${i + 1}: invalid price_cents`);
      continue;
    }
    const row: IngestionRowInput = {
      market: cells[idx("market")] ?? "",
      lead_type: cells[idx("lead_type")] ?? "",
      price_cents: Math.round(price),
    };
    if (idx("contact_email") >= 0) row.contact_email = cells[idx("contact_email")] || undefined;
    if (idx("contact_phone") >= 0) row.contact_phone = cells[idx("contact_phone")] || undefined;
    if (idx("title") >= 0) row.title = cells[idx("title")] || undefined;
    if (idx("source") >= 0) row.source = cells[idx("source")] || undefined;
    if (idx("quality_score") >= 0) {
      const qs = Number(cells[idx("quality_score")] ?? 50);
      row.quality_score = Number.isFinite(qs) ? Math.max(0, Math.min(100, qs)) : 50;
    }
    rows.push(row);
  }
  return { rows, errors };
}

function IngestionTab() {
  const qc = useQueryClient();
  const stats = useQuery({
    queryKey: queryKeys.admin.ingestionStats,
    queryFn: getAdminIngestionStats,
  });
  const batches = useQuery({
    queryKey: queryKeys.admin.ingestionBatches,
    queryFn: () => getAdminIngestionBatches(25),
  });
  const [filename, setFilename] = useState("");
  const [vendor, setVendor] = useState("");
  const [parsedRows, setParsedRows] = useState<IngestionRowInput[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const upload = useMutation({
    mutationFn: () =>
      postAdminIngestionBatch({
        filename: filename || "manual.csv",
        vendor: vendor.trim() || undefined,
        rows: parsedRows,
      }),
    onSuccess: () => {
      setParsedRows([]);
      setParseErrors([]);
      setFilename("");
      void qc.invalidateQueries({ queryKey: queryKeys.admin.ingestionBatches });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.ingestionStats });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metrics });
    },
  });

  const onPickFile = async (file: File) => {
    setFilename(file.name);
    const text = await file.text();
    const { rows, errors } = parseIngestionCsv(text);
    setParsedRows(rows);
    setParseErrors(errors);
  };

  return (
    <>
      <SectionTitle
        title="Ingestion center"
        sub="Bulk uploads, vendor feeds, and incoming batches."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Pending review"
          value={String(stats.data?.pendingReview ?? "—")}
          hint="Awaiting processing"
          accent="linear-gradient(90deg,#f59e0b,#ef4444)"
        />
        <Stat
          label="Processed last 24h"
          value={String(stats.data?.processedLast24h ?? "—")}
          hint="Successfully ingested"
          accent="linear-gradient(90deg,#10b981,#34d399)"
        />
        <Stat
          label="Failed batches"
          value={String(stats.data?.failedBatches ?? "—")}
          hint="Quarantined for retry"
          accent="linear-gradient(90deg,#ef4444,#f97316)"
        />
      </div>

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}>
          Upload a CSV batch
        </h3>
        <div
          style={{
            border: "2px dashed rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 24,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
            Drop a CSV here, or click to browse
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
            Required columns: <code>market, lead_type, price_cents</code>. Optional:{" "}
            <code>contact_email, contact_phone, title, source, quality_score</code>.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 200px auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              style={S.inp}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
            <input
              style={S.inp}
              placeholder="Vendor (optional)"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
            <button
              type="button"
              style={{ ...S.btnPrimary, opacity: parsedRows.length === 0 ? 0.5 : 1 }}
              disabled={upload.isPending || parsedRows.length === 0}
              onClick={() => upload.mutate()}
            >
              Upload {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}
            </button>
          </div>
          {parseErrors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="bad">
                {parseErrors.length} parse error{parseErrors.length > 1 ? "s" : ""}: {parseErrors.slice(0, 3).join(" · ")}
                {parseErrors.length > 3 ? "…" : ""}
              </Banner>
            </div>
          )}
          {upload.isError && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="bad">{(upload.error as Error).message}</Banner>
            </div>
          )}
          {upload.isSuccess && upload.data && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="good">
                Batch ingested · {upload.data.processed_rows} processed, {upload.data.failed_rows} failed.
              </Banner>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <h3
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: 16,
            margin: 0,
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          Recent batches
        </h3>
        {batches.isLoading && <div style={{ padding: 20, color: "rgba(255,255,255,0.5)" }}>Loading…</div>}
        {batches.data && batches.data.length === 0 && (
          <Empty title="No batches yet" body="Drop your first CSV above to begin ingestion." />
        )}
        {batches.data && batches.data.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,0.2)" }}>
              <tr style={{ textAlign: "left" }}>
                <th style={S.th}>File</th>
                <th style={S.th}>Vendor</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Rows</th>
                <th style={S.th}>Uploaded by</th>
                <th style={S.th}>When</th>
              </tr>
            </thead>
            <tbody>
              {batches.data.map((batch) => (
                <tr key={batch.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={S.td}>{batch.filename}</td>
                  <td style={S.td}>{batch.vendor ?? "—"}</td>
                  <td style={S.td}>
                    <Pill
                      tone={
                        batch.status === "processed"
                          ? "good"
                          : batch.status === "failed"
                          ? "bad"
                          : batch.status === "processing"
                          ? "info"
                          : "warn"
                      }
                    >
                      {batch.status}
                    </Pill>
                  </td>
                  <td style={S.td}>
                    <span style={{ color: "#6ee7b7" }}>{batch.processed_rows}</span>
                    {" / "}
                    <span>{batch.total_rows}</span>
                    {batch.failed_rows > 0 && (
                      <>
                        {" · "}
                        <span style={{ color: "#fca5a5" }}>{batch.failed_rows} failed</span>
                      </>
                    )}
                  </td>
                  <td style={S.td}>{batch.uploaded_by?.email ?? "—"}</td>
                  <td style={S.td}>{new Date(batch.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ---------- Duplicates ----------

function DuplicatesTab() {
  const qc = useQueryClient();
  const groups = useQuery({
    queryKey: queryKeys.admin.duplicateGroups,
    queryFn: getAdminLeadDuplicateGroups,
  });
  const breakdown = useQuery({
    queryKey: queryKeys.admin.metricsBreakdown,
    queryFn: getAdminMetricsBreakdown,
  });

  const merge = useMutation({
    mutationFn: (args: { duplicateLeadId: string; canonicalLeadId: string }) =>
      postAdminLeadMarkDuplicate(args.duplicateLeadId, args.canonicalLeadId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.duplicateGroups });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metricsBreakdown });
    },
  });

  const totalDupes = (groups.data ?? []).reduce(
    (acc, g) => acc + Math.max(0, Number(g.count) - 1),
    0,
  );

  return (
    <>
      <SectionTitle
        title="Duplicate review queue"
        sub="Triage flagged duplicates before they hit the marketplace."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Awaiting review"
          value={String(totalDupes)}
          hint={`${groups.data?.length ?? 0} phone-number clusters`}
          accent="linear-gradient(90deg,#f59e0b,#ef4444)"
        />
        <Stat
          label="Auto-merged (7d)"
          value={String(breakdown.data?.duplicateAutoMergedLast7d ?? "—")}
          hint="Marked duplicate_of_lead_id"
          accent="linear-gradient(90deg,#10b981,#34d399)"
        />
        <Stat
          label="Phone clusters"
          value={String(groups.data?.length ?? "—")}
          hint="Distinct phone numbers with ≥2 leads"
        />
      </div>

      {groups.isLoading && <Empty title="Loading clusters…" />}
      {groups.data && groups.data.length === 0 && (
        <Empty
          title="Nothing flagged"
          body="No phone numbers appear on more than one lead. The deduper will surface clusters here as they form."
        />
      )}
      {groups.data && groups.data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.data.map((g) => {
            const [canonicalId, ...rest] = g.ids;
            return (
              <div key={g.phone} style={S.card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <strong style={{ fontFamily: "Syne, sans-serif", fontSize: 15 }}>
                      {g.phone || "(blank phone)"}
                    </strong>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                      Canonical {canonicalId.slice(0, 8)}… · {rest.length} duplicate{rest.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Pill tone="warn">{g.count}× count</Pill>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rest.map((dupId) => (
                    <div
                      key={dupId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "rgba(0,0,0,0.18)",
                        borderRadius: 8,
                        fontSize: 12,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span style={{ color: "rgba(255,255,255,0.7)" }}>{dupId}</span>
                      <button
                        type="button"
                        disabled={merge.isPending}
                        onClick={() =>
                          merge.mutate({ duplicateLeadId: dupId, canonicalLeadId: canonicalId })
                        }
                        style={{ ...S.btn, background: "#b91c1c", padding: "4px 10px", fontSize: 11 }}
                      >
                        Merge into canonical
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {merge.isError && <Banner tone="bad">{(merge.error as Error).message}</Banner>}
    </>
  );
}

// ---------- AI grading ----------

function GradingTab() {
  const qc = useQueryClient();
  const [bucket, setBucket] = useState<"" | "high" | "borderline" | "below">("borderline");
  const [page, setPage] = useState(1);
  const stats = useQuery({
    queryKey: queryKeys.admin.gradingStats,
    queryFn: getAdminGradingStats,
  });
  const queue = useQuery({
    queryKey: queryKeys.admin.gradingQueue({ bucket, page, limit: 25 }),
    queryFn: () =>
      getAdminGradingQueue({
        bucket: bucket || undefined,
        page,
        limit: 25,
      }),
  });
  const overrides = useQuery({
    queryKey: queryKeys.admin.gradingOverrides,
    queryFn: () => getAdminGradingOverrides(15),
  });
  const [overrideLeadId, setOverrideLeadId] = useState("");
  const [overrideScore, setOverrideScore] = useState("60");
  const [overrideNotes, setOverrideNotes] = useState("");
  const submitOverride = useMutation({
    mutationFn: () =>
      postAdminGradingOverride({
        lead_id: overrideLeadId.trim(),
        override_score: Number(overrideScore) || 0,
        notes: overrideNotes.trim() || undefined,
      }),
    onSuccess: () => {
      setOverrideLeadId("");
      setOverrideNotes("");
      void qc.invalidateQueries({ queryKey: queryKeys.admin.gradingStats });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.gradingOverrides });
      void qc.invalidateQueries({
        queryKey: queryKeys.admin.gradingQueue({ bucket, page, limit: 25 }),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metricsBreakdown });
    },
  });

  const buckets = stats.data?.buckets;

  return (
    <>
      <SectionTitle
        title="AI grading review queue"
        sub="Inspect quality scores and override outliers."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <Stat
          label="High confidence"
          value={buckets ? String(buckets.high) : "—"}
          hint="Score ≥ 85"
          accent="linear-gradient(90deg,#10b981,#34d399)"
        />
        <Stat
          label="Borderline"
          value={buckets ? String(buckets.borderline) : "—"}
          hint="50 – 84"
          accent="linear-gradient(90deg,#f59e0b,#fcd34d)"
        />
        <Stat
          label="Below threshold"
          value={buckets ? String(buckets.below) : "—"}
          hint="< 50 · manual queue"
          accent="linear-gradient(90deg,#ef4444,#f97316)"
        />
        <Stat
          label="Manual overrides (7d)"
          value={stats.data ? String(stats.data.manualOverridesCount) : "—"}
          hint="By admin reviewers"
        />
      </div>

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 12 }}>
          Override a lead's score
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 120px 1.6fr auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={S.label}>
            Lead ID
            <input
              style={S.inp}
              value={overrideLeadId}
              onChange={(e) => setOverrideLeadId(e.target.value)}
              placeholder="UUID from the queue below"
            />
          </label>
          <label style={S.label}>
            New score
            <input style={S.inp} value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)} />
          </label>
          <label style={S.label}>
            Notes
            <input style={S.inp} value={overrideNotes} onChange={(e) => setOverrideNotes(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={submitOverride.isPending || !overrideLeadId.trim()}
            style={S.btnPrimary}
            onClick={() => submitOverride.mutate()}
          >
            Save override
          </button>
        </div>
        {submitOverride.isError && (
          <div style={{ marginTop: 10 }}>
            <Banner tone="bad">{(submitOverride.error as Error).message}</Banner>
          </div>
        )}
        {submitOverride.isSuccess && (
          <div style={{ marginTop: 10 }}>
            <Banner tone="good">
              Override saved · {submitOverride.data.original_score} → {submitOverride.data.override_score}
            </Banner>
          </div>
        )}
      </div>

      <div
        style={{
          ...S.card,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 14,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontFamily: "Syne, sans-serif", fontSize: 14 }}>Queue filter</strong>
        {(["", "high", "borderline", "below"] as const).map((b) => (
          <button
            key={b || "all"}
            type="button"
            onClick={() => {
              setBucket(b);
              setPage(1);
            }}
            style={{
              ...S.btnGhost,
              background:
                b === bucket
                  ? "linear-gradient(135deg, rgba(99,102,241,0.32), rgba(139,92,246,0.32))"
                  : "rgba(255,255,255,0.04)",
            }}
          >
            {b === "" ? "All" : b}
          </button>
        ))}
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
          {queue.data?.pagination.total ?? 0} total
        </span>
        <button
          type="button"
          style={S.btnGhost}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <button type="button" style={S.btnGhost} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      {queue.isLoading && <Empty title="Loading queue…" />}
      {queue.data && queue.data.items.length === 0 && (
        <Empty title="No leads in this bucket" />
      )}
      {queue.data && queue.data.items.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,0.2)" }}>
              <tr style={{ textAlign: "left" }}>
                <th style={S.th}>Title</th>
                <th style={S.th}>Market</th>
                <th style={S.th}>Type</th>
                <th style={S.th}>Score</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Lead ID</th>
              </tr>
            </thead>
            <tbody>
              {queue.data.items.map((l) => {
                const tone: Tone =
                  l.quality_score >= 85 ? "good" : l.quality_score >= 50 ? "warn" : "bad";
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={S.td}>{l.title}</td>
                    <td style={S.td}>{l.market}</td>
                    <td style={S.td}>
                      <Pill>{l.lead_type}</Pill>
                    </td>
                    <td style={S.td}>
                      <Pill tone={tone}>{l.quality_score}</Pill>
                    </td>
                    <td style={S.td}>
                      <Pill tone={statusTone(l.status)}>{l.status}</Pill>
                    </td>
                    <td style={S.td}>
                      <button
                        type="button"
                        onClick={() => setOverrideLeadId(l.id)}
                        style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 11 }}
                        title={l.id}
                      >
                        {l.id.slice(0, 8)}… ↑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 12 }}>
          Recent overrides
        </h3>
        {overrides.isLoading && <Empty title="Loading…" />}
        {overrides.data && overrides.data.length === 0 && (
          <Empty title="No overrides recorded yet" />
        )}
        {overrides.data && overrides.data.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {overrides.data.map((o) => (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "rgba(0,0,0,0.18)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <div>
                    <strong>{o.lead?.title ?? "(deleted lead)"}</strong>
                    {" · "}
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>
                      {o.original_score} → {o.override_score}
                    </span>
                  </div>
                  {o.notes && (
                    <div style={{ color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{o.notes}</div>
                  )}
                </div>
                <div style={{ textAlign: "right", color: "rgba(255,255,255,0.55)" }}>
                  <div>{o.reviewer?.email ?? "system"}</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>
                    {new Date(o.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Flow control ----------

function FlowTab() {
  const engine = useQuery({
    queryKey: queryKeys.admin.engine,
    queryFn: getDistributionEngineSettings,
  });
  const metrics = useQuery({ queryKey: queryKeys.admin.metrics, queryFn: getAdminExtendedMetrics });

  return (
    <>
      <SectionTitle
        title="Flow control dashboard"
        sub="Live status of the distribution pipeline."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <Stat
          label="Queue state"
          value={engine.data ? (engine.data.queue_paused ? "PAUSED" : "RUNNING") : "—"}
          accent={
            engine.data?.queue_paused
              ? "linear-gradient(90deg,#f59e0b,#ef4444)"
              : "linear-gradient(90deg,#10b981,#34d399)"
          }
        />
        <Stat label="Active subs" value={String(metrics.data?.activeSubscriptions ?? "—")} />
        <Stat label="Distinct buyers" value={String(metrics.data?.distinctBuyers ?? "—")} />
        <Stat label="Total assignments" value={String(metrics.data?.totalAssignments ?? "—")} />
      </div>

      <Banner tone="info">
        Real-time stream is provided by the distribution engine logs. Use Distribution engine controls
        to pause or resume.
      </Banner>

      {engine.data && (
        <div style={S.card}>
          <h3
            style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 12 }}
          >
            Engine snapshot
          </h3>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, fontSize: 13 }}
          >
            <Row label="Max auto runs" value={String(engine.data.max_auto_distribution_runs)} />
            <Row label="Cooldown" value={`${engine.data.cooldown_minutes_between_runs}m`} />
            <Row label="Markdown trigger" value={`${engine.data.markdown_after_days}d`} />
            <Row label="Markdown amount" value={`${engine.data.markdown_percent}%`} />
            <Row label="Last updated" value={new Date(engine.data.updated_at).toLocaleString()} />
            <Row label="Queue ID" value={engine.data.id.slice(0, 8) + "…"} />
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Distribution engine ----------

function DistributionTab() {
  const qc = useQueryClient();
  const engine = useQuery({
    queryKey: queryKeys.admin.engine,
    queryFn: getDistributionEngineSettings,
  });
  const patch = useMutation({
    mutationFn: (
      body: Partial<{
        queue_paused: boolean;
        max_auto_distribution_runs: number;
        cooldown_minutes_between_runs: number;
        markdown_after_days: number;
        markdown_percent: number;
      }>,
    ) => patchDistributionEngineSettings(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.engine }),
  });

  return (
    <>
      <SectionTitle
        title="Distribution engine controls"
        sub="Pause queue, tune throughput, and re-route flow."
      />

      {engine.isLoading && <Empty title="Loading engine settings…" />}
      {engine.data && (
        <>
          <div style={S.card}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Queue state</div>
                <div style={{ fontFamily: "Syne, sans-serif", fontSize: 24 }}>
                  {engine.data.queue_paused ? "Paused" : "Running"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => patch.mutate({ queue_paused: !engine.data!.queue_paused })}
                style={{
                  ...S.btn,
                  background: engine.data.queue_paused ? "#10b981" : "#f59e0b",
                }}
              >
                {engine.data.queue_paused ? "Resume queue" : "Pause queue"}
              </button>
            </div>
          </div>

          <div style={S.card}>
            <h3
              style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}
            >
              Tuning
            </h3>
            <EngineTuner
              engine={engine.data}
              onPatch={(b) => patch.mutate(b)}
              disabled={patch.isPending}
            />
          </div>

          {patch.isError && <Banner tone="bad">{(patch.error as Error).message}</Banner>}
          {patch.isSuccess && <Banner tone="good">Distribution engine updated.</Banner>}
        </>
      )}
    </>
  );
}

function EngineTuner({
  engine,
  onPatch,
  disabled,
}: {
  engine: DistributionEngineSettingsDto;
  onPatch: (
    b: Partial<{
      max_auto_distribution_runs: number;
      cooldown_minutes_between_runs: number;
      markdown_after_days: number;
      markdown_percent: number;
    }>,
  ) => void;
  disabled: boolean;
}) {
  const [maxRuns, setMaxRuns] = useState(String(engine.max_auto_distribution_runs));
  const [cooldown, setCooldown] = useState(String(engine.cooldown_minutes_between_runs));
  const [mdDays, setMdDays] = useState(String(engine.markdown_after_days));
  const [mdPct, setMdPct] = useState(String(engine.markdown_percent));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))",
        gap: 12,
        alignItems: "end",
      }}
    >
      <label style={S.label}>
        Max auto runs
        <input style={S.inp} value={maxRuns} onChange={(e) => setMaxRuns(e.target.value)} />
      </label>
      <label style={S.label}>
        Cooldown (min)
        <input style={S.inp} value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
      </label>
      <label style={S.label}>
        Markdown after (days)
        <input style={S.inp} value={mdDays} onChange={(e) => setMdDays(e.target.value)} />
      </label>
      <label style={S.label}>
        Markdown percent
        <input style={S.inp} value={mdPct} onChange={(e) => setMdPct(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={disabled}
        style={S.btnPrimary}
        onClick={() =>
          onPatch({
            max_auto_distribution_runs: Number(maxRuns) || engine.max_auto_distribution_runs,
            cooldown_minutes_between_runs:
              Number(cooldown) || engine.cooldown_minutes_between_runs,
            markdown_after_days: Number(mdDays) || engine.markdown_after_days,
            markdown_percent: Number(mdPct) || engine.markdown_percent,
          })
        }
      >
        Save tuning
      </button>
    </div>
  );
}

// ---------- Pricing ----------

function PricingTab() {
  const qc = useQueryClient();
  const engine = useQuery({
    queryKey: queryKeys.admin.engine,
    queryFn: getDistributionEngineSettings,
  });
  const patch = useMutation({
    mutationFn: (body: Partial<{ markdown_after_days: number; markdown_percent: number }>) =>
      patchDistributionEngineSettings(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.engine }),
  });
  const [days, setDays] = useState("14");
  const [pct, setPct] = useState("10");

  return (
    <>
      <SectionTitle
        title="Pricing controls"
        sub="Markdown ladder applied to aging inventory."
      />

      {engine.data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <Stat label="Current trigger" value={`${engine.data.markdown_after_days} days`} />
          <Stat label="Current discount" value={`${engine.data.markdown_percent}%`} />
          <Stat
            label="Last updated"
            value={new Date(engine.data.updated_at).toLocaleDateString()}
          />
        </div>
      )}

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 12 }}>
          Edit markdown rule
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={S.label}>
            Apply after (days)
            <input style={S.inp} value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <label style={S.label}>
            Discount (%)
            <input style={S.inp} value={pct} onChange={(e) => setPct(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={patch.isPending}
            style={S.btnPrimary}
            onClick={() =>
              patch.mutate({
                markdown_after_days: Number(days),
                markdown_percent: Number(pct),
              })
            }
          >
            Apply markdown
          </button>
        </div>
      </div>

      {patch.isError && <Banner tone="bad">{(patch.error as Error).message}</Banner>}
      {patch.isSuccess && <Banner tone="good">Markdown rule applied.</Banner>}
      <Banner tone="info">
        Pricing also respects per-vendor floors set on the lead record. Markdown only applies to
        leads older than the configured threshold.
      </Banner>
    </>
  );
}

// ---------- Wallet ----------

function WalletTab() {
  const qc = useQueryClient();
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
  const metrics = useQuery({ queryKey: queryKeys.admin.metrics, queryFn: getAdminExtendedMetrics });
  const breakdown = useQuery({
    queryKey: queryKeys.admin.metricsBreakdown,
    queryFn: getAdminMetricsBreakdown,
  });

  return (
    <>
      <SectionTitle
        title="Wallet adjustments"
        sub="Manual credits and debits with audit trail."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Lifetime deposits"
          value={fmtCents(metrics.data?.totalWalletDepositsCents)}
          accent="linear-gradient(90deg,#38bdf8,#6366f1)"
        />
        <Stat label="Distinct buyers" value={String(metrics.data?.distinctBuyers ?? "—")} />
        <Stat
          label="Pending refund credits"
          value={breakdown.data ? fmtCents(breakdown.data.pendingRefundCreditsCents) : "—"}
          hint="Awaiting approval"
          accent="linear-gradient(90deg,#f59e0b,#ef4444)"
        />
      </div>

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}>
          Credit a wallet
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={S.label}>
            User ID (UUID)
            <input style={S.inp} value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <label style={S.label}>
            Amount (cents)
            <input style={S.inp} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label style={S.label}>
            Description
            <input style={S.inp} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={credit.isPending || !userId.trim()}
            style={S.btnPrimary}
            onClick={() => credit.mutate()}
          >
            Apply credit
          </button>
        </div>
        {credit.isError && (
          <div style={{ marginTop: 10 }}>
            <Banner tone="bad">{(credit.error as Error).message}</Banner>
          </div>
        )}
        {credit.isSuccess && (
          <div style={{ marginTop: 10 }}>
            <Banner tone="good">Credit applied successfully.</Banner>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Subscriptions ----------

function SubscriptionsTab() {
  const metrics = useQuery({ queryKey: queryKeys.admin.metrics, queryFn: getAdminExtendedMetrics });
  const breakdown = useQuery({
    queryKey: queryKeys.admin.metricsBreakdown,
    queryFn: getAdminMetricsBreakdown,
  });
  const plans = useQuery({ queryKey: queryKeys.admin.plans, queryFn: getAdminSubscriptionPlans });

  const churnPct = breakdown.data
    ? `${(breakdown.data.subscriptionChurn30d.churnRate * 100).toFixed(1)}%`
    : "—";

  return (
    <>
      <SectionTitle
        title="Subscription management"
        sub="Plans, active members, and renewals."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Active subscriptions"
          value={String(metrics.data?.activeSubscriptions ?? "—")}
          accent="linear-gradient(90deg,#ec4899,#8b5cf6)"
        />
        <Stat
          label="MRR estimate"
          value={breakdown.data ? fmtCents(breakdown.data.mrrEstimateCents) : "—"}
          hint="Active subs × monthly price"
          accent="linear-gradient(90deg,#10b981,#34d399)"
        />
        <Stat
          label="Churn (30d)"
          value={churnPct}
          hint={
            breakdown.data
              ? `${breakdown.data.subscriptionChurn30d.cancelled} cancelled vs ${breakdown.data.subscriptionChurn30d.activeAtPeriodStart} pool`
              : "Awaiting data"
          }
        />
      </div>

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}>
          Plan catalog
        </h3>
        {plans.isLoading && <Empty title="Loading plans…" />}
        {plans.data && plans.data.length === 0 && (
          <Empty title="No plans configured" body="Run migrations to seed Basic and Pro." />
        )}
        {plans.data && plans.data.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {plans.data.map((p) => (
              <PlanEditorCard key={p.plan_type} plan={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PlanEditorCard({ plan }: { plan: AdminSubscriptionPlan }) {
  const qc = useQueryClient();
  const [priceCents, setPriceCents] = useState(String(plan.monthly_price_cents));
  const [leadLimit, setLeadLimit] = useState(
    plan.monthly_lead_limit == null ? "" : String(plan.monthly_lead_limit),
  );
  const [active, setActive] = useState(plan.is_active);
  const [tagline, setTagline] = useState(plan.tagline);
  const patch = useMutation({
    mutationFn: () =>
      patchAdminSubscriptionPlan(plan.plan_type, {
        monthly_price_cents: Number(priceCents) || 0,
        monthly_lead_limit: leadLimit.trim() ? Number(leadLimit) : null,
        is_active: active,
        tagline,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.plans });
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.plans });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metricsBreakdown });
    },
  });

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        background: "rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <strong style={{ fontFamily: "Syne, sans-serif", fontSize: 16 }}>
          {plan.name} ({plan.plan_type})
        </strong>
        <Pill tone={active ? "good" : "default"}>{active ? "active" : "inactive"}</Pill>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 10,
          alignItems: "end",
        }}
      >
        <label style={S.label}>
          Monthly price (cents)
          <input style={S.inp} value={priceCents} onChange={(e) => setPriceCents(e.target.value)} />
        </label>
        <label style={S.label}>
          Monthly lead limit
          <input
            style={S.inp}
            value={leadLimit}
            onChange={(e) => setLeadLimit(e.target.value)}
            placeholder="(blank = unlimited)"
          />
        </label>
        <label style={{ ...S.label, minWidth: 240 }}>
          Tagline
          <input style={S.inp} value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </label>
        <label style={{ ...S.label, flexDirection: "row" as const, alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <span>Active</span>
        </label>
        <button
          type="button"
          style={S.btnPrimary}
          disabled={patch.isPending}
          onClick={() => patch.mutate()}
        >
          Save plan
        </button>
      </div>
      {patch.isError && (
        <div style={{ marginTop: 10 }}>
          <Banner tone="bad">{(patch.error as Error).message}</Banner>
        </div>
      )}
      {patch.isSuccess && (
        <div style={{ marginTop: 10 }}>
          <Banner tone="good">Plan saved.</Banner>
        </div>
      )}
    </div>
  );
}

// ---------- Customer accounts ----------

function CustomersTab() {
  const refunds = useQuery({
    queryKey: queryKeys.admin.refundRequests,
    queryFn: getAdminRefundRequests,
  });
  const [userId, setUserId] = useState("");
  const distLock = useMutation({
    mutationFn: (locked: boolean) => patchAdminUserDistributionLock(userId.trim(), { locked }),
  });

  return (
    <>
      <SectionTitle
        title="Customer accounts"
        sub="Inspect, lock, refund, or impersonate accounts."
      />

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 12 }}>
          Distribution lock
        </h3>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: "0 0 12px" }}>
          Locked customers cannot change auto-distribution rules. They can still see read-only state
          and top up their wallet.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ ...S.label, minWidth: 280 }}>
            User ID (UUID)
            <input style={S.inp} value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <button
            type="button"
            style={{ ...S.btn, background: "#f59e0b", opacity: !userId.trim() ? 0.4 : 1 }}
            disabled={!userId.trim() || distLock.isPending}
            onClick={() => distLock.mutate(true)}
          >
            Lock
          </button>
          <button
            type="button"
            style={{ ...S.btn, background: "#10b981", opacity: !userId.trim() ? 0.4 : 1 }}
            disabled={!userId.trim() || distLock.isPending}
            onClick={() => distLock.mutate(false)}
          >
            Unlock
          </button>
        </div>
        {distLock.isSuccess && distLock.data && (
          <p style={{ color: "#6ee7b7", marginTop: 10, fontSize: 13 }}>
            Updated · distribution_locked: {String(distLock.data.distribution_locked)}
          </p>
        )}
        {distLock.isError && (
          <div style={{ marginTop: 10 }}>
            <Banner tone="bad">{(distLock.error as Error).message}</Banner>
          </div>
        )}
      </div>

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 12 }}>
          Refund requests
        </h3>
        {refunds.isLoading && <Empty title="Loading…" />}
        {refunds.data && refunds.data.length === 0 && <Empty title="No refund requests" />}
        {refunds.data && refunds.data.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Buyer</th>
                  <th style={S.th}>Lead</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Reason</th>
                  <th style={S.th}>Created</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {refunds.data.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", verticalAlign: "top" }}
                  >
                    <td style={S.td}>
                      <Pill
                        tone={
                          r.status === "pending"
                            ? "warn"
                            : r.status === "approved"
                            ? "good"
                            : "default"
                        }
                      >
                        {r.status}
                      </Pill>
                    </td>
                    <td style={S.td}>{r.buyer.email}</td>
                    <td style={S.td}>
                      {r.lead_assignment.lead.title}
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                        {fmtCents(r.lead_assignment.amount_charged_cents)}
                      </div>
                    </td>
                    <td style={S.td}>{r.lead_assignment.purchase_type}</td>
                    <td style={{ ...S.td, maxWidth: 200, whiteSpace: "pre-wrap" }}>{r.reason}</td>
                    <td style={S.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={S.td}>
                      {r.status === "pending" ? (
                        <RefundRowActions row={r} />
                      ) : (
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                          {r.resolution ?? "—"}
                          {r.admin_notes ? ` · ${r.admin_notes}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Integrations monitor ----------

function IntegrationsTab() {
  const qc = useQueryClient();
  const health = useQuery({
    queryKey: queryKeys.admin.integrationsHealth,
    queryFn: getAdminIntegrationsHealth,
  });

  return (
    <>
      <SectionTitle
        title="Integrations monitor"
        sub="Live probes of Stripe, Postmark, Twilio, GoHighLevel, and S3."
      />

      <div
        style={{
          ...S.card,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 14,
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          Probes are cached for 60 seconds. Use refresh to bust the cache early.
        </div>
        <button
          type="button"
          style={S.btnGhost}
          onClick={() =>
            void qc.invalidateQueries({ queryKey: queryKeys.admin.integrationsHealth })
          }
        >
          Refresh now
        </button>
      </div>

      {health.isLoading && <Empty title="Probing integrations…" />}
      {health.isError && <Banner tone="bad">{(health.error as Error).message}</Banner>}
      {health.data && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: 12,
          }}
        >
          {health.data.map((it) => {
            const tone: Tone =
              it.status === "ok"
                ? "good"
                : it.status === "warn"
                ? "warn"
                : it.status === "down"
                ? "bad"
                : "default";
            const label =
              it.status === "ok"
                ? "online"
                : it.status === "warn"
                ? "warning"
                : it.status === "down"
                ? "down"
                : "unconfigured";
            return (
              <div key={it.name} style={S.card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ fontFamily: "Syne, sans-serif", fontSize: 15 }}>{it.name}</strong>
                  <Pill tone={tone}>{label}</Pill>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{it.note}</div>
                <div
                  style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}
                >
                  Probed {new Date(it.last_checked_at).toLocaleTimeString()}
                  {it.latency_ms != null ? ` · ${it.latency_ms}ms` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------- Notifications & resources ----------

function NotificationsTab() {
  const qc = useQueryClient();
  const items = useQuery({
    queryKey: queryKeys.admin.resourceItems,
    queryFn: getAdminResourceItems,
  });
  const [kind, setKind] = useState("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [sort, setSort] = useState("0");

  const create = useMutation({
    mutationFn: () =>
      postAdminResourceItem({
        kind,
        title: title.trim(),
        url: url.trim() || null,
        body: body.trim() || null,
        sort_order: Number(sort) || 0,
        is_published: true,
      }),
    onSuccess: () => {
      setTitle("");
      setUrl("");
      setBody("");
      setSort("0");
      void qc.invalidateQueries({ queryKey: queryKeys.admin.resourceItems });
      void qc.invalidateQueries({ queryKey: queryKeys.resources.items });
    },
  });
  const patch = useMutation({
    mutationFn: (args: { id: string; body: { is_published?: boolean } }) =>
      patchAdminResourceItem(args.id, args.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.resourceItems });
      void qc.invalidateQueries({ queryKey: queryKeys.resources.items });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteAdminResourceItem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.resourceItems });
      void qc.invalidateQueries({ queryKey: queryKeys.resources.items });
    },
  });

  const list = items.data ?? [];
  const lastUpdated = list[0] ? new Date(list[0].updated_at).toLocaleDateString() : "—";

  return (
    <>
      <SectionTitle
        title="Email & notifications"
        sub="Customer-facing resources, banners, and broadcast notifications."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Published items"
          value={String(list.filter((i) => i.is_published).length)}
          accent="linear-gradient(90deg,#10b981,#34d399)"
        />
        <Stat
          label="Drafts"
          value={String(list.filter((i) => !i.is_published).length)}
          accent="linear-gradient(90deg,#64748b,#94a3b8)"
        />
        <Stat label="Last updated" value={lastUpdated} />
      </div>

      <div style={S.card}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}>
          Add resource / announcement
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={S.label}>
            Kind
            <select style={S.inp} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="link">link</option>
              <option value="video">video</option>
              <option value="faq">faq</option>
              <option value="promo">promo</option>
            </select>
          </label>
          <label style={S.label}>
            Title
            <input style={S.inp} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label style={S.label}>
            URL
            <input
              style={S.inp}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label style={S.label}>
            Sort
            <input style={S.inp} value={sort} onChange={(e) => setSort(e.target.value)} />
          </label>
          <label style={S.label}>
            Body
            <input style={S.inp} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={create.isPending || !title.trim()}
            style={S.btnPrimary}
            onClick={() => create.mutate()}
          >
            Publish
          </button>
        </div>
        {create.isError && (
          <div style={{ marginTop: 10 }}>
            <Banner tone="bad">{(create.error as Error).message}</Banner>
          </div>
        )}
      </div>

      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        {items.isLoading && (
          <div style={{ padding: 20, color: "rgba(255,255,255,0.5)" }}>Loading…</div>
        )}
        {items.data && items.data.length === 0 && (
          <div style={{ padding: 24, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
            No resources yet.
          </div>
        )}
        {items.data && items.data.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,0.2)" }}>
              <tr style={{ textAlign: "left" }}>
                <th style={S.th}>Kind</th>
                <th style={S.th}>Title</th>
                <th style={S.th}>Published</th>
                <th style={S.th}>Sort</th>
                <th style={S.th} />
              </tr>
            </thead>
            <tbody>
              {items.data.map((it) => (
                <tr key={it.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={S.td}>
                    <Pill>{it.kind}</Pill>
                  </td>
                  <td style={S.td}>
                    <div>{it.title}</div>
                    {it.url && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                        {it.url}
                      </div>
                    )}
                  </td>
                  <td style={S.td}>
                    <button
                      type="button"
                      disabled={patch.isPending}
                      onClick={() =>
                        patch.mutate({
                          id: it.id,
                          body: { is_published: !it.is_published },
                        })
                      }
                      style={{
                        ...S.btn,
                        background: it.is_published ? "#10b981" : "#475569",
                        padding: "6px 12px",
                        fontSize: 12,
                      }}
                    >
                      {it.is_published ? "On" : "Off"}
                    </button>
                  </td>
                  <td style={S.td}>{it.sort_order}</td>
                  <td style={S.td}>
                    <button
                      type="button"
                      disabled={del.isPending}
                      onClick={() => {
                        if (typeof window !== "undefined" && !window.confirm("Delete this resource row?"))
                          return;
                        del.mutate(it.id);
                      }}
                      style={{
                        ...S.btn,
                        background: "#b91c1c",
                        padding: "6px 12px",
                        fontSize: 12,
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ---------- Audit log ----------

function AuditTab() {
  const audit = useQuery({ queryKey: queryKeys.admin.audit, queryFn: getAdminAuditLogs });
  const [filter, setFilter] = useState("");
  const filtered = (audit.data ?? []).filter((r: AuditLogRow) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      r.action.toLowerCase().includes(f) ||
      r.target_type.toLowerCase().includes(f) ||
      (r.actor?.email ?? "").toLowerCase().includes(f)
    );
  });

  return (
    <>
      <SectionTitle
        title="Audit log"
        sub="Sensitive admin actions, sortable by actor and target."
      />

      <div
        style={{
          ...S.card,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          padding: 14,
        }}
      >
        <input
          placeholder="Filter by action, actor, or target…"
          style={{ ...S.inp, flex: 1, minWidth: 240 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{filtered.length} entries</span>
      </div>

      {audit.isLoading && <Empty title="Loading…" />}
      {audit.data && filtered.length === 0 && <Empty title="No matching entries" />}

      {filtered.length > 0 && (
        <div style={{ ...S.card, padding: 0, maxHeight: 600, overflow: "auto" }}>
          {filtered.map((row) => (
            <div
              key={row.id}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "grid",
                gridTemplateColumns: "170px 1fr",
                gap: 12,
                fontSize: 12,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.4)" }}>
                {new Date(row.created_at).toLocaleString()}
              </span>
              <span>
                <strong style={{ color: "#a5b4fc" }}>{row.action}</strong> · {row.target_type}/
                {row.target_id}
                {row.actor?.email ? ` · ${row.actor.email}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
