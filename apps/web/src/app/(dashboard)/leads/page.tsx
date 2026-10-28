"use client";

import {
  Suspense,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
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
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { getLeadDetail, getMyLeads, type MyLeadRow } from "@/lib/leads-api";
import { queryKeys } from "@/lib/query-keys";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import { CustomSelect } from "@/components/CustomSelect";

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

const TRACKED_PHASES = [
  { value: "open", label: "Open" },
  { value: "contacted", label: "Contacted" },
  { value: "under_contract", label: "Under contract" },
  { value: "closed_won", label: "Closed" },
] as const;
type TrackedPhase = (typeof TRACKED_PHASES)[number]["value"];

function phaseLabel(phase?: string | null) {
  return TRACKED_PHASES.find((p) => p.value === phase)?.label ?? "Open";
}

function purchaseTypeLabel(type: MyLeadRow["purchase_type"]) {
  const labels: Record<MyLeadRow["purchase_type"], string> = {
    auto_buy: "Auto-buy",
    manual: "Marketplace",
    subscription_distribution: "Subscription",
    vendor_ping: "Vendor ping",
  };
  return labels[type] ?? type;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    open: {
      bg: "rgba(99,102,241,0.12)",
      color: "#a5b4fc",
      border: "rgba(99,102,241,0.25)",
    },
    contacted: {
      bg: "rgba(20,184,166,0.12)",
      color: "#5eead4",
      border: "rgba(20,184,166,0.25)",
    },
    under_contract: {
      bg: "rgba(245,158,11,0.12)",
      color: "#fcd34d",
      border: "rgba(245,158,11,0.25)",
    },
    closed_won: {
      bg: "rgba(34,197,94,0.12)",
      color: "#86efac",
      border: "rgba(34,197,94,0.25)",
    },
  };
  const c = cfg[status] ?? cfg.open;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      {phaseLabel(status)}
    </span>
  );
}

function parsePage(raw: string | null): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function downloadLeadsCsv(rows: MyLeadRow[]) {
  const headers = [
    "Date purchased",
    "Market",
    "Lead type",
    "Source",
    "Status",
    "Contract price",
    "Sell price",
    "CRM sync",
    "GHL sync",
  ];
  const dataRows = rows.map((r) => [
    formatPurchasedAt(r.assigned_at),
    r.market,
    r.type,
    purchaseTypeLabel(r.purchase_type),
    phaseLabel(r.lifecycle_phase),
    r.contract_price_cents ? centsToDollars(r.contract_price_cents) : "",
    r.sell_price_cents ? centsToDollars(r.sell_price_cents) : "",
    r.crm_sync_status,
    r.ghl_sync_status,
  ]);
  const csv = [headers, ...dataRows]
    .map((line) => line.map(csvEscape).join(","))
    .join("\n");
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
  const w = 80;
  const h = 32;
  const points = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible", display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
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
    <div
      style={{
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
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: iconBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            {icon}
          </div>
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: -1,
              color: "#fff",
              lineHeight: 1,
              marginBottom: 5,
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.38)",
              marginBottom: sub ? 6 : 0,
            }}
          >
            {label}
          </div>
          {sub && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
              {sub}
            </div>
          )}
          {trend && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 8,
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 8px",
                borderRadius: 100,
                background: trend.up
                  ? "rgba(16,185,129,0.1)"
                  : "rgba(239,68,68,0.1)",
                color: trend.up ? "#6ee7b7" : "#fca5a5",
              }}
            >
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
  const [selectedRow, setSelectedRow] = useState<MyLeadRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const page = parsePage(searchParams.get("page"));
  const lifecycleParam = searchParams.get("lifecyclePhase") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const lifecyclePhase: TrackedPhase | undefined =
    lifecycleParam === "open" ||
    lifecycleParam === "contacted" ||
    lifecycleParam === "under_contract" ||
    lifecycleParam === "closed_won"
      ? lifecycleParam
      : undefined;

  const hasActiveFilters = !!(lifecyclePhase || dateFrom || dateTo);
  const activeFilterCount = [lifecyclePhase, dateFrom, dateTo].filter(
    Boolean,
  ).length;

  const queryOpts = useMemo(
    () => ({
      page,
      limit: LIMIT,
      ...(lifecyclePhase ? { lifecyclePhase } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }),
    [page, lifecyclePhase, dateFrom, dateTo],
  );

  const setSearch = useCallback(
    (updates: Record<string, string | null>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      router.replace(qs ? `/leads?${qs}` : "/leads", { scroll: false });
    },
    [router, searchParams],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.leads.my(queryOpts),
    queryFn: () => getMyLeads(queryOpts),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: selectedLeadId
      ? queryKeys.leads.detail(selectedLeadId)
      : ["leads", "detail", "none"],
    queryFn: () => getLeadDetail(selectedLeadId!),
    enabled: !!selectedLeadId,
  });

  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const clearFilters = () => router.replace("/leads", { scroll: false });

  const openCount = items.filter(
    (r) => (r.lifecycle_phase ?? "open") === "open",
  ).length;
  const contactedCount = items.filter(
    (r) => r.lifecycle_phase === "contacted",
  ).length;
  const underContractCount = items.filter(
    (r) => r.lifecycle_phase === "under_contract",
  ).length;
  const closedCount = items.filter(
    (r) => r.lifecycle_phase === "closed_won",
  ).length;

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
        /* ── My Leads Header ── */
