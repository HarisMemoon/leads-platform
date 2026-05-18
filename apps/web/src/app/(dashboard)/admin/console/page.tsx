"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAdminLead,
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
  getAdminMetricsIntake,
  getAdminPings,
  getAdminRefundRequests,
  getAdminResourceItems,
  getAdminSubscriptionPlans,
  getAdminVendors,
  getAdminVendorWebhookHits,
  getAdminVendorPayoutStats,
  getAdminOutboundBuyers,
  getAdminOutboundPingLogs,
  postAdminOutboundBuyer,
  patchAdminOutboundBuyer,
  deleteAdminOutboundBuyer,
  postAdminOutboundBuyerTestPing,
  postAdminTriggerOutboundPing,
  getDistributionEngineSettings,
  lookupAdminUserByEmail,
  getAdminUsers,
  patchAdminUserActive,
  type AdminUserRow,
  patchAdminLead,
  patchAdminRefundRequest,
  patchAdminResourceItem,
  patchAdminSubscriptionPlan,
  patchAdminVendor,
  patchAdminUserDistributionLock,
  patchDistributionEngineSettings,
  postAdminVendor,
  postAdminGradingOverride,
  postAdminIngestionBatch,
  postAdminLeadDiscount,
  postAdminLeadBoost,
  postAdminLeadMarkDuplicate,
  postAdminResourceItem,
  postAdminWalletCredit,
  type AdminLeadRow,
  type AdminPlanFeatureBullet,
  type AdminPingRow,
  type AdminRefundRequestRow,
  type AdminSubscriptionPlan,
  type VendorIntegrationDto,
  type AuditLogRow,
  type DistributionEngineSettingsDto,
  type IngestionRowInput,
  type OutboundBuyerEndpointDto,
  type OutboundPingLogRow,
  type AdminLeadDuplicateGroup,
  type AdminResolvedDuplicateGroup,
  getAdminResolvedDuplicateGroups,
  getAdminPendingLeads,
  patchAdminApproveLead,
  patchAdminRejectLead,
  postAdminBulkApproveLeads,
  postAdminBulkRejectLeads,
  type PendingLeadGroup,
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
  | "distribution"
  | "pings"
  | "pricing"
  | "wallet"
  | "subscriptions"
  | "customers"
  | "integrations"
  | "notifications"
  | "audit";

type TabDef = { id: TabId; label: string; group: string; hint: string };

const TABS: TabDef[] = [
  { id: "overview", label: "Dashboard", group: "Overview", hint: "Revenue, leads, and health at a glance" },
  { id: "inventory", label: "Leads", group: "Leads", hint: "Browse, edit, and delete leads" },
  { id: "ingestion", label: "Add Leads", group: "Leads", hint: "Upload CSVs or connect vendor feeds" },
  { id: "duplicates", label: "Duplicates", group: "Leads", hint: "Review leads with duplicate phone numbers" },
  { id: "grading", label: "Lead Quality", group: "Leads", hint: "Review and override lead quality scores" },
  { id: "distribution", label: "Auto-Distribution", group: "Operations", hint: "Control the engine that routes leads to buyers" },
  { id: "pings", label: "Lead Vendors", group: "Operations", hint: "Manage vendor connections and routing" },
  { id: "pricing", label: "Pricing", group: "Operations", hint: "Automatic markdowns and Pro early access" },
  { id: "wallet", label: "Customer Wallets", group: "Finance", hint: "Add credits to any customer account" },
  { id: "subscriptions", label: "Subscriptions", group: "Finance", hint: "Pro plan health and settings" },
  { id: "customers", label: "Customers", group: "People", hint: "Manage accounts and handle refunds" },
  { id: "integrations", label: "System Health", group: "System", hint: "Check Stripe, GHL, and other connections" },
  { id: "notifications", label: "Resources", group: "System", hint: "Manage buyer-facing resources and links" },
  { id: "audit", label: "Audit Log", group: "System", hint: "Record of all sensitive admin actions" },
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
    fontFamily: "Inter, sans-serif",
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
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  // hint kept for call-site compatibility but intentionally not rendered
  hint?: string;
}) {
  return (
    <div style={{ ...S.card, padding: "20px 20px 18px", position: "relative", overflow: "hidden" }}>
      {accent && (
        <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      )}
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "Manrope, sans-serif", lineHeight: 1.1 }}>
        {value}
      </div>
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
      <h2 style={{ fontSize: 22, fontFamily: "Manrope, sans-serif", margin: 0 }}>{title}</h2>
      {sub && <p style={{ color: "rgba(255,255,255,0.5)", margin: "4px 0 0", fontSize: 13 }}>{sub}</p>}
    </div>
  );
}

