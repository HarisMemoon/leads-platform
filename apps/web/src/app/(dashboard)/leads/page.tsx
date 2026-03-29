"use client";

import { Suspense, useCallback, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  ClipboardList,
  Download,
  Filter,
  Loader2,
  MapPin,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { getLeadDetail, getMyLeads, type MyLeadRow } from "@/lib/leads-api";
import { queryKeys } from "@/lib/query-keys";
import { LeadDetailModal, exclusivityLabel } from "@/components/LeadDetailModal";

const LIMIT = 20;

function centsToDollars(cents: string) {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function formatPurchasedAt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function csvEscape(cell: string | number): string {
  const s = String(cell);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function purchaseTypeLabel(pt: MyLeadRow["purchase_type"]): string {
  if (pt === "auto_buy") return "Auto-buy";
  if (pt === "manual") return "Manual";
  if (pt === "subscription_distribution") return "Subscription";
  return pt;
}

function PurchaseTypeBadge({ pt }: { pt: MyLeadRow["purchase_type"] }) {
  const isAuto = pt === "auto_buy";
  const isSub = pt === "subscription_distribution";
  if (isAuto) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, fontWeight: 600, padding: "3px 10px",
        borderRadius: 999,
        background: "rgba(20,184,166,0.15)", color: "#5eead4",
        border: "1px solid rgba(20,184,166,0.3)",
      }}>
        <Bot size={10} aria-hidden /> Auto-buy
      </span>
    );
  }
  if (isSub) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, fontWeight: 600, padding: "3px 10px",
        borderRadius: 999,
        background: "rgba(99,102,241,0.15)", color: "#c4b5fd",
        border: "1px solid rgba(99,102,241,0.3)",
      }}>
        <Sparkles size={10} aria-hidden /> Subscription
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "3px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(255,255,255,0.1)",
    }}>
      <ShoppingBag size={10} aria-hidden /> Manual
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    available: { bg: "rgba(34,197,94,0.12)", color: "#86efac", border: "rgba(34,197,94,0.25)" },
    sold:      { bg: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "rgba(99,102,241,0.25)" },
    distributed: { bg: "rgba(20,184,166,0.12)", color: "#5eead4", border: "rgba(20,184,166,0.25)" },
    archived:  { bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "rgba(255,255,255,0.1)" },
  };
  const c = cfg[status] ?? cfg.archived;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      textTransform: "capitalize",
    }}>
      {status}
    </span>
  );
}

function ExclusivityBadge({ ex }: { ex: string }) {
  const label = exclusivityLabel(ex as Parameters<typeof exclusivityLabel>[0]);
  const isEx = ex === "exclusive";
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
      background: isEx ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
      color: isEx ? "#fcd34d" : "rgba(255,255,255,0.45)",
      border: isEx ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.09)",
    }}>
      {label}
    </span>
  );
}