.leads-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.leads-page-header-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* =========================================
   LEADS PAGE HEADER
   ========================================= */
.leads-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.leads-page-title {
  font-family: 'Manrope', sans-serif;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 0;
  background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.leads-page-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
  flex-wrap: wrap;
}

.leads-page-count {
  color: rgba(255, 255, 255, 0.75);
  font-weight: 600;
}

.dot-separator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.leads-page-hint {
  color: rgba(255, 255, 255, 0.45);
}

/* ── Action Buttons ── */
.leads-page-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.leads-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 10px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  box-sizing: border-box;
  min-height: 38px;
}

/* Filter Button */
.filter-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.16);
}

.filter-btn.active {
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.35);
  color: #c4b5fd;
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.15);
}

.filter-count-badge {
  background: rgba(99, 102, 241, 0.35);
  color: #e0e7ff;
  border-radius: 6px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
}

/* Export Button */
.export-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.export-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.16);
}

.export-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  filter: grayscale(100%);
}

/* =========================================
   FILTER DRAWER CONTAINER
   ========================================= */
.filter-drawer {
  position: relative;
  background: 
    linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.015) 100%),
    rgba(13, 15, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 24px;
  box-shadow: 
    0 16px 40px -10px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  animation: fadeUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Header */
.filter-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.filter-drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: ;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.5);
}

.filter-title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.12);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.22);
}

.filter-clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

/* Grid Layout */
.filter-controls-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 14px;
  align-items: flex-end;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  position: relative;
}

/* CRITICAL: Elevates status field so the custom dropdown menu floats OVER the date inputs */
.filter-field-status {
  z-index: 20;
}

.filter-field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: ;
  color: rgba(255, 255, 255, 0.45);
}

/* Native Date Inputs */
.date-input-wrap {
  width: 100%;
}

.filter-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.09);
  color: #ffffff;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.filter-input:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.16);
}