function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div style={{ ...S.card, textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.55)" }}>
      <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
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
  const [adminNotes, setAdminNotes] = useState("");
  const resolveMut = useMutation({
    mutationFn: (status: "approved" | "rejected") =>
      patchAdminRefundRequest(row.id, {
        status,
        admin_notes: adminNotes.trim() || undefined,
        ...(status === "approved" ? { resolution: "wallet_credit" } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.refundRequests });
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
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
          {resolveMut.isPending ? "…" : "Approve + refund"}
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
        fontFamily: "Inter, sans-serif",
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
            <div style={{ fontSize: 12, color: "rgba(165,180,252,0.7)", marginBottom: 5, fontWeight: 500 }}>
              Admin Console
            </div>
            <h1 style={{ fontFamily: "Manrope, sans-serif", fontSize: 28, margin: 0, letterSpacing: "-0.02em" }}>
              {active.label}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 5, fontSize: 13 }}>
              {active.hint}
            </p>
          </div>
          <Pill tone="info">Synced {new Date().toLocaleTimeString()}</Pill>
        </div>

        {/* Hide sidebar scrollbar across browsers */}
        <style>{`.admin-nav::-webkit-scrollbar{display:none}`}</style>

        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
          {/* ── Sidebar ── */}
          <nav
            className="admin-nav"
            style={{
              width: 200,
              flexShrink: 0,
              position: "sticky",
              top: 24,
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              scrollbarWidth: "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Nav groups */}
            <div style={{ flex: 1 }}>
              {grouped.map(([group, items], gi) => (
                <div key={group} style={{ marginBottom: 2 }}>
                  {/* Group separator */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: gi === 0 ? "0 8px 6px" : "14px 8px 6px",
                    }}
                  >
                    {gi > 0 && (
                      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.28)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {group}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                  </div>

                  {items.map((t) => {
                    const a = t.id === tab;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 12px 8px 13px",
                          borderRadius: 7,
                          border: "none",
                          borderLeft: a ? "2px solid #818cf8" : "2px solid transparent",
                          background: a ? "rgba(99,102,241,0.12)" : "transparent",
                          color: a ? "#c7d2fe" : "rgba(255,255,255,0.5)",
                          fontWeight: a ? 600 : 400,
                          fontSize: 13,
                          cursor: "pointer",
                          marginBottom: 1,
                          transition: "color 0.12s, background 0.12s",
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* User footer */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "6px 8px 10px",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                    color: "#fff",
                  }}
                >
                  {adminInitial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.85)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {adminName}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                    Admin
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "7px 12px",
                  borderRadius: 7,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Sign out
              </button>
            </div>
          </nav>

          {/* ── Main content ── */}
          <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            {tab === "overview" && <OverviewTab />}
            {tab === "inventory" && <InventoryTab />}
            {tab === "ingestion" && <IngestionTab />}
            {tab === "duplicates" && <DuplicatesTab />}
            {tab === "grading" && <GradingTab />}
            {tab === "distribution" && <DistributionTab />}
            {tab === "pings" && <VendorPingsTab />}
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

const cardSection: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "rgba(255,255,255,0.75)",
  marginBottom: 14,
};

function OverviewTab() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");

  const metrics = useQuery({ queryKey: queryKeys.admin.metrics, queryFn: getAdminExtendedMetrics });
  const breakdown = useQuery({ queryKey: queryKeys.admin.metricsBreakdown, queryFn: getAdminMetricsBreakdown });
  const refunds = useQuery({ queryKey: queryKeys.admin.refundRequests, queryFn: getAdminRefundRequests });
  const intake = useQuery({
    queryKey: queryKeys.admin.metricsIntake(period),
    queryFn: () => getAdminMetricsIntake(period),
  });

  const m = metrics.data;
  const b = breakdown.data;
  const ink = intake.data;
  const counts = m?.countByStatus ?? {};
  const inventoryAvailable = Number(counts["available"] ?? 0);
  const pendingRefunds = (refunds.data ?? []).filter((r) => r.status === "pending");

  const byStatus = Object.entries(counts)
    .map(([k, v]) => ({ label: k, value: Number(v) }))
    .sort((a, b) => b.value - a.value);
  const byType = (b?.soldByType ?? []).map((t) => ({
    label: t.lead_type,
    value: t.assignment_count,
    color: "linear-gradient(90deg, #ec4899, #f59e0b)" as string,
  }));

  const deliveryPct = b ? `${(b.deliverySuccessRate * 100).toFixed(1)}%` : "—";
  const churnPct = b ? `${(b.subscriptionChurn30d.churnRate * 100).toFixed(1)}%` : "—";
  const periodLabel = period === "today" ? "Today" : period === "week" ? "This week" : "This month";

  const periodBtn = (p: typeof period, label: string) => ({
    padding: "5px 13px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.1)",
    background: period === p ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.03)",
    color: period === p ? "#a5b4fc" : "rgba(255,255,255,0.45)",
    fontSize: 12,
    cursor: "pointer" as const,
    fontWeight: 500,
    fontFamily: "Inter, sans-serif",
  });

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>Dashboard</h2>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={periodBtn("today", "Today")} onClick={() => setPeriod("today")}>Today</button>
          <button style={periodBtn("week", "This week")} onClick={() => setPeriod("week")}>This week</button>
          <button style={periodBtn("month", "This month")} onClick={() => setPeriod("month")}>This month</button>
        </div>
      </div>

      {metrics.isError && <Banner tone="bad">{(metrics.error as Error).message}</Banner>}

      {/* ── Period snapshot ── */}
      <div
        style={{
          ...S.card,
          padding: "16px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
        }}
      >
        {[
          { label: "Leads in", value: ink ? ink.leads_in.toLocaleString() : "—" },
          { label: "Leads sold", value: ink ? ink.leads_sold.toLocaleString() : "—" },
          { label: "Revenue", value: ink ? fmtCents(ink.revenue_cents) : "—" },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{
              padding: "4px 20px 4px 0",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : "none",
              marginRight: i < 2 ? 20 : 0,
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>
              {periodLabel} · {item.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* ── KPI grid ── */}
      {m && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <Stat label="Sales revenue" value={fmtCents(m.totalRevenueCents)} accent="linear-gradient(90deg,#f59e0b,#ef4444)" />
            <Stat label="Buyer deposits" value={fmtCents(m.totalWalletDepositsCents)} accent="linear-gradient(90deg,#38bdf8,#6366f1)" />
            <Stat label="Est. monthly recurring" value={b ? fmtCents(b.mrrEstimateCents) : "—"} accent="linear-gradient(90deg,#ec4899,#8b5cf6)" />
            <Stat
              label="Pending refunds"
              value={<span style={{ color: pendingRefunds.length > 0 ? "#fcd34d" : "inherit" }}>{pendingRefunds.length}</span>}
              accent="linear-gradient(90deg,#f59e0b,#f97316)"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <Stat label="Available leads" value={inventoryAvailable.toLocaleString()} accent="linear-gradient(90deg,#34d399,#10b981)" />
            <Stat label="Active purchases" value={m.totalAssignments.toLocaleString()} accent="linear-gradient(90deg,#6366f1,#8b5cf6)" />
            <Stat label="CRM delivery rate" value={deliveryPct} accent="linear-gradient(90deg,#10b981,#34d399)" />
            <Stat
              label="Churn (30 days)"
              value={churnPct}
              accent={b && b.subscriptionChurn30d.churnRate > 0.1 ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#64748b,#94a3b8)"}
            />
          </div>

          {/* ── Charts ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.card}>
              <div style={cardSection}>Inventory by status</div>
              {byStatus.length === 0 ? <Empty title="No data yet" /> : <MiniBar items={byStatus} />}
            </div>
            <div style={S.card}>
              <div style={cardSection}>Sales by lead type</div>
              {breakdown.isLoading ? (
                <Empty title="Loading…" />
              ) : byType.length === 0 ? (
                <Empty title="No sales recorded yet" />
              ) : (
                <MiniBar items={byType} />
              )}
            </div>
          </div>

          {/* ── Bottom row ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            {/* Top buyers */}
            <div style={S.card}>
              <div style={cardSection}>Top buyers</div>
              {breakdown.isLoading ? (
                <Empty title="Loading…" />
              ) : !b || b.topBuyers.length === 0 ? (
                <Empty title="No buyers yet" />
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={S.th}>#</th>
                      <th style={S.th}>Buyer</th>
                      <th style={{ ...S.th, textAlign: "right" }}>Leads</th>
                      <th style={{ ...S.th, textAlign: "right" }}>Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.topBuyers.map((row, i) => (
                      <tr
                        key={row.user_id}
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                        }}
                      >
                        <td style={{ ...S.td, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{i + 1}</td>
                        <td style={S.td}>{row.email}</td>
                        <td style={{ ...S.td, textAlign: "right" }}>{row.assignment_count.toLocaleString()}</td>
                        <td style={{ ...S.td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          {fmtCents(row.total_spend_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pending refunds */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={cardSection}>Refund requests</div>
                {pendingRefunds.length > 0 && <Pill tone="warn">{pendingRefunds.length} pending</Pill>}
              </div>
              {pendingRefunds.length === 0 ? (
                <Empty title="All clear" body="No pending refund requests." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pendingRefunds.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        background: "rgba(245,158,11,0.05)",
                        border: "1px solid rgba(245,158,11,0.15)",
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.lead_assignment.lead.title}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                          {r.buyer.email} · {fmtCents(r.lead_assignment.amount_charged_cents)}
                        </div>
                      </div>
                      <Pill tone="warn">pending</Pill>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!m && metrics.isLoading && <Empty title="Loading metrics…" />}
    </>
  );
}

// ---------- Inventory ----------

type InventoryPeriod = "today" | "week" | "month" | "all";

function LeadEditModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: AdminLeadRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(lead.title);
  const [leadType, setLeadType] = useState(lead.lead_type);
  const [market, setMarket] = useState(lead.market);
  const [status, setStatus] = useState(lead.status);
  const [source, setSource] = useState(lead.source);
  const [excl, setExcl] = useState(
    lead.exclusive_price_cents ? String(Math.round(Number(lead.exclusive_price_cents) / 100)) : "",
  );
  const [shared, setShared] = useState(
    lead.shared_price_cents ? String(Math.round(Number(lead.shared_price_cents) / 100)) : "",
  );
  const [cap, setCap] = useState(String(lead.max_non_exclusive_buyers ?? 3));
  const [discountPct, setDiscountPct] = useState("");
  const [boostPct, setBoostPct] = useState("");

  const save = useMutation({
    mutationFn: () =>
      patchAdminLead(lead.id, {
        title: title || undefined,
        lead_type: leadType || undefined,
        market: market || undefined,
        status: status as any || undefined,
        source: source || undefined,
        exclusive_price_cents: excl ? Math.round(parseFloat(excl) * 100) : undefined,
        shared_price_cents: shared ? Math.round(parseFloat(shared) * 100) : undefined,
        max_non_exclusive_buyers: cap ? Number(cap) : undefined,
      }),
    onSuccess: onSaved,
  });

  const applyDiscount = useMutation({
    mutationFn: () => postAdminLeadDiscount(lead.id, { percent: Number(discountPct) }),
    onSuccess: onSaved,
  });

  const applyBoost = useMutation({
    mutationFn: () => postAdminLeadBoost(lead.id, { percent: Number(boostPct) }),
    onSuccess: onSaved,
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0f1420",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: 24,
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>Edit lead</span>
          <button type="button" onClick={onClose} style={{ ...S.btnGhost, padding: "4px 10px" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <label style={{ ...S.label, gridColumn: "1 / -1" }}>
            Title
            <input style={S.inp} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label style={S.label}>
            Lead type
            <input style={S.inp} value={leadType} onChange={(e) => setLeadType(e.target.value)} />
          </label>
          <label style={S.label}>
            Market
            <input style={S.inp} value={market} onChange={(e) => setMarket(e.target.value)} />
          </label>
          <label style={S.label}>
            Status
            <select style={S.inp} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="available">available</option>
              <option value="sold">sold</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label style={S.label}>
            Source
            <select style={S.inp} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="inbound">inbound</option>
              <option value="outbound">outbound</option>
              <option value="admin-ingestion">admin-ingestion</option>
            </select>
          </label>
          <label style={S.label}>
            Exclusive price ($)
            <input style={S.inp} value={excl} onChange={(e) => setExcl(e.target.value)} placeholder="e.g. 200" />
          </label>
          <label style={S.label}>
            Non-exclusive price ($)
            <input style={S.inp} value={shared} onChange={(e) => setShared(e.target.value)} placeholder="e.g. 100" />
          </label>
          <label style={S.label}>
            Buyer cap
            <input style={S.inp} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="3" />
          </label>
        </div>

        <button
          type="button"
          style={{ ...S.btnPrimary, width: "100%", marginBottom: 14 }}
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ ...S.label, minWidth: 120 }}>
            Discount (%)
            <input style={S.inp} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="e.g. 15" />
          </label>
          <button
            type="button"
            style={{ ...S.btn, background: "#f59e0b", alignSelf: "flex-end" }}
            disabled={applyDiscount.isPending || !discountPct}
            onClick={() => applyDiscount.mutate()}
          >Apply discount</button>
          <label style={{ ...S.label, minWidth: 120 }}>
            Boost (%)
            <input style={S.inp} value={boostPct} onChange={(e) => setBoostPct(e.target.value)} placeholder="e.g. 10" />
          </label>
          <button
            type="button"
            style={{ ...S.btn, background: "#10b981", alignSelf: "flex-end" }}
            disabled={applyBoost.isPending || !boostPct}
            onClick={() => applyBoost.mutate()}
          >Apply boost</button>
        </div>

        {(save.isError || applyDiscount.isError || applyBoost.isError) && (
          <div style={{ marginTop: 10 }}>
            <Banner tone="bad">{((save.error ?? applyDiscount.error ?? applyBoost.error) as Error).message}</Banner>
          </div>
        )}
        {(save.isSuccess || applyDiscount.isSuccess || applyBoost.isSuccess) && (
          <div style={{ marginTop: 10 }}><Banner tone="good">Saved.</Banner></div>
        )}
      </div>
    </div>
  );
}

function InventoryTab() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<InventoryPeriod>("today");
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<"" | "inbound" | "outbound">("");
  const [editLead, setEditLead] = useState<AdminLeadRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const intakeQ = useQuery({
    queryKey: queryKeys.admin.metricsIntake(period),
    queryFn: () => getAdminMetricsIntake(period as any),
    enabled: period !== "all",
  });

  const leadsQ = useQuery({
    queryKey: queryKeys.admin.leads({ page, source: sourceFilter || undefined, date_from: periodToDateFrom(period) }),
    queryFn: () => getAdminLeads({ page, limit: 25, source: sourceFilter || undefined, date_from: periodToDateFrom(period) }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAdminLead(id),
    onSuccess: () => {
      setConfirmDeleteId(null);
      void qc.invalidateQueries({ queryKey: ["admin", "leads"] });
      void qc.invalidateQueries({ queryKey: ["admin", "metrics", "intake"] });
    },
  });

  const items = leadsQ.data?.items ?? [];

  function fmtPrice(cents: string | null) {
    if (!cents) return "—";
    return `$${(Number(cents) / 100).toFixed(0)}`;
  }

  function sourceChip(src: string) {
    const color = src === "inbound" ? "#6366f1" : src === "outbound" ? "#10b981" : "#64748b";
    return (
      <span style={{ background: color + "22", color, padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
        {src}
      </span>
    );
  }

  const PERIODS: { id: InventoryPeriod; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "all", label: "All Time" },
  ];

  return (
    <>
      <SectionTitle title="Lead inventory" sub="View leads by period, filter by source, edit or delete." />

      {/* Period tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setPeriod(p.id); setPage(1); }}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: period === p.id ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
              background: period === p.id ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
              color: period === p.id ? "#a5b4fc" : "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: period === p.id ? 600 : 400,
            }}
          >{p.label}</button>
        ))}
      </div>

      {/* Period stats */}
      {period !== "all" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
          <div style={S.card}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Leads In</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{intakeQ.data?.leads_in ?? "—"}</div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Leads Sold</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{intakeQ.data?.leads_sold ?? "—"}</div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Revenue</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {intakeQ.data ? `$${(Number(intakeQ.data.revenue_cents) / 100).toFixed(0)}` : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ ...S.card, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: 12, marginBottom: 12 }}>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value as any); setPage(1); }}
          style={{ ...S.inp, width: "auto" }}
        >
          <option value="">All sources</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginLeft: "auto" }}>
          {leadsQ.data?.pagination.total ?? 0} total
        </span>
        <button type="button" style={S.btnGhost} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <button type="button" style={S.btnGhost} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      {leadsQ.isLoading && <Empty title="Loading…" />}
      {leadsQ.isError && <Banner tone="bad">{(leadsQ.error as Error).message}</Banner>}

      {items.length > 0 && (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,0.2)" }}>
              <tr>
                <th style={S.th}>Title</th>
                <th style={S.th}>Type</th>
                <th style={S.th}>Market</th>
                <th style={S.th}>Source</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Excl.</th>
                <th style={S.th}>Non-excl.</th>
                <th style={S.th}>Buyers</th>
                <th style={S.th}>Created</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ ...S.td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</td>
                  <td style={S.td}><Pill>{l.lead_type}</Pill></td>
                  <td style={S.td}>{l.market}</td>
                  <td style={S.td}>{sourceChip(l.source)}</td>
                  <td style={S.td}><Pill tone={statusTone(l.status)}>{l.status}</Pill></td>
                  <td style={S.td}>{fmtPrice(l.exclusive_price_cents)}</td>
                  <td style={S.td}>{fmtPrice(l.shared_price_cents)}</td>
                  <td style={S.td}>
                    {l.buyers.length > 0
                      ? <span title={l.buyers.join(", ")} style={{ fontSize: 12, color: "#a5b4fc" }}>{l.buyers.length} buyer{l.buyers.length !== 1 ? "s" : ""}</span>
                      : <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={S.td}>{new Date(l.created_at).toLocaleDateString()}</td>
                  <td style={{ ...S.td, display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 12 }}
                      onClick={() => setEditLead(l)}
                    >Edit</button>
                    {confirmDeleteId === l.id ? (
                      <>
                        <button
                          type="button"
                          style={{ ...S.btn, background: "#ef4444", padding: "4px 10px", fontSize: 12 }}
                          disabled={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(l.id)}
                        >{deleteMut.isPending ? "…" : "Confirm"}</button>
                        <button type="button" style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 12 }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button
                        type="button"
                        style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 12, color: "#f87171" }}
                        onClick={() => setConfirmDeleteId(l.id)}
                      >Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editLead && (
        <LeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={() => {
            setEditLead(null);
            void qc.invalidateQueries({ queryKey: ["admin", "leads"] });
          }}
        />
      )}
    </>
  );
}

function periodToDateFrom(period: InventoryPeriod): string | undefined {
  if (period === "all") return undefined;
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// ---------- Ingestion ----------

function parseIngestionCsv(text: string): { rows: IngestionRowInput[]; errors: string[] } {
  const errors: string[] = [];
  // Handle quoted CSV fields properly
  function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ["File is empty"] };
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/^"|"$/g, ""));
  const idx = (key: string) => header.indexOf(key);
  const required = ["market", "lead_type", "price_cents"];
  for (const r of required) {
    if (idx(r) < 0) errors.push(`Missing required column: ${r}`);
  }
  if (errors.length) return { rows: [], errors };

  const str = (v: string | undefined) => (v && v.replace(/^"|"$/g, "").trim()) || undefined;

  const rows: IngestionRowInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const rawPrice = cells[idx("price_cents")] ?? "";
    const price = Number(rawPrice.replace(/^"|"$/g, "").trim());
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Row ${i + 1}: invalid price_cents "${rawPrice}"`);
      continue;
    }
    const market = str(cells[idx("market")]) ?? "";
    const leadType = str(cells[idx("lead_type")]) ?? "";
    if (!market || !leadType) {
      errors.push(`Row ${i + 1}: market and lead_type are required`);
      continue;
    }
    const row: IngestionRowInput = { market, lead_type: leadType, price_cents: Math.round(price) };

    const pick = (key: string) => str(idx(key) >= 0 ? cells[idx(key)] : undefined);

    const excl = pick("exclusivity_level");
    if (excl === "exclusive" || excl === "non_exclusive") row.exclusivity_level = excl;
    row.title = pick("title");
    row.source = pick("source");
    row.seller_name = pick("seller_name");
    row.first_name = pick("first_name");
    row.last_name = pick("last_name");
    row.contact_email = pick("email") ?? pick("contact_email");
    row.contact_phone = pick("phone") ?? pick("contact_phone");
    row.address = pick("address");
    row.city = pick("city");
    row.state = pick("state");
    row.zip = pick("zip");
    row.property_type = pick("property_type");
    row.condition = pick("condition");
    row.timeline = pick("timeline");
    row.notes = pick("notes");
    if (idx("quality_score") >= 0) {
      const qs = Number(cells[idx("quality_score")] ?? 50);
      row.quality_score = Number.isFinite(qs) ? Math.max(0, Math.min(100, qs)) : 50;
    }
    rows.push(row);
  }
  return { rows, errors };
}

type ScriptTab = "single" | "batch" | "sheets";

const SCRIPT_TABS: Array<{ id: ScriptTab; label: string; endpoint: string; hint: string }> = [
  { id: "single", label: "Single lead", endpoint: "POST /inbound/lead", hint: "One lead per request · Zapier, Make.com, form submissions" },
  { id: "batch", label: "Batch leads", endpoint: "POST /inbound/leads", hint: "Array of leads · call centers, nightly syncs, bulk imports" },
  { id: "sheets", label: "Google Sheets", endpoint: "Apps Script", hint: "Map sheet columns to lead fields, run from a button or trigger" },
];

const LEAD_FIELDS: Array<{ field: string; type: string; required: boolean; desc: string }> = [
  { field: "market", type: "string", required: true, desc: 'City + state — e.g. "Phoenix, AZ"' },
  { field: "lead_type", type: "string", required: true, desc: "inherited · foreclosure · divorce · probate · tired_landlord · other" },
  { field: "title", type: "string", required: false, desc: "Display name — auto-generated if omitted" },
  { field: "price_cents", type: "integer", required: false, desc: "Base price in cents · 4500 = $45.00" },
  { field: "exclusive_price_cents", type: "integer", required: false, desc: "Exclusive-purchase price in cents" },
  { field: "quality_score", type: "0 – 100", required: false, desc: "Lead quality score — defaults to 70" },
  { field: "metadata.state", type: "string", required: false, desc: '2-letter state code — e.g. "AZ" · used for market alerts' },
  { field: "metadata.contact_phone", type: "string", required: false, desc: "Seller phone number" },
  { field: "metadata.contact_email", type: "string", required: false, desc: "Seller email address" },
  { field: "metadata.address", type: "string", required: false, desc: "Property street address" },
  { field: "metadata.city", type: "string", required: false, desc: "Property city" },
  { field: "metadata.zip", type: "string", required: false, desc: "Property ZIP code" },
  { field: "metadata.property_type", type: "string", required: false, desc: "single_family · multi_family · land · commercial" },
  { field: "metadata.timeline", type: "string", required: false, desc: "asap · 30_days · 60_days · flexible" },
  { field: "metadata.notes", type: "string", required: false, desc: "Free-text notes from the vendor" },
];

function VendorWebhookPanel() {
  const vendors = useQuery({ queryKey: queryKeys.admin.vendors, queryFn: getAdminVendors });
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ScriptTab>("single");
  const [copied, setCopied] = useState(false);
  const [showFields, setShowFields] = useState(false);

  const hitsQ = useQuery({
    queryKey: queryKeys.admin.vendorWebhookHits(selectedVendorId),
    queryFn: () => getAdminVendorWebhookHits(selectedVendorId, 50),
    enabled: !!selectedVendorId,
  });

  const payoutQ = useQuery({
    queryKey: queryKeys.admin.vendorPayoutStats(selectedVendorId),
    queryFn: () => getAdminVendorPayoutStats(selectedVendorId),
    enabled: !!selectedVendorId,
  });

  const apiBase = "https://lead-platform-api.onrender.com";

  const scripts: Record<ScriptTab, string> = {
    single: `curl -X POST ${apiBase}/inbound/lead \\
  -H "Content-Type: application/json" \\
  -H "X-Vendor-Key: YOUR_API_KEY" \\
  -d '{
    "market": "Phoenix, AZ",
    "lead_type": "inherited",
    "title": "Sarah Johnson — Inherited Property",
    "price_cents": 4500,
    "quality_score": 82,
    "metadata": {
      "state": "AZ",
      "contact_phone": "602-555-0101",
      "contact_email": "sarah@example.com",
      "address": "123 Main St",
      "city": "Phoenix",
      "zip": "85001",
      "property_type": "single_family",
      "timeline": "asap",
      "notes": "Inherited from late parent, motivated to sell"
    }
  }'`,
    batch: `curl -X POST ${apiBase}/inbound/leads \\
  -H "Content-Type: application/json" \\
  -H "X-Vendor-Key: YOUR_API_KEY" \\
  -d '{
    "leads": [
      {
        "market": "Phoenix, AZ",
        "lead_type": "inherited",
        "title": "Sarah Johnson — Inherited Property",
        "price_cents": 4500,
        "quality_score": 82,
        "metadata": { "state": "AZ", "contact_phone": "602-555-0101" }
      },
      {
        "market": "Dallas, TX",
        "lead_type": "foreclosure",
        "title": "Mike Torres — Pre-Foreclosure",
        "price_cents": 3800,
        "quality_score": 74,
        "metadata": { "state": "TX", "contact_phone": "214-555-0188" }
      },
      {
        "market": "Atlanta, GA",
        "lead_type": "divorce",
        "title": "Pending Sale — Divorce Settlement",
        "price_cents": 5200,
        "quality_score": 90,
        "metadata": { "state": "GA", "contact_phone": "404-555-0144" }
      }
    ]
  }'`,
    sheets: `// Paste into Google Sheets → Extensions → Apps Script
// Add a button or run manually — posts the selected row as a lead

function postLeadToMarketplace() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveRange().getRow();

  // Row 1 must be headers: market, lead_type, title, price_cents, etc.
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data    = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  var payload = {};
  headers.forEach(function(h, i) {
    if (h && data[i] !== "" && data[i] !== null) payload[h] = data[i];
  });

  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "X-Vendor-Key": "YOUR_API_KEY" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var res = UrlFetchApp.fetch("${apiBase}/inbound/lead", options);
  var json = JSON.parse(res.getContentText());

  if (json.success) {
    SpreadsheetApp.getUi().alert("Lead accepted — ID: " + json.lead_id);
  } else {
    SpreadsheetApp.getUi().alert("Error: " + res.getContentText());
  }
}`,
  };

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(scripts[activeTab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for non-HTTPS or denied permission
      const el = document.createElement("textarea");
      el.value = scripts[activeTab];
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const activeTabMeta = SCRIPT_TABS.find((t) => t.id === activeTab)!;

  return (
    <>
      {/* ── Integration scripts ── */}
      <div style={S.card}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, margin: "0 0 4px" }}>
            Vendor webhook integration
          </h3>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
            Vendors POST leads using their API key in the <code style={{ color: "#a5b4fc" }}>X-Vendor-Key</code> header.
            Leads land in the Pending Review queue and require admin approval before going live.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{
          display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 16,
        }}>
          {SCRIPT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setActiveTab(t.id); setCopied(false); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "8px 16px", fontSize: 13, fontWeight: 500,
                color: activeTab === t.id ? "#a5b4fc" : "rgba(255,255,255,0.45)",
                borderBottom: activeTab === t.id ? "2px solid #6366f1" : "2px solid transparent",
                marginBottom: -1,
                transition: "color 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab metadata row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10,
        }}>
          <div>
            <code style={{
              fontSize: 12, color: "#6ee7b7",
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 6, padding: "3px 8px",
            }}>
              {activeTabMeta.endpoint}
            </code>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 10 }}>
              {activeTabMeta.hint}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              ...S.btnGhost, fontSize: 12, padding: "4px 14px", minWidth: 70,
              color: copied ? "#6ee7b7" : undefined,
              borderColor: copied ? "rgba(16,185,129,0.4)" : undefined,
              transition: "color 0.2s, border-color 0.2s",
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        {/* Script block */}
        <pre style={{
          background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10, padding: "14px 16px", fontSize: 11, color: "#e2e8f0",
          overflowX: "auto", lineHeight: 1.7, margin: "0 0 16px",
          fontFamily: "DM Mono, monospace",
        }}>
          {scripts[activeTab]}
        </pre>

        {/* Field reference toggle */}
        <button
          type="button"
          onClick={() => setShowFields((v) => !v)}
          style={{
            ...S.btnGhost, fontSize: 12, padding: "5px 14px",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 10, opacity: 0.6 }}>{showFields ? "▲" : "▼"}</span>
          Lead field reference
        </button>

        {showFields && (
          <div style={{
            marginTop: 12, borderRadius: 10, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "rgba(0,0,0,0.25)" }}>
                <tr>
                  <th style={S.th}>Field</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Required</th>
                  <th style={S.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {LEAD_FIELDS.map((f) => (
                  <tr key={f.field} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ ...S.td, fontFamily: "DM Mono, monospace", fontSize: 11, color: "#a5b4fc" }}>{f.field}</td>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{f.type}</td>
                    <td style={S.td}>
                      {f.required
                        ? <Pill tone="warn">required</Pill>
                        : <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>optional</span>}
                    </td>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Vendor inspect ── */}
      <div style={S.card}>
        <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 12 }}>
          Inspect vendor activity
        </h3>

        {vendors.isLoading ? (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Loading vendors…</div>
        ) : vendors.data?.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            No vendors configured yet — add one in the Integrations tab.
          </div>
        ) : (
          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            style={{ ...S.inp, maxWidth: 320, marginBottom: 16 }}
          >
            <option value="">— Select a vendor to inspect —</option>
            {(vendors.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}{v.enabled ? "" : " (disabled)"}</option>
            ))}
          </select>
        )}

        {selectedVendorId && payoutQ.data && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {([
              { label: "Total hits", value: payoutQ.data.total_hits, color: "#a5b4fc" },
              { label: "Accepted", value: payoutQ.data.accepted, color: "#6ee7b7" },
              { label: "Rejected", value: payoutQ.data.rejected, color: "#fca5a5" },
            ] as const).map(({ label, value, color }) => (
              <div key={label} style={{
                flex: 1, padding: "12px 16px", borderRadius: 10,
                background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "Manrope, sans-serif" }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {selectedVendorId && hitsQ.isLoading && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Loading activity…</div>
        )}

        {selectedVendorId && !hitsQ.isLoading && hitsQ.data && hitsQ.data.length > 0 && (
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "rgba(0,0,0,0.2)" }}>
                <tr>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Lead ID</th>
                  <th style={S.th}>IP address</th>
                  <th style={S.th}>Rejection reason</th>
                  <th style={S.th}>Received</th>
                </tr>
              </thead>
              <tbody>
                {hitsQ.data.map((h) => (
                  <tr key={h.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={S.td}>
                      <Pill tone={h.status === "accepted" ? "good" : "bad"}>{h.status}</Pill>
                    </td>
                    <td style={{ ...S.td, fontFamily: "DM Mono, monospace", fontSize: 11, color: "#a5b4fc" }}>
                      {h.lead_id ? h.lead_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{h.ip_address ?? "—"}</td>
                    <td style={{ ...S.td, color: h.rejection_reason ? "#fca5a5" : "rgba(255,255,255,0.3)" }}>
                      {h.rejection_reason ?? "—"}
                    </td>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.45)" }}>{new Date(h.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedVendorId && !hitsQ.isLoading && hitsQ.data?.length === 0 && (
          <Empty title="No activity recorded for this vendor yet" />
        )}
      </div>
    </>
  );
}

function PendingLeadsSection() {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: queryKeys.admin.pendingLeads,
    queryFn: getAdminPendingLeads,
    refetchInterval: 30_000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => patchAdminApproveLead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.pendingLeads });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metrics });
    },
  });

  const reject = useMutation({
    mutationFn: (id: string) => patchAdminRejectLead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.pendingLeads });
    },
  });

  const bulkApprove = useMutation({
    mutationFn: (ids: string[]) => postAdminBulkApproveLeads(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.pendingLeads });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metrics });
    },
  });

  const bulkReject = useMutation({
    mutationFn: (ids: string[]) => postAdminBulkRejectLeads(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.pendingLeads });
    },
  });

  const total = pending.data?.total ?? 0;

  if (pending.isLoading) {
    return (
      <div style={S.card}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Loading pending leads…</div>
      </div>
    );
  }

  if (total === 0) return null;

  return (
    <div style={{ ...S.card, borderLeft: "3px solid #f59e0b", padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: "rgba(245,158,11,0.06)",
          borderBottom: "1px solid rgba(245,158,11,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: "#f59e0b", color: "#000", borderRadius: 20,
            padding: "2px 10px", fontSize: 12, fontWeight: 700,
          }}>
            {total}
          </span>
          <span style={{ fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 15 }}>
            Leads pending review
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
            Approve to make available on marketplace · Reject to discard
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            style={{
              ...S.btnGhost, fontSize: 12, padding: "5px 14px",
              opacity: bulkReject.isPending ? 0.6 : 1,
            }}
            disabled={bulkReject.isPending}
            onClick={() => {
              const ids = pending.data?.groups.flatMap((g) => g.leads.map((l) => l.id)) ?? [];
              bulkReject.mutate(ids);
            }}
          >
            Reject all
          </button>
          <button
            type="button"
            style={{
              ...S.btnPrimary, fontSize: 12, padding: "5px 14px",
              opacity: bulkApprove.isPending ? 0.6 : 1,
            }}
            disabled={bulkApprove.isPending}
            onClick={() => {
              const ids = pending.data?.groups.flatMap((g) => g.leads.map((l) => l.id)) ?? [];
              bulkApprove.mutate(ids);
            }}
          >
            Approve all
          </button>
        </div>
      </div>

      {pending.data?.groups.map((group: PendingLeadGroup) => (
        <div key={group.vendor_id ?? "unknown"} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 20px",
              background: "rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: group.vendor_id ? "#10b981" : "rgba(255,255,255,0.3)",
                flexShrink: 0,
              }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{group.vendor_name}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {group.count} lead{group.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                style={{ ...S.btnGhost, fontSize: 11, padding: "3px 10px", opacity: bulkReject.isPending ? 0.6 : 1 }}
                disabled={bulkReject.isPending}
                onClick={() => bulkReject.mutate(group.leads.map((l) => l.id))}
              >
                Reject {group.count}
              </button>
              <button
                type="button"
                style={{ ...S.btnPrimary, fontSize: 11, padding: "3px 10px", opacity: bulkApprove.isPending ? 0.6 : 1 }}
                disabled={bulkApprove.isPending}
                onClick={() => bulkApprove.mutate(group.leads.map((l) => l.id))}
              >
                Approve {group.count}
              </button>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,0.1)" }}>
              <tr>
                <th style={{ ...S.th, fontSize: 11 }}>Title</th>
                <th style={{ ...S.th, fontSize: 11 }}>Market</th>
                <th style={{ ...S.th, fontSize: 11 }}>Type</th>
                <th style={{ ...S.th, fontSize: 11 }}>Price</th>
                <th style={{ ...S.th, fontSize: 11 }}>Received</th>
                <th style={{ ...S.th, fontSize: 11, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {group.leads.map((lead) => (
                <tr key={lead.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={S.td}>{lead.title}</td>
                  <td style={S.td}>{lead.market}</td>
                  <td style={S.td}>{lead.lead_type}</td>
                  <td style={S.td}>${(parseInt(lead.price_cents || "0", 10) / 100).toFixed(2)}</td>
                  <td style={S.td}>{new Date(lead.created_at).toLocaleString()}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        style={{
                          padding: "2px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.4)",
                          background: "rgba(239,68,68,0.08)", color: "#fca5a5",
                          fontSize: 11, cursor: "pointer",
                          opacity: reject.isPending ? 0.6 : 1,
                        }}
                        disabled={reject.isPending}
                        onClick={() => reject.mutate(lead.id)}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        style={{
                          padding: "2px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.4)",
                          background: "rgba(16,185,129,0.08)", color: "#6ee7b7",
                          fontSize: 11, cursor: "pointer",
                          opacity: approve.isPending ? 0.6 : 1,
                        }}
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(lead.id)}
                      >
                        Approve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function IngestionTab() {
  const qc = useQueryClient();
  const [filename, setFilename] = useState("");
  const [vendor, setVendor] = useState("");
  const [parsedRows, setParsedRows] = useState<IngestionRowInput[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const stats = useQuery({
    queryKey: queryKeys.admin.ingestionStats,
    queryFn: getAdminIngestionStats,
  });
  const pendingLeads = useQuery({
    queryKey: queryKeys.admin.pendingLeads,
    queryFn: getAdminPendingLeads,
    refetchInterval: 30_000,
  });
  const batches = useQuery({
    queryKey: queryKeys.admin.ingestionBatches,
    queryFn: () => getAdminIngestionBatches(25),
  });

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
        title="Add leads"
        sub="Upload a CSV file or view recent batches. Connect vendor feeds in the developer section below."
      />

      <PendingLeadsSection />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Pending review"
          value={String(pendingLeads.data?.total ?? "—")}
          hint="Awaiting admin approval"
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
        <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}>
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
              style={{
                ...S.btnPrimary,
                opacity: parsedRows.length === 0 || upload.isPending ? 0.65 : 1,
                display: "flex", alignItems: "center", gap: 8, justifyContent: "center", minWidth: 120,
              }}
              disabled={upload.isPending || parsedRows.length === 0}
              onClick={() => upload.mutate()}
            >
              {upload.isPending ? (
                <>
                  <span style={{
                    width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff", borderRadius: "50%",
                    animation: "spin 0.7s linear infinite", flexShrink: 0,
                  }} />
                  Uploading…
                </>
              ) : (
                `Upload${parsedRows.length > 0 ? ` (${parsedRows.length})` : ""}`
              )}
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

      <div style={{ ...S.card, padding: 0, overflow: "hidden" }} id="ingestion-batches">
        <h3
          style={{
            fontFamily: "Manrope, sans-serif",
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

      <VendorWebhookPanel />
    </>
  );
}

// ---------- Duplicates ----------

function fmtShortDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusDotColor(s: string) {
  if (s === "available") return "#34d399";
  if (s === "sold" || s === "distributed") return "#a5b4fc";
  return "rgba(255,255,255,0.3)";
}

const PAGE_SIZE = 10;

function ResolvedDuplicatesModal({ onClose }: { onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [take, setTake] = useState(PAGE_SIZE);

  // Reset take when date filters change
  function applyDateFilter(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    setTake(PAGE_SIZE);
  }

  const resolved = useQuery({
    queryKey: ["admin", "duplicate-groups", "resolved", take, dateFrom, dateTo],
    queryFn: () =>
      getAdminResolvedDuplicateGroups({
        limit: take,
        offset: 0,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const hasMore = (resolved.data?.length ?? 0) >= take;

  const inputStyle: CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#fff",
    fontSize: 12,
    padding: "5px 9px",
    colorScheme: "dark",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#0f1420", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        {/* Modal header */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Resolved duplicates</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                {resolved.data
                  ? `${resolved.data.length} group${resolved.data.length === 1 ? "" : "s"} loaded`
                  : "Loading…"}
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ ...S.btnGhost, padding: "5px 12px", fontSize: 13 }}>Close</button>
          </div>
          {/* Date filter row */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>Archived between</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => applyDateFilter(e.target.value, dateTo)}
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>and</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => applyDateFilter(dateFrom, e.target.value)}
              style={inputStyle}
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => applyDateFilter("", "")}
                style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 11 }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Modal body */}
        <div style={{ overflowY: "auto", padding: "16px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
          {resolved.isLoading && <Empty title="Loading resolved groups…" />}
          {resolved.data && resolved.data.length === 0 && (
            <Empty title="No resolved groups" body="Archived duplicates will appear here." />
          )}
          {(resolved.data ?? []).map((g) => (
            <div key={g.canonical_id} style={{ ...S.card, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{g.canonical_title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{g.phone}</div>
                </div>
                <Pill tone="good">{g.duplicate_count} archived</Pill>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(g.duplicates ?? []).map((d) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: "rgba(255,255,255,0.55)" }}>{d.title}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)" }}>{fmtShortDate(d.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setTake((t) => t + PAGE_SIZE)}
              disabled={resolved.isFetching}
              style={{ ...S.btnGhost, alignSelf: "center", padding: "7px 20px", fontSize: 12, opacity: resolved.isFetching ? 0.5 : 1 }}
            >
              {resolved.isFetching ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DuplicateGroupCard({
  group,
  onMergeMany,
  merging,
  selectedLeadIds,
  onToggle,
  onSelectGroup,
  onClearGroup,
}: {
  group: AdminLeadDuplicateGroup;
  onMergeMany: (duplicateIds: string[], canonicalId: string) => void;
  merging: boolean;
  selectedLeadIds: Set<string>;
  onToggle: (leadId: string, canonicalId: string) => void;
  onSelectGroup: (items: Array<{ id: string; canonicalId: string }>) => void;
  onClearGroup: (leadIds: string[]) => void;
}) {
  const leads = group.leads ?? [];
  const [canonicalId, setCanonicalId] = useState(leads[0]?.id ?? "");

  const resolvable = leads.filter((l) => l.id !== canonicalId && !l.is_duplicate);
  const allSelected = resolvable.length > 0 && resolvable.every((l) => selectedLeadIds.has(l.id));

  function handleToggleAll() {
    if (allSelected) {
      onClearGroup(resolvable.map((l) => l.id));
    } else {
      onSelectGroup(resolvable.map((l) => ({ id: l.id, canonicalId })));
    }
  }

  function handleSetCanonical(id: string) {
    setCanonicalId(id);
    // Remove new canonical from selection if it was there
    onClearGroup([id]);
  }

  return (
    <div style={S.card}>
      {/* Group header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{group.phone || "(no phone)"}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
            {leads.length} leads share this number · {resolvable.length} to resolve
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {resolvable.length > 1 && (
            <button
              type="button"
              onClick={handleToggleAll}
              style={{ ...S.btnGhost, padding: "4px 11px", fontSize: 12 }}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      </div>

      {/* Lead rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {leads.map((lead) => {
          const isCanonical = lead.id === canonicalId;
          const isDupe = lead.is_duplicate;
          const isSelected = selectedLeadIds.has(lead.id);

          return (
            <div
              key={lead.id}
              style={{
                display: "grid",
                gridTemplateColumns: "20px 1fr auto auto",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 8,
                border: isCanonical
                  ? "1px solid rgba(52,211,153,0.3)"
                  : isSelected
                  ? "1px solid rgba(99,102,241,0.4)"
                  : "1px solid rgba(255,255,255,0.06)",
                background: isCanonical
                  ? "rgba(52,211,153,0.05)"
                  : isSelected
                  ? "rgba(99,102,241,0.07)"
                  : "rgba(0,0,0,0.15)",
                cursor: !isCanonical && !isDupe ? "pointer" : "default",
              }}
              onClick={() => !isCanonical && !isDupe && onToggle(lead.id, canonicalId)}
            >
              {/* Checkbox / indicator */}
              {isDupe || isCanonical ? (
                <span />
              ) : (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(lead.id, canonicalId)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ accentColor: "#6366f1", cursor: "pointer", width: 14, height: 14 }}
                />
              )}

              {/* Title + date */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: isDupe ? "rgba(255,255,255,0.35)" : "#fff" }}>
                  {lead.title}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: statusDotColor(lead.status), marginRight: 5, verticalAlign: "middle" }} />
                  {lead.status} · {fmtShortDate(lead.created_at)}
                </div>
              </div>

              {/* Badge / set-canonical */}
              {isCanonical ? (
                <Pill tone="good">canonical</Pill>
              ) : isDupe ? (
                <Pill tone="default">archived</Pill>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSetCanonical(lead.id); }}
                  style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Set as canonical
                </button>
              )}

              {/* Single-lead archive */}
              {!isCanonical && !isDupe ? (
                <button
                  type="button"
                  disabled={merging}
                  onClick={(e) => { e.stopPropagation(); onMergeMany([lead.id], canonicalId); }}
                  style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 11, opacity: merging ? 0.5 : 1, whiteSpace: "nowrap" }}
                >
                  Archive
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DuplicatesTab() {
  const qc = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);
  // Map<leadId, canonicalId> — lifted selection state shared across all group cards
  const [globalSelected, setGlobalSelected] = useState<Map<string, string>>(new Map());

  const groups = useQuery({
    queryKey: queryKeys.admin.duplicateGroups,
    queryFn: getAdminLeadDuplicateGroups,
  });

  const merge = useMutation({
    mutationFn: (args: { duplicateLeadId: string; canonicalLeadId: string }) =>
      postAdminLeadMarkDuplicate(args.duplicateLeadId, args.canonicalLeadId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.duplicateGroups });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metricsBreakdown });
      void qc.invalidateQueries({ queryKey: ["admin", "duplicate-groups", "resolved"] });
    },
  });

  async function handleMergeMany(duplicateIds: string[], canonicalId: string) {
    await Promise.all(
      duplicateIds.map((id) =>
        merge.mutateAsync({ duplicateLeadId: id, canonicalLeadId: canonicalId }),
      ),
    );
  }

  async function handleMergeGlobalSelected() {
    const entries = Array.from(globalSelected.entries());
    if (entries.length === 0) return;
    await Promise.all(
      entries.map(([dupId, canId]) =>
        merge.mutateAsync({ duplicateLeadId: dupId, canonicalLeadId: canId }),
      ),
    );
    setGlobalSelected(new Map());
  }

  function toggleLead(leadId: string, canonicalId: string) {
    setGlobalSelected((prev) => {
      const next = new Map(prev);
      next.has(leadId) ? next.delete(leadId) : next.set(leadId, canonicalId);
      return next;
    });
  }

  function selectGroup(items: Array<{ id: string; canonicalId: string }>) {
    setGlobalSelected((prev) => {
      const next = new Map(prev);
      items.forEach(({ id, canonicalId }) => next.set(id, canonicalId));
      return next;
    });
  }

  function clearGroup(leadIds: string[]) {
    setGlobalSelected((prev) => {
      const next = new Map(prev);
      leadIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  // Collect all resolvable leads across every group for global select-all
  const allResolvable = useMemo(() => {
    const items: Array<{ id: string; canonicalId: string }> = [];
    for (const g of groups.data ?? []) {
      const leads = g.leads ?? [];
      const canonicalId = leads.find((l) => !l.is_duplicate)?.id ?? leads[0]?.id ?? "";
      for (const l of leads) {
        if (!l.is_duplicate && l.id !== canonicalId) {
          items.push({ id: l.id, canonicalId });
        }
      }
    }
    return items;
  }, [groups.data]);

  const isAllSelected =
    allResolvable.length > 0 && allResolvable.every((r) => globalSelected.has(r.id));

  function handleGlobalToggleAll() {
    if (isAllSelected) {
      setGlobalSelected(new Map());
    } else {
      const next = new Map<string, string>();
      allResolvable.forEach(({ id, canonicalId }) => next.set(id, canonicalId));
      setGlobalSelected(next);
    }
  }

  const totalGroups = groups.data?.length ?? 0;
  const totalToResolve = allResolvable.length;
  const selectedCount = globalSelected.size;

  return (
    <>
      {showResolved && <ResolvedDuplicatesModal onClose={() => setShowResolved(false)} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>Duplicates</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {totalToResolve > 0 && <Pill tone="warn">{totalToResolve} to resolve</Pill>}
          <button type="button" onClick={() => setShowResolved(true)} style={{ ...S.btnGhost, padding: "6px 14px", fontSize: 12 }}>
            View resolved
          </button>
        </div>
      </div>

      {totalGroups > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          <Stat label="Phone clusters" value={String(totalGroups)} accent="linear-gradient(90deg,#f59e0b,#ef4444)" />
          <Stat label="Leads to resolve" value={String(totalToResolve)} accent="linear-gradient(90deg,#6366f1,#8b5cf6)" />
        </div>
      )}

      {/* Global action bar — only shown when there are groups */}
      {totalGroups > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            type="button"
            onClick={handleGlobalToggleAll}
            style={{ ...S.btnGhost, padding: "5px 13px", fontSize: 12 }}
          >
            {isAllSelected ? "Deselect all" : `Select all (${totalToResolve})`}
          </button>
          {selectedCount > 0 && (
            <>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{selectedCount} selected</span>
              <button
                type="button"
                disabled={merge.isPending}
                onClick={handleMergeGlobalSelected}
                style={{ ...S.btnPrimary, padding: "5px 14px", fontSize: 12, opacity: merge.isPending ? 0.6 : 1 }}
              >
                {merge.isPending ? "Archiving…" : `Archive ${selectedCount} selected`}
              </button>
              <button
                type="button"
                onClick={() => setGlobalSelected(new Map())}
                style={{ ...S.btnGhost, padding: "5px 10px", fontSize: 12 }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {merge.isError && <Banner tone="bad">{(merge.error as Error).message}</Banner>}
      {groups.isLoading && <Empty title="Checking for duplicates…" />}

      {groups.data && groups.data.length === 0 && (
        <Empty
          title="No duplicates found"
          body="All leads have unique phone numbers. Any clusters will appear here automatically."
        />
      )}

      {groups.data && groups.data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.data.map((g) => {
            const groupLeadIds = new Set((g.leads ?? []).map((l) => l.id));
            const selectedInGroup = new Set(
              Array.from(globalSelected.keys()).filter((id) => groupLeadIds.has(id)),
            );
            return (
              <DuplicateGroupCard
                key={g.phone}
                group={g}
                onMergeMany={handleMergeMany}
                merging={merge.isPending}
                selectedLeadIds={selectedInGroup}
                onToggle={toggleLead}
                onSelectGroup={selectGroup}
                onClearGroup={clearGroup}
              />
            );
          })}
        </div>
      )}
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
  const [selectedLead, setSelectedLead] = useState<{ id: string; title: string; score: number } | null>(null);
  const [overrideScore, setOverrideScore] = useState("60");
  const [overrideNotes, setOverrideNotes] = useState("");
  const submitOverride = useMutation({
    mutationFn: () =>
      postAdminGradingOverride({
        lead_id: selectedLead!.id,
        override_score: Number(overrideScore) || 0,
        notes: overrideNotes.trim() || undefined,
      }),
    onSuccess: () => {
      setSelectedLead(null);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>Lead quality</h2>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          Scores are set at ingestion · override any lead from the queue below
        </span>
      </div>

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
          hint="< 50"
          accent="linear-gradient(90deg,#ef4444,#f97316)"
        />
        <Stat
          label="Overrides (7d)"
          value={stats.data ? String(stats.data.manualOverridesCount) : "—"}
        />
      </div>

      {/* Override form — only shown when a lead is selected from the queue */}
      {selectedLead && (
        <div style={{ ...S.card, border: "1px solid rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Override score</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                {selectedLead.title} · current score: <strong style={{ color: "#fff" }}>{selectedLead.score}</strong>
              </div>
            </div>
            <button type="button" style={{ ...S.btnGhost, padding: "4px 11px", fontSize: 12 }} onClick={() => setSelectedLead(null)}>
              Dismiss
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, alignItems: "end" }}>
            <label style={S.label}>
              New score (0–100)
              <input style={S.inp} value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)} />
            </label>
            <label style={S.label}>
              Notes (optional)
              <input style={S.inp} value={overrideNotes} onChange={(e) => setOverrideNotes(e.target.value)} placeholder="Reason for override…" />
            </label>
            <button
              type="button"
              disabled={submitOverride.isPending}
              style={{ ...S.btnPrimary, alignSelf: "flex-end" }}
              onClick={() => submitOverride.mutate()}
            >
              {submitOverride.isPending ? "Saving…" : "Save override"}
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
                Saved · {submitOverride.data.original_score} → {submitOverride.data.override_score}
              </Banner>
            </div>
          )}
        </div>
      )}

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
        <strong style={{ fontFamily: "Manrope, sans-serif", fontSize: 14 }}>Queue filter</strong>
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
                <th style={S.th}>Action</th>
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
                        onClick={() => { setSelectedLead({ id: l.id, title: l.title, score: l.quality_score }); setOverrideScore(String(l.quality_score)); setOverrideNotes(""); }}
                        style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 12 }}
                      >
                        Override score
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
        <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 12 }}>
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

// ---------- Distribution engine ----------

function SettingField({
  label,
  description,
  value,
  onChange,
  suffix,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 9, lineHeight: 1.55 }}>
        {description}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          style={{ ...S.inp, width: 72, textAlign: "right", flexShrink: 0 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>{suffix}</span>
      </div>
    </div>
  );
}

function DistributionTab() {
  const qc = useQueryClient();
  const engine = useQuery({
    queryKey: queryKeys.admin.engine,
    queryFn: getDistributionEngineSettings,
  });
  const metrics = useQuery({ queryKey: queryKeys.admin.metrics, queryFn: getAdminExtendedMetrics });

  const patch = useMutation({
    mutationFn: (body: Partial<{
      queue_paused: boolean;
      max_auto_distribution_runs: number;
      cooldown_minutes_between_runs: number;
      markdown_after_days: number;
      markdown_percent: number;
      early_access_minutes: number;
    }>) => patchDistributionEngineSettings(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.engine });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metrics });
    },
  });

  const e = engine.data;
  const m = metrics.data;
  const isRunning = e != null && !e.queue_paused;

  const [maxRuns, setMaxRuns] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [mdDays, setMdDays] = useState("");
  const [mdPct, setMdPct] = useState("");
  const [earlyAccess, setEarlyAccess] = useState("");

  useEffect(() => {
    if (!e) return;
    setMaxRuns(String(e.max_auto_distribution_runs));
    setCooldown(String(e.cooldown_minutes_between_runs));
    setMdDays(String(e.markdown_after_days));
    setMdPct(String(e.markdown_percent));
    setEarlyAccess(String(e.early_access_minutes));
  }, [e?.updated_at]);

  function handleSave() {
    if (!e) return;
    patch.mutate({
      max_auto_distribution_runs: Number(maxRuns) || e.max_auto_distribution_runs,
      cooldown_minutes_between_runs: Number(cooldown) || e.cooldown_minutes_between_runs,
      markdown_after_days: Number(mdDays) || e.markdown_after_days,
      markdown_percent: Number(mdPct) || e.markdown_percent,
      early_access_minutes: Number(earlyAccess) || e.early_access_minutes,
    });
  }

  // Conversion helpers for display
  const fillRate = m && m.availableLeads !== undefined && m.autoDistributionParticipants !== undefined
    ? m.autoDistributionParticipants > 0
      ? Math.min(100, Math.round((m.autoDistributionParticipants / Math.max(m.availableLeads, 1)) * 100))
      : 0
    : null;

  return (
    <>
      {/* Header row with engine toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>
          Auto-Distribution
        </h2>
        {e && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isRunning ? "#34d399" : "#f59e0b",
                  boxShadow: isRunning ? "0 0 8px #34d399" : "0 0 8px #f59e0b",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: isRunning ? "#34d399" : "#f59e0b",
                }}
              >
                {isRunning ? "Engine running" : "Engine paused"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => patch.mutate({ queue_paused: !e.queue_paused })}
              disabled={patch.isPending}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: isRunning
                  ? "1px solid rgba(245,158,11,0.35)"
                  : "1px solid rgba(52,211,153,0.35)",
                background: isRunning ? "rgba(245,158,11,0.1)" : "rgba(52,211,153,0.1)",
                color: isRunning ? "#f59e0b" : "#34d399",
                fontSize: 13,
                fontWeight: 600,
                cursor: patch.isPending ? "not-allowed" : "pointer",
                opacity: patch.isPending ? 0.6 : 1,
              }}
            >
              {isRunning ? "Pause engine" : "Resume engine"}
            </button>
          </div>
        )}
      </div>

      {engine.isError && <Banner tone="bad">{(engine.error as Error).message}</Banner>}

      {/* Pipeline metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <Stat
          label="Available leads"
          value={m?.availableLeads !== undefined ? String(m.availableLeads) : "—"}
          accent="linear-gradient(90deg,#34d399,#10b981)"
        />
        <Stat
          label="Auto-buy participants"
          value={m?.autoDistributionParticipants !== undefined ? String(m.autoDistributionParticipants) : "—"}
          accent="linear-gradient(90deg,#6366f1,#8b5cf6)"
        />
        <Stat
          label="Active subscriptions"
          value={m?.activeSubscriptions !== undefined ? String(m.activeSubscriptions) : "—"}
          accent="linear-gradient(90deg,#38bdf8,#6366f1)"
        />
        <Stat
          label="Total assignments"
          value={m?.totalAssignments !== undefined ? String(m.totalAssignments) : "—"}
          accent="linear-gradient(90deg,#94a3b8,#64748b)"
        />
      </div>

      {/* Demand pressure indicator */}
      {fillRate !== null && (
        <div style={{ ...S.card, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Pipeline pressure</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                Ratio of active buyers to available leads — higher means more competition per lead
              </div>
            </div>
            <span style={{
              fontSize: 22,
              fontWeight: 700,
              color: fillRate > 80 ? "#34d399" : fillRate > 40 ? "#f59e0b" : "#f87171",
              fontFamily: "Manrope, sans-serif",
            }}>
              {fillRate}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              borderRadius: 3,
              width: `${Math.min(fillRate, 100)}%`,
              background: fillRate > 80
                ? "linear-gradient(90deg,#34d399,#10b981)"
                : fillRate > 40
                ? "linear-gradient(90deg,#f59e0b,#fcd34d)"
                : "linear-gradient(90deg,#f87171,#ef4444)",
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      )}

      {/* Engine settings */}
      {engine.isLoading && <Empty title="Loading settings…" />}
      {e && (
        <div style={S.card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            {/* Left column — throughput */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 18, letterSpacing: "0.04em" }}>
                THROUGHPUT
              </div>
              <SettingField
                label="Max passes per lead"
                description="How many times the engine will attempt to auto-assign a lead before giving up on it."
                value={maxRuns}
                onChange={setMaxRuns}
                suffix="passes"
              />
              <SettingField
                label="Cooldown between passes"
                description="Minimum wait time between distribution attempts for the same lead."
                value={cooldown}
                onChange={setCooldown}
                suffix="minutes"
              />
              <SettingField
                label="Pro early-access window"
                description="Pro subscribers see new leads before Free-plan buyers by this margin."
                value={earlyAccess}
                onChange={setEarlyAccess}
                suffix="minutes"
              />
            </div>

            {/* Right column — price decay */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 18, letterSpacing: "0.04em" }}>
                PRICE DECAY
              </div>
              <SettingField
                label="Markdown starts after"
                description="Leads sitting unsold longer than this will have their price reduced automatically."
                value={mdDays}
                onChange={setMdDays}
                suffix="days"
              />
              <SettingField
                label="Markdown amount"
                description="The price is cut by this percentage once the markdown window opens."
                value={mdPct}
                onChange={setMdPct}
                suffix="% off"
              />

              {/* Current values at a glance */}
              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "12px 14px", marginTop: 4 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Current live values</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Max passes</span>
                    <span style={{ fontWeight: 600 }}>{e.max_auto_distribution_runs}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Cooldown</span>
                    <span style={{ fontWeight: 600 }}>{e.cooldown_minutes_between_runs} min</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Markdown after</span>
                    <span style={{ fontWeight: 600 }}>{e.markdown_after_days} days</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Markdown</span>
                    <span style={{ fontWeight: 600 }}>{e.markdown_percent}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Pro early access</span>
                    <span style={{ fontWeight: 600 }}>{e.early_access_minutes} min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save footer */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 24,
            paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}>
            <button
              type="button"
              disabled={patch.isPending}
              style={{ ...S.btnPrimary, padding: "8px 22px" }}
              onClick={handleSave}
            >
              {patch.isPending ? "Saving…" : "Save settings"}
            </button>
            {patch.isSuccess && (
              <span style={{ fontSize: 12, color: "#34d399" }}>Settings saved</span>
            )}
            {patch.isError && (
              <span style={{ fontSize: 12, color: "#f87171" }}>
                {(patch.error as Error).message}
              </span>
            )}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.22)" }}>
              Last updated {new Date(e.updated_at).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Pricing ----------

function PricingTab() {
  const qc = useQueryClient();
  const engine = useQuery({ queryKey: queryKeys.admin.engine, queryFn: getDistributionEngineSettings });
  const patch = useMutation({
    mutationFn: (body: Partial<{
      markdown_after_days: number;
      markdown_percent: number;
      early_access_minutes: number;
    }>) => patchDistributionEngineSettings(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.admin.engine }),
  });

  const e = engine.data;
  const [days, setDays] = useState("");
  const [pct, setPct] = useState("");
  const [earlyAccess, setEarlyAccess] = useState("");

  useEffect(() => {
    if (!e) return;
    setDays(String(e.markdown_after_days));
    setPct(String(e.markdown_percent));
    setEarlyAccess(String(e.early_access_minutes));
  }, [e?.updated_at]);

  function handleSave() {
    if (!e) return;
    patch.mutate({
      markdown_after_days: Number(days) || e.markdown_after_days,
      markdown_percent: Number(pct) || e.markdown_percent,
      early_access_minutes: Number(earlyAccess) || e.early_access_minutes,
    });
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>Pricing</h2>
        {e && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            Last updated {new Date(e.updated_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {engine.isLoading && <Empty title="Loading pricing settings…" />}

      {e && (
        <>
          {/* Lead lifecycle timeline */}
          <div style={{ ...S.card, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 16, fontWeight: 500 }}>
              LEAD PRICING LIFECYCLE
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* Created */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#818cf8", marginBottom: 8 }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.4 }}>
                  Lead<br />arrives
                </div>
              </div>
              {/* Pro-only segment */}
              <div style={{ flex: 1, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 4px" }}>
                <div style={{ height: 2, width: "100%", background: "linear-gradient(90deg,#8b5cf6,#6366f1)", marginBottom: 8, borderRadius: 1 }} />
                <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>
                  {e.early_access_minutes}m — Pro only
                </div>
              </div>
              {/* Open to all */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", marginBottom: 8 }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.4 }}>
                  Open to<br />all buyers
                </div>
              </div>
              {/* Full-price segment */}
              <div style={{ flex: 2, minWidth: 80, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 4px" }}>
                <div style={{ height: 2, width: "100%", background: "rgba(255,255,255,0.12)", marginBottom: 8, borderRadius: 1 }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center", whiteSpace: "nowrap" }}>
                  {e.markdown_after_days} days at list price
                </div>
              </div>
              {/* Markdown point */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", marginBottom: 8 }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.4 }}>
                  Markdown<br />applied
                </div>
              </div>
              {/* Reduced-price segment */}
              <div style={{ flex: 1, minWidth: 50, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 4px" }}>
                <div style={{ height: 2, width: "100%", background: "linear-gradient(90deg,#f59e0b,#ef4444)", marginBottom: 8, borderRadius: 1 }} />
                <div style={{ fontSize: 10, color: "#fcd34d", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>
                  −{e.markdown_percent}% price
                </div>
              </div>
              {/* End */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#475569", marginBottom: 8 }} />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textAlign: "center", lineHeight: 1.4 }}>
                  Eventually<br />archived
                </div>
              </div>
            </div>
          </div>

          {/* Settings card */}
          <div style={S.card}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              {/* Early access */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 18, letterSpacing: "0.04em" }}>
                  EARLY ACCESS
                </div>
                <SettingField
                  label="Pro early-access window"
                  description="New leads are hidden from Free-plan buyers for this long after arrival — only Pro subscribers can purchase during this window."
                  value={earlyAccess}
                  onChange={setEarlyAccess}
                  suffix="minutes"
                />
              </div>
              {/* Price decay */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 18, letterSpacing: "0.04em" }}>
                  PRICE DECAY
                </div>
                <SettingField
                  label="Markdown starts after"
                  description="Leads sitting unsold on the marketplace longer than this will have their price automatically reduced."
                  value={days}
                  onChange={setDays}
                  suffix="days"
                />
                <SettingField
                  label="Markdown amount"
                  description="The list price is cut by this percentage once the markdown window opens. Applies to both exclusive and non-exclusive prices."
                  value={pct}
                  onChange={setPct}
                  suffix="% off"
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <button
                type="button"
                disabled={patch.isPending}
                style={{ ...S.btnPrimary, padding: "8px 22px" }}
                onClick={handleSave}
              >
                {patch.isPending ? "Saving…" : "Save settings"}
              </button>
              {patch.isSuccess && <span style={{ fontSize: 12, color: "#34d399" }}>Saved</span>}
              {patch.isError && (
                <span style={{ fontSize: 12, color: "#f87171" }}>{(patch.error as Error).message}</span>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------- Wallet ----------

function WalletTab() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [amountDollars, setAmountDollars] = useState("50");
  const [desc, setDesc] = useState("Admin credit");

  const lookup = useMutation({
    mutationFn: () => lookupAdminUserByEmail(email.trim()),
    onSuccess: (u) => {
      setResolvedUserId(u.id);
      setResolvedName(u.full_name || u.email);
      setLookupError(null);
    },
    onError: (e: Error) => {
      setResolvedUserId(null);
      setResolvedName(null);
      setLookupError(e.message);
    },
  });

  const credit = useMutation({
    mutationFn: () =>
      postAdminWalletCredit({
        user_id: resolvedUserId!,
        amount_cents: Math.round(parseFloat(amountDollars) * 100) || 0,
        description: desc,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metrics });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.me });
    },
  });

  const metrics = useQuery({ queryKey: queryKeys.admin.metrics, queryFn: getAdminExtendedMetrics });
  const breakdown = useQuery({ queryKey: queryKeys.admin.metricsBreakdown, queryFn: getAdminMetricsBreakdown });

  return (
    <>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>
        Customer wallets
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Lifetime deposits"
          value={fmtCents(metrics.data?.totalWalletDepositsCents)}
          accent="linear-gradient(90deg,#38bdf8,#6366f1)"
        />
        <Stat
          label="Distinct buyers"
          value={String(metrics.data?.distinctBuyers ?? "—")}
          accent="linear-gradient(90deg,#6366f1,#8b5cf6)"
        />
        <Stat
          label="Pending refund credits"
          value={breakdown.data ? fmtCents(breakdown.data.pendingRefundCreditsCents) : "—"}
          accent="linear-gradient(90deg,#f59e0b,#ef4444)"
        />
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Add credit to a customer</div>

        {/* Lookup row */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: resolvedUserId || lookupError ? 14 : 0 }}>
          <label style={{ ...S.label, flex: 1 }}>
            Customer email
            <input
              style={S.inp}
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setResolvedUserId(null);
                setResolvedName(null);
                setLookupError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && email.trim() && lookup.mutate()}
            />
          </label>
          <button
            type="button"
            style={{ ...S.btnGhost, alignSelf: "flex-end", whiteSpace: "nowrap" }}
            disabled={lookup.isPending || !email.trim()}
            onClick={() => lookup.mutate()}
          >
            {lookup.isPending ? "Looking up…" : "Find customer"}
          </button>
        </div>

        {lookupError && (
          <div style={{ marginBottom: 14 }}>
            <Banner tone="bad">{lookupError}</Banner>
          </div>
        )}

        {/* Found customer chip */}
        {resolvedName && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8, marginBottom: 16 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#34d399" }}>{resolvedName}</span>
            <button
              type="button"
              onClick={() => { setResolvedUserId(null); setResolvedName(null); setEmail(""); }}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 12 }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Credit form — shown once customer is resolved */}
        {resolvedUserId && (
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, alignItems: "end" }}>
            <label style={S.label}>
              Amount ($)
              <input
                style={S.inp}
                type="number"
                min="1"
                step="1"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                placeholder="50"
              />
            </label>
            <label style={S.label}>
              Reason / note
              <input style={S.inp} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={credit.isPending || !amountDollars}
              style={{ ...S.btnPrimary, alignSelf: "flex-end" }}
              onClick={() => credit.mutate()}
            >
              {credit.isPending ? "Applying…" : `Add $${amountDollars || "0"}`}
            </button>
          </div>
        )}

        {credit.isError && (
          <div style={{ marginTop: 12 }}>
            <Banner tone="bad">{(credit.error as Error).message}</Banner>
          </div>
        )}
        {credit.isSuccess && (
          <div style={{ marginTop: 12 }}>
            <Banner tone="good">${amountDollars} added to {resolvedName}&apos;s wallet.</Banner>
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

  const subPlan = plans.data?.find((p) => p.plan_type === "pro");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 18, fontWeight: 700 }}>Subscriptions</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
            Active subscriber health and plan configuration
          </div>
        </div>
        <a
          href="https://dashboard.stripe.com/subscriptions"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...S.btnGhost, textDecoration: "none", fontSize: 12 }}
        >
          Stripe dashboard ↗
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Active subscribers"
          value={String(metrics.data?.activeSubscriptions ?? "—")}
          accent="linear-gradient(90deg,#6366f1,#8b5cf6)"
        />
        <Stat
          label="MRR estimate"
          value={breakdown.data ? fmtCents(breakdown.data.mrrEstimateCents) : "—"}
          accent="linear-gradient(90deg,#10b981,#34d399)"
        />
        <Stat
          label="30-day churn"
          value={churnPct}
          accent={
            breakdown.data && breakdown.data.subscriptionChurn30d.churnRate > 0.1
              ? "linear-gradient(90deg,#ef4444,#f97316)"
              : "linear-gradient(90deg,#f59e0b,#fbbf24)"
          }
        />
      </div>

      <div style={S.card}>
        <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
          Plan editor
        </div>
        {plans.isLoading && <Empty title="Loading…" />}
        {plans.data && !subPlan && (
          <Empty title="Plan not found" body="Run migrations to seed the plan record." />
        )}
        {subPlan && <PlanEditorCard plan={subPlan} />}
      </div>
    </>
  );
}

const PRO_PLAN_CARD_DEFAULT_BULLETS = [
  "Inbound leads — $30 each, up to 5 buyers per lead",
  "Outbound leads — $20 each, up to 3 buyers per lead",
  "Early access to new leads before free buyers",
  "Priority routing and notifications",
] as const;

function normalizeProPlanEditorBullets(plan: AdminSubscriptionPlan): AdminPlanFeatureBullet[] {
  const out: AdminPlanFeatureBullet[] = [];
  const raw = plan.feature_bullets;
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === "string") {
        out.push({ text: x, visible: true });
      } else if (x && typeof x === "object" && "text" in x) {
        out.push({
          text: String((x as AdminPlanFeatureBullet).text),
          visible: (x as AdminPlanFeatureBullet).visible !== false,
        });
      }
    }
  }
  while (out.length < 4) {
    const idx = out.length;
    out.push({
      text: PRO_PLAN_CARD_DEFAULT_BULLETS[idx] ?? "",
      visible: true,
    });
  }
  return out.slice(0, 4);
}

function PlanEditorCard({ plan }: { plan: AdminSubscriptionPlan }) {
  const qc = useQueryClient();
  const [priceStr, setPriceStr] = useState(
    String(Math.round(Number(plan.monthly_price_cents) / 100)),
  );
  const [active, setActive] = useState(plan.is_active);
  const [tagline, setTagline] = useState(plan.tagline ?? "");
  const [bullets, setBullets] = useState<AdminPlanFeatureBullet[]>(() =>
    normalizeProPlanEditorBullets(plan),
  );

  useEffect(() => {
    setPriceStr(String(Math.round(Number(plan.monthly_price_cents) / 100)));
    setActive(plan.is_active);
    setTagline(plan.tagline ?? "");
    setBullets(normalizeProPlanEditorBullets(plan));
  }, [plan.updated_at, plan.plan_type]);

  const patch = useMutation({
    mutationFn: () =>
      patchAdminSubscriptionPlan(plan.plan_type, {
        monthly_price_cents: Math.round((parseFloat(priceStr) || 0) * 100),
        is_active: active,
        tagline,
        feature_bullets: bullets.map((b) => ({ text: b.text.trim(), visible: b.visible })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.plans });
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.plans });
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.me });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metricsBreakdown });
    },
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          plan_type: <span style={{ color: "rgba(255,255,255,0.75)" }}>{plan.plan_type}</span>
        </div>
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          style={{
            ...S.btn,
            background: active ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.06)",
            color: active ? "#6ee7b7" : "rgba(255,255,255,0.4)",
            border: `1px solid ${active ? "rgba(16,185,129,0.28)" : "rgba(255,255,255,0.09)"}`,
            fontSize: 12,
          }}
        >
          {active ? "Active" : "Inactive"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, marginBottom: 16 }}>
        <label style={S.label}>
          Monthly price
          <div style={{ position: "relative" as const }}>
            <span style={{
              position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.38)", fontSize: 13,
            }}>$</span>
            <input
              style={{ ...S.inp, paddingLeft: 22 }}
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="99"
            />
          </div>
        </label>
        <label style={S.label}>
          Tagline
          <input
            style={S.inp}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Shown on buyer subscription page"
          />
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.38)", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>
          Feature bullets
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => {
                  const next = [...bullets];
                  next[i] = { ...next[i], visible: !next[i].visible };
                  setBullets(next);
                }}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer",
                  background: b.visible ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
                  color: b.visible ? "#a5b4fc" : "rgba(255,255,255,0.2)",
                  fontSize: 11, fontWeight: 700,
                }}
              >
                {b.visible ? "on" : "off"}
              </button>
              <input
                style={{ ...S.inp, opacity: b.visible ? 1 : 0.35 }}
                value={b.text}
                onChange={(e) => {
                  const next = [...bullets];
                  next[i] = { ...next[i], text: e.target.value };
                  setBullets(next);
                }}
                placeholder={`Bullet ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          style={S.btnPrimary}
          disabled={patch.isPending}
          onClick={() => patch.mutate()}
        >
          {patch.isPending ? "Saving…" : "Save"}
        </button>
        {patch.isSuccess && <span style={{ fontSize: 12, color: "#6ee7b7" }}>Saved</span>}
        {patch.isError && <span style={{ fontSize: 12, color: "#fca5a5" }}>{(patch.error as Error).message}</span>}
      </div>
    </div>
  );
}

// ---------- Customer accounts ----------

const USERS_PAGE_SIZE = 10;

function UserDetailModal({ user, onClose, onToggleActive }: {
  user: AdminUserRow;
  onClose: () => void;
  onToggleActive: (u: AdminUserRow) => void;
}) {
  const toggle = useMutation({
    mutationFn: () => patchAdminUserActive(user.id, !user.is_active),
    onSuccess: (updated) => onToggleActive({ ...user, is_active: updated.is_active }),
  });

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#0f1221",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 16,
        padding: 28,
        width: "100%",
        maxWidth: 520,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 17, fontWeight: 700 }}>
              {user.full_name || user.email}
            </div>
            {user.full_name && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{user.email}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ ...S.btn, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
          {[
            { label: "Role", value: user.role },
            { label: "Status", value: user.is_active ? "Active" : "Disabled", color: user.is_active ? "#6ee7b7" : "#fca5a5" },
            { label: "Company", value: user.company_name || "—" },
            { label: "Phone", value: user.phone || "—" },
            { label: "Email verified", value: user.email_verified ? "Yes" : "No" },
            { label: "Dist. locked", value: user.distribution_locked ? "Yes" : "No" },
            { label: "Onboarding", value: user.onboarding_completed ? "Complete" : "Pending" },
            { label: "Joined", value: new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>
                {label}
              </div>
              <div style={{ fontSize: 13, color: color || "rgba(255,255,255,0.8)" }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} style={S.btnGhost}>Close</button>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate()}
            style={{
              ...S.btn,
              background: user.is_active ? "rgba(239,68,68,0.18)" : "rgba(16,185,129,0.18)",
              color: user.is_active ? "#fca5a5" : "#6ee7b7",
              border: `1px solid ${user.is_active ? "rgba(239,68,68,0.28)" : "rgba(16,185,129,0.28)"}`,
            }}
          >
            {toggle.isPending ? "Saving…" : user.is_active ? "Disable login" : "Enable login"}
          </button>
        </div>
        {toggle.isError && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#fca5a5", textAlign: "right" as const }}>
            {(toggle.error as Error).message}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersSection() {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  const users = useQuery({
    queryKey: ["admin", "users", offset, dateFrom, dateTo],
    queryFn: () => getAdminUsers({
      limit: USERS_PAGE_SIZE,
      offset,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
  });

  const total = users.data?.total ?? 0;
  const list = users.data?.users ?? [];
  const hasPrev = offset > 0;
  const hasNext = offset + USERS_PAGE_SIZE < total;

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 14, fontWeight: 700 }}>
          Registered users
          {users.data && (
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.38)", marginLeft: 8 }}>
              {total} total
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
            style={{ ...S.inp, width: 140, fontSize: 12 }}
          />
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
            style={{ ...S.inp, width: 140, fontSize: 12 }}
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(""); setDateTo(""); setOffset(0); }}
              style={{ ...S.btnGhost, fontSize: 12 }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {users.isLoading && <Empty title="Loading…" />}
      {users.data && list.length === 0 && <Empty title="No users found" />}
      {list.length > 0 && (
        <>
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr style={{ textAlign: "left" as const }}>
                  <th style={S.th}>Name / Email</th>
                  <th style={S.th}>Role</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={S.td}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{u.full_name || u.email}</div>
                      {u.full_name && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{u.email}</div>
                      )}
                    </td>
                    <td style={S.td}>
                      <Pill tone={u.role === "admin" ? "info" : "default"}>{u.role}</Pill>
                    </td>
                    <td style={S.td}>
                      <Pill tone={u.is_active ? "good" : "bad"}>{u.is_active ? "active" : "disabled"}</Pill>
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                      {new Date(u.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              {offset + 1}–{Math.min(offset + USERS_PAGE_SIZE, total)} of {total}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={S.btnGhost}
                disabled={!hasPrev}
                onClick={() => setOffset((o) => Math.max(0, o - USERS_PAGE_SIZE))}
              >
                Prev
              </button>
              <button
                type="button"
                style={S.btnGhost}
                disabled={!hasNext}
                onClick={() => setOffset((o) => o + USERS_PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleActive={(updated) => {
            setSelectedUser(updated);
            void qc.invalidateQueries({ queryKey: ["admin", "users"] });
          }}
        />
      )}
    </div>
  );
}

function CustomersTab() {
  const refunds = useQuery({
    queryKey: queryKeys.admin.refundRequests,
    queryFn: getAdminRefundRequests,
  });
  const [lockEmail, setLockEmail] = useState("");
  const [lockResolved, setLockResolved] = useState<{ id: string; name: string } | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  const lockLookup = useMutation({
    mutationFn: () => lookupAdminUserByEmail(lockEmail.trim()),
    onSuccess: (u) => {
      setLockResolved({ id: u.id, name: u.full_name || u.email });
      setLockError(null);
    },
    onError: (e: Error) => {
      setLockResolved(null);
      setLockError(e.message);
    },
  });

  const distLock = useMutation({
    mutationFn: (locked: boolean) => patchAdminUserDistributionLock(lockResolved!.id, { locked }),
  });

  return (
    <>
      {/* Distribution lock */}
      <div style={S.card}>
        <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          Distribution lock
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginBottom: 14 }}>
          Prevent a buyer from changing their auto-distribution rules. They can still browse and buy manually.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" as const, marginBottom: 10 }}>
          <label style={{ ...S.label, flex: 1, minWidth: 220 }}>
            Customer email
            <input
              style={S.inp}
              type="email"
              placeholder="buyer@example.com"
              value={lockEmail}
              onChange={(e) => { setLockEmail(e.target.value); setLockResolved(null); setLockError(null); }}
              onKeyDown={(e) => e.key === "Enter" && lockEmail.trim() && lockLookup.mutate()}
            />
          </label>
          <button
            type="button"
            style={{ ...S.btnGhost, alignSelf: "flex-end" }}
            disabled={lockLookup.isPending || !lockEmail.trim()}
            onClick={() => lockLookup.mutate()}
          >
            {lockLookup.isPending ? "Looking up…" : "Find"}
          </button>
        </div>

        {lockError && <div style={{ marginBottom: 10 }}><Banner tone="bad">{lockError}</Banner></div>}
        {lockResolved && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 8, padding: "6px 12px", fontSize: 13, color: "#6ee7b7",
            }}>
              {lockResolved.name}
            </span>
            <button
              type="button"
              style={{ ...S.btn, background: "rgba(245,158,11,0.18)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.28)" }}
              disabled={distLock.isPending}
              onClick={() => distLock.mutate(true)}
            >
              Lock
            </button>
            <button
              type="button"
              style={{ ...S.btn, background: "rgba(16,185,129,0.18)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.28)" }}
              disabled={distLock.isPending}
              onClick={() => distLock.mutate(false)}
            >
              Unlock
            </button>
            {distLock.isSuccess && (
              <span style={{ fontSize: 12, color: "#6ee7b7" }}>
                {distLock.data?.distribution_locked ? "Locked" : "Unlocked"}
              </span>
            )}
          </div>
        )}
        {distLock.isError && <div style={{ marginTop: 10 }}><Banner tone="bad">{(distLock.error as Error).message}</Banner></div>}
      </div>

      {/* Refund requests */}
      <div style={S.card}>
        <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
          Refund requests
        </div>
        {refunds.isLoading && <Empty title="Loading…" />}
        {refunds.data && refunds.data.length === 0 && <Empty title="No refund requests" />}
        {refunds.data && refunds.data.length > 0 && (
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr style={{ textAlign: "left" as const }}>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Buyer</th>
                  <th style={S.th}>Lead</th>
                  <th style={S.th}>Amount</th>
                  <th style={S.th}>Reason</th>
                  <th style={S.th}>Date</th>
                  <th style={S.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {refunds.data.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      verticalAlign: "top" as const,
                      opacity: r.status !== "pending" ? 0.65 : 1,
                    }}
                  >
                    <td style={S.td}>
                      <Pill tone={r.status === "pending" ? "warn" : r.status === "approved" ? "good" : "default"}>
                        {r.status === "approved" ? "refunded" : r.status}
                      </Pill>
                    </td>
                    <td style={{ ...S.td, fontSize: 12 }}>{r.buyer.email}</td>
                    <td style={S.td}>
                      <div style={{ fontSize: 13 }}>{r.lead_assignment.lead.title}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{r.lead_assignment.purchase_type}</div>
                    </td>
                    <td style={{ ...S.td, fontFamily: "Manrope, sans-serif", fontWeight: 700 }}>
                      {fmtCents(r.lead_assignment.amount_charged_cents)}
                    </td>
                    <td style={{ ...S.td, maxWidth: 160, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{r.reason}</td>
                    <td style={{ ...S.td, fontSize: 12, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" as const }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={S.td}>
                      {r.status === "pending" ? (
                        <RefundRowActions row={r} />
                      ) : (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                          {r.status === "approved" ? "Wallet credited" : "Rejected"}
                          {r.admin_notes && <div style={{ marginTop: 2, fontStyle: "italic" as const }}>{r.admin_notes}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registered users */}
      <UsersSection />
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
                  <strong style={{ fontFamily: "Manrope, sans-serif", fontSize: 15 }}>{it.name}</strong>
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

// ---------- Resources ----------

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
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 18, fontWeight: 700 }}>Resources</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
          Buyer-facing links, guides, and announcements shown in the resources section
        </div>
      </div>

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
        <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, marginTop: 0, marginBottom: 14 }}>
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
            Type
            <select style={S.inp} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="link">Link</option>
              <option value="video">Video</option>
              <option value="faq">FAQ</option>
              <option value="promo">Announcement</option>
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

// ---------- Outbound buyers (ping/post to external buyer platforms) ----------

function OutboundBuyerForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<OutboundBuyerEndpointDto>;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [pingUrl, setPingUrl] = useState(initial?.ping_url ?? "");
  const [postUrl, setPostUrl] = useState(initial?.post_url ?? "");
  const [authName, setAuthName] = useState(initial?.auth_header_name ?? "");
  const [authValue, setAuthValue] = useState(initial?.auth_header_value ?? "");
  const [fieldMapJson, setFieldMapJson] = useState(
    initial?.field_map ? JSON.stringify(initial.field_map, null, 2) : "{}",
  );
  const [floor, setFloor] = useState(
    initial?.price_floor_cents ? String(Math.round(Number(initial.price_floor_cents) / 100)) : "0",
  );
  const [timeout, setTimeout_] = useState(String(initial?.timeout_ms ?? 3000));
  const [jsonError, setJsonError] = useState<string | null>(null);

  function handleSave() {
    let fieldMap: Record<string, string> = {};
    try {
      fieldMap = JSON.parse(fieldMapJson);
      setJsonError(null);
    } catch {
      setJsonError("Field map is not valid JSON");
      return;
    }
    onSave({
      name,
      ping_url: pingUrl,
      post_url: postUrl.trim() || null,
      auth_header_name: authName.trim() || null,
      auth_header_value: authValue.trim() || null,
      field_map: fieldMap,
      price_floor_cents: Math.round(parseFloat(floor) * 100) || 0,
      timeout_ms: Number(timeout) || 3000,
      is_active: true,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ ...S.label, gridColumn: "1 / -1" }}>
          Buyer name
          <input style={S.inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Lead Buyer" />
        </label>
        <label style={S.label}>
          Ping URL (non-PII — we call this first)
          <input style={S.inp} value={pingUrl} onChange={(e) => setPingUrl(e.target.value)} placeholder="https://buyer.example.com/ping" />
        </label>
        <label style={S.label}>
          Post URL (full data — optional, falls back to ping URL)
          <input style={S.inp} value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://buyer.example.com/post" />
        </label>
        <label style={S.label}>
          Auth header name (e.g. X-Api-Key)
          <input style={S.inp} value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="X-Api-Key" />
        </label>
        <label style={S.label}>
          Auth header value
          <input style={S.inp} type="password" value={authValue} onChange={(e) => setAuthValue(e.target.value)} placeholder="secret" />
        </label>
        <label style={S.label}>
          Minimum bid floor ($)
          <input style={S.inp} type="number" min="0" step="0.01" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="25.00" />
        </label>
        <label style={S.label}>
          Timeout (ms)
          <input style={S.inp} type="number" value={timeout} onChange={(e) => setTimeout_(e.target.value)} placeholder="3000" />
        </label>
        <label style={{ ...S.label, gridColumn: "1 / -1" }}>
          Field mapping (JSON: <code style={{ fontSize: 11 }}>{`{"our_field":"their_field"}`}</code>)
          <textarea
            style={{ ...S.inp, minHeight: 80, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
            value={fieldMapJson}
            onChange={(e) => setFieldMapJson(e.target.value)}
          />
        </label>
      </div>
      {jsonError && <Banner tone="bad">{jsonError}</Banner>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={S.btnPrimary} disabled={saving || !name || !pingUrl} onClick={handleSave}>
          {saving ? "Saving…" : "Save buyer"}
        </button>
        <button type="button" style={S.btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function OutboundBuyersSection() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: string; bid?: number | null; latency?: number; error?: string | null }>>({});

  const buyers = useQuery({ queryKey: queryKeys.admin.outboundBuyers, queryFn: getAdminOutboundBuyers });
  const logs = useQuery({
    queryKey: queryKeys.admin.outboundLogs(),
    queryFn: () => getAdminOutboundPingLogs(50),
  });

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => postAdminOutboundBuyer(data as any),
    onSuccess: () => { setCreating(false); void qc.invalidateQueries({ queryKey: queryKeys.admin.outboundBuyers }); },
  });

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => patchAdminOutboundBuyer(id, data as any),
    onSuccess: () => { setEditId(null); void qc.invalidateQueries({ queryKey: queryKeys.admin.outboundBuyers }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAdminOutboundBuyer(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.admin.outboundBuyers }),
  });

  const testPing = useMutation({
    mutationFn: (id: string) => postAdminOutboundBuyerTestPing(id),
    onSuccess: (result, id) => {
      setTestResults((prev) => ({
        ...prev,
        [id]: { status: result.status, bid: result.bid_price_cents, latency: result.latency_ms, error: result.error },
      }));
      void qc.invalidateQueries({ queryKey: queryKeys.admin.outboundLogs() });
    },
  });

  const statusColor = (s: string) => {
    if (s === "accepted" || s === "posted") return "#10b981";
    if (s === "below_floor") return "#f59e0b";
    if (s === "timeout" || s === "error") return "#ef4444";
    return "#64748b";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 17, margin: 0 }}>Outbound buyers</h3>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: "4px 0 0" }}>
            External platforms we ping when a lead arrives — they respond with a bid, we POST the full lead to the winner.
          </p>
        </div>
        {!creating && (
          <button type="button" style={S.btnPrimary} onClick={() => setCreating(true)}>Add buyer</button>
        )}
      </div>

      {creating && (
        <div style={S.card}>
          <h4 style={{ fontFamily: "Manrope, sans-serif", fontSize: 14, margin: "0 0 14px" }}>New outbound buyer</h4>
          <OutboundBuyerForm
            onSave={(data) => create.mutate(data)}
            onCancel={() => setCreating(false)}
            saving={create.isPending}
          />
          {create.isError && <div style={{ marginTop: 10 }}><Banner tone="bad">{(create.error as Error).message}</Banner></div>}
        </div>
      )}

      {buyers.isLoading && <Empty title="Loading buyers…" />}
      {(buyers.data ?? []).length === 0 && !buyers.isLoading && (
        <Empty title="No outbound buyers configured" body="Add a buyer above to start routing leads via the ping/post protocol." />
      )}

      {(buyers.data ?? []).map((buyer) => (
        <div key={buyer.id} style={S.card}>
          {editId === buyer.id ? (
            <>
              <h4 style={{ fontFamily: "Manrope, sans-serif", fontSize: 14, margin: "0 0 14px" }}>Editing: {buyer.name}</h4>
              <OutboundBuyerForm
                initial={buyer}
                onSave={(data) => patch.mutate({ id: buyer.id, data })}
                onCancel={() => setEditId(null)}
                saving={patch.isPending}
              />
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontFamily: "Manrope, sans-serif", fontSize: 15 }}>{buyer.name}</strong>
                  <Pill tone={buyer.is_active ? "good" : "default"}>{buyer.is_active ? "active" : "paused"}</Pill>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                  Ping: {buyer.ping_url}
                </div>
                {buyer.post_url && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                    Post: {buyer.post_url}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  Floor: ${(Number(buyer.price_floor_cents) / 100).toFixed(2)} · Timeout: {buyer.timeout_ms}ms
                  {buyer.auth_header_name ? ` · Auth: ${buyer.auth_header_name}` : ""}
                </div>
                {testResults[buyer.id] && (
                  <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(0,0,0,0.2)", fontSize: 12 }}>
                    Last test: {" "}
                    <span style={{ color: statusColor(testResults[buyer.id].status), fontWeight: 600 }}>
                      {testResults[buyer.id].status}
                    </span>
                    {testResults[buyer.id].bid != null && ` · bid $${((testResults[buyer.id].bid ?? 0) / 100).toFixed(2)}`}
                    {testResults[buyer.id].latency != null && ` · ${testResults[buyer.id].latency}ms`}
                    {testResults[buyer.id].error && <span style={{ color: "#f87171" }}> · {testResults[buyer.id].error}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{ ...S.btnGhost, padding: "5px 10px", fontSize: 12, color: "#34d399" }}
                  disabled={testPing.isPending}
                  onClick={() => testPing.mutate(buyer.id)}
                >
                  {testPing.isPending && testPing.variables === buyer.id ? "Pinging…" : "Test ping"}
                </button>
                <button type="button" style={{ ...S.btnGhost, padding: "5px 10px", fontSize: 12 }} onClick={() => setEditId(buyer.id)}>Edit</button>
                <button
                  type="button"
                  style={{ ...S.btnGhost, padding: "5px 10px", fontSize: 12, color: "#f87171" }}
                  disabled={del.isPending}
                  onClick={() => { if (confirm(`Delete buyer "${buyer.name}"?`)) del.mutate(buyer.id); }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Ping log */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 15, fontWeight: 600 }}>Recent outbound ping log</span>
          <button type="button" style={{ ...S.btnGhost, fontSize: 12, padding: "4px 10px" }} onClick={() => void qc.invalidateQueries({ queryKey: queryKeys.admin.outboundLogs() })}>Refresh</button>
        </div>
        {logs.isLoading && <div style={{ padding: 16, color: "rgba(255,255,255,0.5)" }}>Loading…</div>}
        {logs.data && logs.data.length === 0 && <Empty title="No outbound pings yet" body="Pings will appear here once a lead arrives or you test a buyer." />}
        {logs.data && logs.data.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "rgba(0,0,0,0.2)" }}>
              <tr>
                <th style={S.th}>When</th>
                <th style={S.th}>Buyer</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Bid</th>
                <th style={S.th}>Floor</th>
                <th style={S.th}>Latency</th>
                <th style={S.th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.map((l: OutboundPingLogRow) => {
                const ep = (buyers.data ?? []).find((b) => b.id === l.buyer_endpoint_id);
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={S.td}>{new Date(l.created_at).toLocaleString()}</td>
                    <td style={S.td}>{ep?.name ?? l.buyer_endpoint_id.slice(0, 8) + "…"}</td>
                    <td style={S.td}>
                      <Pill
                        tone={
                          l.status === "accepted" || l.status === "posted"
                            ? "good"
                            : l.status === "below_floor"
                            ? "warn"
                            : l.status === "timeout" || l.status === "error"
                            ? "bad"
                            : "default"
                        }
                      >
                        {l.status}{l.is_test ? " (test)" : ""}
                      </Pill>
                    </td>
                    <td style={S.td}>{l.bid_price_cents != null ? `$${(Number(l.bid_price_cents) / 100).toFixed(2)}` : "—"}</td>
                    <td style={S.td}>${(Number(l.floor_price_cents) / 100).toFixed(2)}</td>
                    <td style={S.td}>{l.latency_ms != null ? `${l.latency_ms}ms` : "—"}</td>
                    <td style={{ ...S.td, color: "rgba(255,255,255,0.45)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.error_message ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- Vendor pings ----------

function VendorPingsTab() {
  const qc = useQueryClient();
  const vendors = useQuery({ queryKey: queryKeys.admin.vendors, queryFn: getAdminVendors });
  const pings = useQuery({ queryKey: queryKeys.admin.pings, queryFn: () => getAdminPings(75) });
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sources, setSources] = useState("");

  const createVendor = useMutation({
    mutationFn: () =>
      postAdminVendor({
        name,
        api_key: apiKey,
        allowed_sources: sources.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      setName(""); setApiKey(""); setSources(""); setShowAdd(false);
      void qc.invalidateQueries({ queryKey: queryKeys.admin.vendors });
    },
  });

  const toggleVendor = useMutation({
    mutationFn: (vendor: VendorIntegrationDto) =>
      patchAdminVendor(vendor.id, { enabled: !vendor.enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.admin.vendors }),
  });

  const vendorList = vendors.data ?? [];
  const pingList = pings.data ?? [];
  const activeVendors = vendorList.filter((v) => v.enabled).length;
  const matchedPings = pingList.filter((p) => p.matched_buyer != null).length;
  const matchRate = pingList.length > 0 ? Math.round((matchedPings / pingList.length) * 100) : null;
  const avgLatency = pingList.length > 0
    ? Math.round(pingList.reduce((s, p) => s + (p.latency_ms ?? 0), 0) / pingList.length)
    : null;

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: "Manrope, sans-serif" }}>Lead Vendors</h2>
        <button
          type="button"
          style={showAdd ? S.btnGhost : S.btnPrimary}
          onClick={() => setShowAdd((s) => !s)}
        >
          {showAdd ? "Cancel" : "Add vendor"}
        </button>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat
          label="Active vendors"
          value={vendors.isLoading ? "—" : String(activeVendors)}
          accent="linear-gradient(90deg,#34d399,#10b981)"
        />
        <Stat
          label="Match rate"
          value={matchRate !== null ? `${matchRate}%` : "—"}
          accent="linear-gradient(90deg,#6366f1,#8b5cf6)"
        />
        <Stat
          label="Avg response time"
          value={avgLatency !== null ? `${avgLatency}ms` : "—"}
          accent="linear-gradient(90deg,#f59e0b,#ef4444)"
        />
      </div>

      {/* Add vendor form */}
      {showAdd && (
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>New inbound vendor</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={S.label}>
              Vendor name
              <input
                style={S.inp}
                placeholder="e.g. LeadSource Pro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label style={S.label}>
              API key
              <input
                style={S.inp}
                placeholder="Will be hashed and stored"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
          </div>
          <label style={S.label}>
            Allowed sources
            <input
              style={S.inp}
              placeholder="Comma-separated, e.g. web, landing-page-1 (leave blank for all)"
              value={sources}
              onChange={(e) => setSources(e.target.value)}
            />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              style={S.btnPrimary}
              disabled={createVendor.isPending || !name.trim() || !apiKey.trim()}
              onClick={() => createVendor.mutate()}
            >
              {createVendor.isPending ? "Creating…" : "Create vendor"}
            </button>
            <button type="button" style={S.btnGhost} onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
          {createVendor.isError && (
            <div style={{ marginTop: 10 }}>
              <Banner tone="bad">{(createVendor.error as Error).message}</Banner>
            </div>
          )}
        </div>
      )}

      {/* Inbound vendor list */}
      {vendors.isLoading && <Empty title="Loading vendors…" />}
      {vendorList.length === 0 && !vendors.isLoading && (
        <Empty title="No vendors yet" body="Add an inbound vendor to start receiving pings." />
      )}
      {vendorList.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {vendorList.map((vendor) => (
            <div key={vendor.id} style={{ ...S.card, padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: vendor.enabled ? "#34d399" : "#475569",
                      boxShadow: vendor.enabled ? "0 0 7px #34d399" : "none",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{vendor.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>
                      TTL {vendor.ping_ttl_seconds}s · timeout {vendor.ping_timeout_ms}ms
                      {vendor.allowed_sources.length
                        ? ` · sources: ${vendor.allowed_sources.join(", ")}`
                        : " · all sources"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={toggleVendor.isPending}
                  onClick={() => toggleVendor.mutate(vendor)}
                  style={{
                    ...S.btnGhost,
                    padding: "5px 13px",
                    fontSize: 12,
                    color: vendor.enabled ? "#f87171" : "#34d399",
                  }}
                >
                  {vendor.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inbound ping log */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>Inbound ping log</div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            {pingList.length} recent · {matchedPings} matched
          </span>
        </div>
        {pings.isLoading && <Empty title="Loading pings…" />}
        {!pings.isLoading && pingList.length === 0 && <Empty title="No vendor pings yet" />}
        {pingList.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780, fontSize: 12 }}>
              <thead style={{ background: "rgba(0,0,0,0.2)" }}>
                <tr>
                  {["Time", "Vendor", "Market", "Type", "Status", "Matched buyer", "Price", "Latency"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pingList.map((row: AdminPingRow) => {
                  const isMatch = row.matched_buyer != null;
                  const isRejected = !!row.rejection_reason;
                  return (
                    <tr key={row.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={S.td}>{fmtShortDate(row.created_at)}</td>
                      <td style={S.td}>{row.vendor?.name ?? "—"}</td>
                      <td style={S.td}>
                        {row.market || [row.city, row.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td style={S.td}>{row.lead_type}</td>
                      <td style={S.td}>
                        <Pill tone={isMatch ? "good" : isRejected ? "bad" : "default"}>
                          {row.status}
                        </Pill>
                      </td>
                      <td style={{ ...S.td, color: isMatch ? "#fff" : "rgba(255,255,255,0.3)" }}>
                        {row.matched_buyer?.email ?? "—"}
                      </td>
                      <td style={S.td}>
                        {row.matched_price_cents ? fmtCents(row.matched_price_cents) : "—"}
                      </td>
                      <td style={S.td}>
                        {row.latency_ms != null ? `${row.latency_ms}ms` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OutboundBuyersSection />
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