function parsePage(raw: string | null): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function downloadLeadsCsv(rows: MyLeadRow[]) {
  const headers = ["Date purchased", "Market", "Type", "Exclusivity", "Price paid", "Purchase type", "Status"];
  const dataRows = rows.map((r) => [
    formatPurchasedAt(r.assigned_at), r.market, r.type,
    exclusivityLabel(r.exclusivity), centsToDollars(r.charged_amount),
    purchaseTypeLabel(r.purchase_type), r.status,
  ]);
  const csv = [headers, ...dataRows].map((line) => line.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-leads-page-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Mini Sparkline ──────────────────────────────────────────────────────────
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const vals = values.length < 2 ? [0, ...values, 0] : values;
  const min = Math.min(...vals);
  const max = Math.max(...vals, 1);
  const range = max - min || 1;
  const w = 80; const h = 32;
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible", display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  icon,
  iconBg,
  label,
  value,
  sub,
  trend,
  sparkValues,
  sparkColor,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  trend?: { up: boolean; label: string };
  sparkValues?: number[];
  sparkColor?: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.028)",
      border: "1px solid rgba(255,255,255,0.065)",
      borderRadius: 16,
      padding: 20,
      position: "relative",
      overflow: "hidden",
      transition: "border-color 0.2s, transform 0.2s",
    }}
      className="stat-card-hover"
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: iconBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14,
          }}>
            {icon}
          </div>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: -1, color: "#fff", lineHeight: 1, marginBottom: 5 }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginBottom: sub ? 6 : 0 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{sub}</div>}
          {trend && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8,
              fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 100,
              background: trend.up ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              color: trend.up ? "#6ee7b7" : "#fca5a5",
            }}>
              {trend.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {trend.label}
            </div>
          )}
        </div>
        {sparkValues && sparkColor && (
          <div style={{ opacity: 0.7 }}>
            <MiniSparkline values={sparkValues} color={sparkColor} />
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  fontSize: 13,
  minWidth: 140,
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
};

const inputDateStyle: CSSProperties = {
  ...selectStyle,
  minWidth: 160,
  colorScheme: "dark",
};

function LeadsHistoryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const page = parsePage(searchParams.get("page"));
  const purchaseTypeParam = searchParams.get("purchaseType") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const purchaseType: "auto_buy" | "manual" | undefined =
    purchaseTypeParam === "auto_buy" ? "auto_buy" : purchaseTypeParam === "manual" ? "manual" : undefined;
  const status =
    statusParam === "available" || statusParam === "sold" || statusParam === "distributed" || statusParam === "archived"
      ? statusParam : undefined;

  const hasActiveFilters = !!(purchaseType || status || dateFrom || dateTo);
  const activeFilterCount = [purchaseType, status, dateFrom, dateTo].filter(Boolean).length;

  const queryOpts = useMemo(() => ({
    page, limit: LIMIT,
    ...(purchaseType ? { purchaseType } : {}),
    ...(status ? { status } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }), [page, purchaseType, status, dateFrom, dateTo]);

  const setSearch = useCallback((updates: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.replace(qs ? `/leads?${qs}` : "/leads", { scroll: false });
  }, [router, searchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.leads.my(queryOpts),
    queryFn: () => getMyLeads(queryOpts),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: selectedLeadId ? queryKeys.leads.detail(selectedLeadId) : ["leads", "detail", "none"],
    queryFn: () => getLeadDetail(selectedLeadId!),
    enabled: !!selectedLeadId,
  });

  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const clearFilters = () => router.replace("/leads", { scroll: false });

  // Compute stats from items
  const totalSpent = items.reduce((s, r) => s + Number(r.charged_amount), 0);
  const avgPrice = items.length > 0 ? totalSpent / items.length : 0;
  const exclusiveCount = items.filter((r) => r.exclusivity === "exclusive").length;

  // Sparkline: lead count per recent day (dummy based on items)
  const sparkData = useMemo(() => {
    if (items.length === 0) return [0, 0, 0, 0, 0, 0, 0];
    const map: Record<string, number> = {};
    items.forEach((r) => {
      const d = formatDateShort(r.assigned_at);
      map[d] = (map[d] ?? 0) + 1;
    });
    return Object.values(map).slice(-7);
  }, [items]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        .stat-card-hover:hover { border-color: rgba(255,255,255,0.12) !important; transform: translateY(-2px); }
        .leads-row:hover { background: rgba(99,102,241,0.07) !important; }
        .leads-row { transition: background 0.12s; cursor: pointer; }
        .filter-select:focus { border-color: rgba(99,102,241,0.5) !important; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        .pg-btn:hover:not(:disabled) { background: rgba(99,102,241,0.15) !important; border-color: rgba(99,102,241,0.35) !important; color: #c4b5fd !important; }
        .pg-btn:disabled { opacity: 0.35 !important; cursor: not-allowed !important; }
        .dl-btn:hover:not(:disabled) { background: rgba(99,102,241,0.2) !important; border-color: rgba(99,102,241,0.4) !important; }
        .filter-toggle-btn:hover { background: rgba(255,255,255,0.07) !important; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080a0f", color: "#fff", fontFamily: "DM Sans, sans-serif" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 72px" }}>

          {/* ── Header ── */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28, animation: "fadeUp 0.4s ease both" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.2))", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ClipboardList size={18} color="#a5b4fc" aria-hidden />
                </div>
                <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, margin: 0, background: "linear-gradient(135deg,#fff 40%,rgba(255,255,255,0.55))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Lead History
                </h1>
              </div>
              <p style={{ color: "rgba(255,255,255,0.38)", margin: 0, fontSize: 14 }}>
                {total > 0 ? `${total} purchased lead${total !== 1 ? "s" : ""} · click any row for details` : "Your purchased leads will appear here"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                className="filter-toggle-btn"
                onClick={() => setFilterOpen((o) => !o)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 16px", borderRadius: 10,
                  border: `1px solid ${hasActiveFilters ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.1)"}`,
                  background: hasActiveFilters ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.04)",
                  color: hasActiveFilters ? "#c4b5fd" : "rgba(255,255,255,0.55)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Filter size={14} aria-hidden />
                Filters
                {activeFilterCount > 0 && (
                  <span style={{ background: "rgba(99,102,241,0.4)", color: "#c4b5fd", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="dl-btn"
                disabled={items.length === 0}
                onClick={() => downloadLeadsCsv(items)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 16px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: items.length === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
                  fontSize: 13, fontWeight: 600, cursor: items.length === 0 ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Download size={14} strokeWidth={2} aria-hidden />
                Export CSV
              </button>
            </div>
          </div>

          {/* ── Stats row (only if data loaded) ── */}
          {!isLoading && total > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24, animation: "fadeUp 0.4s ease 0.05s both" }}>
              <StatCard
                icon={<ClipboardList size={16} color="#a5b4fc" aria-hidden />}
                iconBg="rgba(99,102,241,0.2)"
                label="Total leads"
                value={String(total)}
                sparkValues={sparkData}
                sparkColor="#6366f1"
              />
              <StatCard
                icon={<CircleDollarSign size={16} color="#6ee7b7" aria-hidden />}
                iconBg="rgba(16,185,129,0.2)"
                label="Total spent (page)"
                value={`$${(totalSpent / 100).toFixed(0)}`}
                sub={`avg $${(avgPrice / 100).toFixed(2)}/lead`}
                sparkValues={items.map((r) => Number(r.charged_amount) / 100)}
                sparkColor="#10b981"
              />
              <StatCard
                icon={<Zap size={16} color="#fcd34d" aria-hidden />}
                iconBg="rgba(245,158,11,0.2)"
                label="Exclusive leads"
                value={String(exclusiveCount)}
                sub={`${items.length > 0 ? Math.round((exclusiveCount / items.length) * 100) : 0}% of page`}
              />
              <StatCard
                icon={<Bot size={16} color="#5eead4" aria-hidden />}
                iconBg="rgba(20,184,166,0.2)"
                label="Auto-buy leads"
                value={String(items.filter((r) => r.purchase_type === "auto_buy").length)}
                sub="on this page"
              />
            </div>
          )}

          {/* ── Filter panel ── */}
          {filterOpen && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end",
              marginBottom: 20, padding: "18px 20px",
              borderRadius: 14,
              border: "1px solid rgba(99,102,241,0.2)",
              background: "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.03) 100%)",
              animation: "fadeUp 0.25s ease both",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 4 }}>
                <Filter size={13} color="#a78bfa" aria-hidden />
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Filter leads</span>
                {hasActiveFilters && (
                  <button type="button" onClick={clearFilters} style={{
                    marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer",
                  }}>
                    <X size={11} /> Clear all
                  </button>
                )}
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Purchase type
                <div style={{ position: "relative" }}>
                  <select value={purchaseTypeParam} className="filter-select" style={selectStyle}
                    onChange={(e) => setSearch({ purchaseType: e.target.value || null, page: "1" })}>
                    <option value="">All types</option>
                    <option value="auto_buy">Auto-buy</option>
                    <option value="manual">Manual</option>
                  </select>
                  <Tag size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
                </div>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Status
                <select value={statusParam} className="filter-select" style={selectStyle}
                  onChange={(e) => setSearch({ status: e.target.value || null, page: "1" })}>
                  <option value="">All statuses</option>
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="distributed">Distributed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                From date
                <input type="date" value={dateFrom} className="filter-select" style={inputDateStyle}
                  onChange={(e) => setSearch({ dateFrom: e.target.value || null, page: "1" })} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                To date
                <input type="date" value={dateTo} className="filter-select" style={inputDateStyle}
                  onChange={(e) => setSearch({ dateTo: e.target.value || null, page: "1" })} />
              </label>
            </div>
          )}

          {/* ── Content ── */}
          {isLoading ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
              padding: "80px 0",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Loader2 size={24} color="#a5b4fc" style={{ animation: "spin 0.9s linear infinite" }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>Loading your leads…</p>
            </div>
          ) : error ? (
            <div style={{
              padding: 24, borderRadius: 14,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#fca5a5", fontSize: 14,
            }}>
              {error instanceof Error ? error.message : "Failed to load leads"}
            </div>
          ) : total === 0 && !hasActiveFilters ? (
            <div style={{
              textAlign: "center", padding: "80px 24px",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.03) 100%)",
              animation: "fadeUp 0.4s ease both",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px",
                background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ClipboardList size={28} color="#a5b4fc" aria-hidden />
              </div>
              <p style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10 }}>No leads yet</p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", marginBottom: 24, maxWidth: 320, margin: "0 auto 24px" }}>
                Browse the marketplace to find and purchase your first lead.
              </p>
              <Link href="/marketplace" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 24px", borderRadius: 12,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none",
                boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
                transition: "opacity 0.15s, transform 0.15s",
              }}>
                <Store size={16} aria-hidden />
                Browse marketplace
                <ArrowUpRight size={14} aria-hidden />
              </Link>
            </div>
          ) : items.length === 0 ? (
            <div style={{
              textAlign: "center", padding: 56, borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)",
            }}>
              <Search size={28} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
              <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>No leads match your current filters.</p>
              <button type="button" onClick={clearFilters} style={{
                padding: "10px 20px", borderRadius: 10,
                border: "1px solid rgba(99,102,241,0.35)",
                background: "rgba(99,102,241,0.1)",
                color: "#c4b5fd", cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* Table */}
              <div style={{
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                overflow: "hidden",
                background: "rgba(255,255,255,0.02)",
                animation: "fadeUp 0.4s ease 0.1s both",
              }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.025)" }}>
                        {["Date purchased", "Market", "Lead type", "Exclusivity", "Price paid", "Purchase type", "Status"].map((h) => (
                          <th key={h} style={{
                            textAlign: "left", padding: "13px 16px",
                            fontSize: 11, fontWeight: 600,
                            color: "rgba(255,255,255,0.38)",
                            textTransform: "uppercase", letterSpacing: "0.07em",
                            borderBottom: "1px solid rgba(255,255,255,0.07)",
                            whiteSpace: "nowrap",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row, i) => (
                        <tr
                          key={`${row.lead_id}-${row.assignment_id}`}
                          className="leads-row"
                          onClick={() => setSelectedLeadId(row.lead_id)}
                          style={{
                            borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                            animation: `fadeUp 0.35s ease ${0.05 * Math.min(i, 8)}s both`,
                          }}
                        >
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                            {formatPurchasedAt(row.assigned_at)}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <MapPin size={12} color="rgba(255,255,255,0.3)" aria-hidden />
                              <span style={{ color: "rgba(255,255,255,0.85)" }}>{row.market}</span>
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.75)", textTransform: "capitalize" }}>
                            {row.type?.replace(/_/g, " ")}
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <ExclusivityBadge ex={row.exclusivity} />
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <span style={{
                              fontFamily: "DM Mono, monospace",
                              fontSize: 13, fontWeight: 600,
                              color: "#6ee7b7",
                            }}>
                              {centsToDollars(row.charged_amount)}
                            </span>
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <PurchaseTypeBadge pt={row.purchase_type} />
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 13 }}>
                  Page <span style={{ color: "#fff", fontWeight: 600 }}>{page}</span> of {totalPages} ·{" "}
                  <span style={{ color: "#fff", fontWeight: 600 }}>{total}</span> total leads
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" className="pg-btn" disabled={page <= 1}
                    onClick={() => setSearch({ page: String(Math.max(1, page - 1)) })}
                    style={{
                      padding: "8px 18px", borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 500,
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    ← Previous
                  </button>
                  <div style={{
                    padding: "8px 14px", borderRadius: 10,
                    background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                    color: "#c4b5fd", fontSize: 13, fontWeight: 600,
                  }}>
                    {page} / {totalPages}
                  </div>
                  <button type="button" className="pg-btn" disabled={page >= totalPages}
                    onClick={() => setSearch({ page: String(page + 1) })}
                    style={{
                      padding: "8px 18px", borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 500,
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <LeadDetailModal
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        detail={detail}
        detailLoading={detailLoading}
        purchaseActions={false}
      />
    </>
  );
}

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#080a0f", gap: 16,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Loader2 size={22} color="#a5b4fc" style={{ animation: "spin 0.9s linear infinite" }} />
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontFamily: "DM Sans, sans-serif", fontSize: 14, margin: 0 }}>
            Loading leads…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <LeadsHistoryInner />
    </Suspense>
  );
}