.filter-input:focus {
  background: rgba(99, 102, 241, 0.06);
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

input[type="date"].filter-input::-webkit-calendar-picker-indicator {
  filter: invert(0.7);
  cursor: pointer;
  margin-right: -2px;
  opacity: 0.65;
  transition: opacity 0.15s ease, filter 0.15s ease;
}

input[type="date"].filter-input:hover::-webkit-calendar-picker-indicator,
input[type="date"].filter-input:focus::-webkit-calendar-picker-indicator {
  opacity: 1;
  filter: invert(0.9);
}



/* =========================================
   RESPONSIVE (Mobile & Tablet)
   ========================================= */
@media (max-width: 768px) {
  .filter-drawer {
    padding: 14px 16px;
  }

  .filter-controls-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

 
} }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#080a0f",
          color: "#fff",
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "32px 24px 72px",
          }}
        >
          {/* ── Header ── */}
          <div className="leads-page-header">
            <div className="leads-page-header-info">
              <h1 className="leads-page-title">My Leads</h1>
              <div className="leads-page-sub">
                <span className="leads-page-count">
                  {total > 0
                    ? `${total} purchased lead${total !== 1 ? "s" : ""}`
                    : "No purchased leads"}
                </span>
                <span className="dot-separator" />
                <span className="leads-page-hint">
                  {total > 0
                    ? "Update status and deal numbers from details"
                    : "Your purchased leads will appear here"}
                </span>
              </div>
            </div>

            <div className="leads-page-actions">
              <button
                type="button"
                className={`leads-action-btn filter-btn ${hasActiveFilters ? "active" : ""}`}
                onClick={() => setFilterOpen((o) => !o)}
              >
                <Filter size={14} aria-hidden="true" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="filter-count-badge">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className="leads-action-btn export-btn"
                disabled={items.length === 0}
                onClick={() => downloadLeadsCsv(items)}
              >
                <Download size={14} strokeWidth={2} aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
          {/* ── Filter panel ── */}
          {filterOpen && (
            <div className="filter-drawer">
              <div className="filter-drawer-header">
                <div className="filter-drawer-title">
                  <div className="filter-title-icon">
                    <Filter size={13} aria-hidden="true" />
                  </div>
                  <span>Filter leads</span>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="filter-clear-btn"
                  >
                    <X size={12} aria-hidden="true" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="filter-controls-grid">
                {/* Status Field */}
                <div className="filter-field filter-field-status">
                  <label htmlFor="filter-status" className="filter-field-label">
                    Status
                  </label>
                  <CustomSelect
                    id="filter-status"
                    value={lifecycleParam || ""}
                    placeholder="All statuses"
                    options={[
                      { value: "", label: "All statuses" },
                      ...TRACKED_PHASES.map((p) => ({
                        value: p.value,
                        label: p.label,
                      })),
                    ]}
                    onChange={(val) =>
                      setSearch({
                        lifecyclePhase: val || null,
                        page: "1",
                      })
                    }
                  />
                </div>

                {/* From Date */}
                <div className="filter-field">
                  <label
                    htmlFor="filter-date-from"
                    className="filter-field-label"
                  >
                    From Date
                  </label>
                  <div className="date-input-wrap">
                    <input
                      id="filter-date-from"
                      type="date"
                      value={dateFrom}
                      className="filter-input"
                      onChange={(e) =>
                        setSearch({
                          dateFrom: e.target.value || null,
                          page: "1",
                        })
                      }
                    />
                  </div>
                </div>

                {/* To Date */}
                <div className="filter-field">
                  <label
                    htmlFor="filter-date-to"
                    className="filter-field-label"
                  >
                    To Date
                  </label>
                  <div className="date-input-wrap">
                    <input
                      id="filter-date-to"
                      type="date"
                      value={dateTo}
                      className="filter-input"
                      onChange={(e) =>
                        setSearch({ dateTo: e.target.value || null, page: "1" })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Stats row (only if data loaded) ── */}
          {!isLoading && total > 0 && (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
              style={{
                animation: "fadeUp 0.4s ease 0.05s both",
              }}
            >
              <StatCard
                icon={<ClipboardList size={16} color="#a5b4fc" aria-hidden />}
                iconBg="rgba(99,102,241,0.2)"
                label="Open"
                value={String(openCount)}
                sparkValues={sparkData}
                sparkColor="#6366f1"
              />
              <StatCard
                icon={<Bot size={16} color="#5eead4" aria-hidden />}
                iconBg="rgba(20,184,166,0.2)"
                label="Contacted"
                value={String(contactedCount)}
              />
              <StatCard
                icon={
                  <CircleDollarSign size={16} color="#fcd34d" aria-hidden />
                }
                iconBg="rgba(245,158,11,0.2)"
                label="Under contract"
                value={String(underContractCount)}
              />
              <StatCard
                icon={<Zap size={16} color="#6ee7b7" aria-hidden />}
                iconBg="rgba(16,185,129,0.2)"
                label="Closed"
                value={String(closedCount)}
              />
            </div>
          )}

          {/* ── Content ── */}
          {isLoading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                padding: "80px 0",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Loader2
                  size={24}
                  color="#a5b4fc"
                  style={{ animation: "spin 0.9s linear infinite" }}
                />
              </div>
              <p
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 14,
                  margin: 0,
                }}
              >
                Loading your leads…
              </p>
            </div>
          ) : error ? (
            <div
              style={{
                padding: 24,
                borderRadius: 14,
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#fca5a5",
                fontSize: 14,
              }}
            >
              {error instanceof Error ? error.message : "Failed to load leads"}
            </div>
          ) : total === 0 && !hasActiveFilters ? (
            <div
              style={{
                textAlign: "center",
                padding: "80px 24px",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.07)",
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.03) 100%)",
                animation: "fadeUp 0.4s ease both",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  margin: "0 auto 20px",
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ClipboardList size={28} color="#a5b4fc" aria-hidden />
              </div>
              <p
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 10,
                }}
              >
                No leads yet
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.38)",
                  marginBottom: 24,
                  maxWidth: 320,
                  margin: "0 auto 24px",
                }}
              >
                Browse the marketplace to find and purchase your first lead.
              </p>
              <Link
                href="/marketplace"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 24px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                  boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
                  transition: "opacity 0.15s, transform 0.15s",
                }}
              >
                <Store size={16} aria-hidden />
                Browse marketplace
                <ArrowUpRight size={14} aria-hidden />
              </Link>
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 56,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <Search
                size={28}
                color="rgba(255,255,255,0.2)"
                style={{ marginBottom: 12 }}
              />
              <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
                No leads match your current filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "1px solid rgba(99,102,241,0.35)",
                  background: "rgba(99,102,241,0.1)",
                  color: "#c4b5fd",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* Table */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.02)",
                  animation: "fadeUp 0.4s ease 0.1s both",
                }}
              >
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: 760,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.025)" }}>
                        {[
                          "Date purchased",
                          "Market",
                          "Lead type",
                          "Source",
                          "Status",
                          "Contract price",
                          "Sell price",
                          "CRM sync",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "13px 16px",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "rgba(255,255,255,0.38)",
                              textTransform: "",
                              letterSpacing: "0.07em",
                              borderBottom: "1px solid rgba(255,255,255,0.07)",
                              whiteSpace: "nowrap",
                            }}
                          >
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
                          onClick={() => {
                            setSelectedLeadId(row.lead_id);
                            setSelectedRow(row);
                          }}
                          style={{
                            borderBottom:
                              i < items.length - 1
                                ? "1px solid rgba(255,255,255,0.05)"
                                : "none",
                            animation: `fadeUp 0.35s ease ${0.05 * Math.min(i, 8)}s both`,
                          }}
                        >
                          <td
                            style={{
                              padding: "13px 16px",
                              fontSize: 13,
                              color: "rgba(255,255,255,0.7)",
                            }}
                          >
                            {formatPurchasedAt(row.assigned_at)}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <MapPin
                                size={12}
                                color="rgba(255,255,255,0.3)"
                                aria-hidden
                              />
                              <span style={{ color: "rgba(255,255,255,0.85)" }}>
                                {row.market}
                              </span>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: "13px 16px",
                              fontSize: 13,
                              color: "rgba(255,255,255,0.75)",
                              textTransform: "capitalize",
                            }}
                          >
                            {row.type?.replace(/_/g, " ")}
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "4px 9px",
                                borderRadius: 999,
                                color:
                                  row.purchase_type === "vendor_ping"
                                    ? "#86efac"
                                    : "#a5b4fc",
                                background:
                                  row.purchase_type === "vendor_ping"
                                    ? "rgba(34,197,94,0.1)"
                                    : "rgba(99,102,241,0.1)",
                                border: `1px solid ${row.purchase_type === "vendor_ping" ? "rgba(34,197,94,0.22)" : "rgba(99,102,241,0.22)"}`,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {purchaseTypeLabel(row.purchase_type)}
                            </span>
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <StatusBadge
                              status={row.lifecycle_phase ?? "open"}
                            />
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <span
                              style={{
                                fontFamily: "DM Mono, monospace",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "rgba(255,255,255,0.78)",
                              }}
                            >
                              {row.contract_price_cents
                                ? centsToDollars(row.contract_price_cents)
                                : "—"}
                            </span>
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <span
                              style={{
                                fontFamily: "DM Mono, monospace",
                                fontSize: 13,
                                fontWeight: 600,
                                color: row.sell_price_cents
                                  ? "#6ee7b7"
                                  : "rgba(255,255,255,0.38)",
                              }}
                            >
                              {row.sell_price_cents
                                ? centsToDollars(row.sell_price_cents)
                                : "—"}
                            </span>
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <div
                              style={{
                                display: "grid",
                                gap: 4,
                                fontSize: 11,
                                color: "rgba(255,255,255,0.52)",
                              }}
                            >
                              <span>CRM: {row.crm_sync_status}</span>
                              <span>GHL: {row.ghl_sync_status}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 13 }}>
                  Page{" "}
                  <span style={{ color: "#fff", fontWeight: 600 }}>{page}</span>{" "}
                  of {totalPages} ·{" "}
                  <span style={{ color: "#fff", fontWeight: 600 }}>
                    {total}
                  </span>{" "}
                  total leads
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className="pg-btn"
                    disabled={page <= 1}
                    onClick={() =>
                      setSearch({ page: String(Math.max(1, page - 1)) })
                    }
                    style={{
                      padding: "8px 18px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.65)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    ← Previous
                  </button>
                  <div
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "rgba(99,102,241,0.12)",
                      border: "1px solid rgba(99,102,241,0.25)",
                      color: "#c4b5fd",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {page} / {totalPages}
                  </div>
                  <button
                    type="button"
                    className="pg-btn"
                    disabled={page >= totalPages}
                    onClick={() => setSearch({ page: String(page + 1) })}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.65)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
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
        onClose={() => {
          setSelectedLeadId(null);
          setSelectedRow(null);
        }}
        myLeadPreview={selectedRow}
        detail={detail}
        detailLoading={detailLoading}
        purchaseActions={false}
        enableAssignmentPipeline
      />
    </>
  );
}

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#080a0f",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Loader2
              size={22}
              color="#a5b4fc"
              style={{ animation: "spin 0.9s linear infinite" }}
            />
          </div>
          <p
            style={{
              color: "rgba(255,255,255,0.35)",
              fontFamily: "DM Sans, sans-serif",
              fontSize: 14,
              margin: 0,
            }}
          >
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
