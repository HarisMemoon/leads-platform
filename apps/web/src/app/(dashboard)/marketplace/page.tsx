"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buyLead,
  getLeadDetail,
  getLeadQuote,
  listMarketplaceLeads,
  reserveLead,
  type MarketplaceLeadRow,
} from "@/lib/leads-api";
import { getWalletMe, centsToNumber } from "@/lib/wallet-api";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api";
import { LeadDetailModal, QualityBar } from "@/components/LeadDetailModal";

const PAGE_SIZE = 24;

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: "AL", name: "Alabama" }, { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" }, { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" }, { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" }, { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" }, { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" }, { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" }, { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" }, { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" }, { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" }, { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" }, { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" }, { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" }, { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" }, { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" }, { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" }, { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" }, { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" }, { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" }, { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" }, { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" }, { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" }, { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" }, { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" }, { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" }, { abbr: "WY", name: "Wyoming" },
];

const PRICE_OPTIONS = Array.from({ length: 101 }, (_, i) => i * 5);

function fmtDollars(cents: string | number) {
  return `$${(Number(cents) / 100).toFixed(0)}`;
}

function toSafeCents(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/**
 * UX rule: show shared pricing as a fraction of exclusive price (1 / cap).
 * This keeps what users see aligned with the shared-cap model.
 */
function computeSharedDisplayCents(
  exclusivePriceCents: string | number,
  sharedCap: number | null | undefined,
) {
  const exclusive = toSafeCents(exclusivePriceCents);
  const cap = Math.max(1, Number(sharedCap ?? 3));
  return Math.max(0, Math.floor(exclusive / cap));
}

function addressFromLead(lead: MarketplaceLeadRow) {
  const m = lead.metadata as Record<string, unknown> | undefined;
  return (m?.address as string) || lead.market;
}

function metaValue(lead: MarketplaceLeadRow, keys: string[], fallback = "—") {
  const meta = lead.metadata ?? {};
  for (const key of keys) {
    const value = meta[key];
    if (value != null && String(value).trim() !== "") return String(value);
  }
  return fallback;
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "";
  const mins = Math.ceil(ms / 60000);
  return mins < 60 ? `${mins}m` : `${Math.ceil(mins / 60)}h`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
type Toast = { id: number; msg: string; variant: "success" | "error" };
let _tid = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((msg: string, variant: Toast["variant"] = "success") => {
    const id = ++_tid;
    setToasts((t) => [...t, { id, msg, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return { toasts, show };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const queryClient = useQueryClient();
  const { toasts, show: showToast } = useToasts();

  // filter inputs
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [stateDropOpen, setStateDropOpen] = useState(false);
  const stateDropRef = useRef<HTMLDivElement>(null);
  const [propertyType, setPropertyType] = useState("");
  const [timeline, setTimeline] = useState("");
  const [condition, setCondition] = useState("");
  const [zip, setZip] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | "inbound" | "outbound">("");
  const [minPriceDollars, setMinPriceDollars] = useState("");
  const [maxPriceDollars, setMaxPriceDollars] = useState("");
  const [page, setPage] = useState(1);

  // modal state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedListItem, setSelectedListItem] = useState<MarketplaceLeadRow | null>(null);
  const [reserveUntil, setReserveUntil] = useState<string | null>(null);
  const [reserveTick, setReserveTick] = useState(0);

  // sold-out leads to hide from list after conflict errors
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // close state dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (stateDropRef.current && !stateDropRef.current.contains(e.target as Node)) {
        setStateDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ── 400ms debounce for query params ──────────────────────────────────────────
  const rawParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    type: type.trim() || undefined,
    source: sourceFilter || undefined,
    city: city.trim() || undefined,
    state: selectedStates.length > 0 ? selectedStates.join(",") : undefined,
    property_type: propertyType.trim() || undefined,
    timeline: timeline.trim() || undefined,
    condition: condition.trim() || undefined,
    zip: zip.trim() || undefined,
    date_from: dateFrom.trim() || undefined,
    date_to: dateTo.trim() || undefined,
    minPrice: minPriceDollars ? Math.round(parseFloat(minPriceDollars) * 100) : undefined,
    maxPrice: maxPriceDollars ? Math.round(parseFloat(maxPriceDollars) * 100) : undefined,
  }), [page, type, sourceFilter, city, selectedStates, propertyType, timeline, condition, zip, dateFrom, dateTo, minPriceDollars, maxPriceDollars]);

  const [debouncedParams, setDebouncedParams] = useState(rawParams);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedParams(rawParams), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawParams]);

  // ── queries ───────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.leads.marketplace(debouncedParams as unknown as Record<string, unknown>),
    queryFn: () => listMarketplaceLeads(debouncedParams),
    placeholderData: (prev) => prev,
  });

  const { data: wallet } = useQuery({
    queryKey: queryKeys.wallet.me,
    queryFn: getWalletMe,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: queryKeys.leads.detail(selectedId ?? ""),
    queryFn: () => getLeadDetail(selectedId!),
    enabled: !!selectedId,
  });

  // ── derived ───────────────────────────────────────────────────────────────────
  const walletBalance = wallet ? centsToNumber(wallet.balance_cents) : 0;
  const items = (data?.items ?? []).filter((l) => !hiddenIds.has(l.id));
  const total = data?.pagination.total ?? 0;

  const hasActiveFilters =
    type || sourceFilter || city || selectedStates.length > 0 || propertyType || timeline ||
    condition || zip || dateFrom.trim() || dateTo.trim() || minPriceDollars || maxPriceDollars;

  // ── reserve timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!reserveUntil) return;
    const t = setInterval(() => setReserveTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [reserveUntil]);

  const secondsLeft = useMemo(() => {
    if (!reserveUntil) return 0;
    return Math.max(0, Math.floor((new Date(reserveUntil).getTime() - Date.now()) / 1000));
  }, [reserveUntil, reserveTick]);

  // ── mutations ─────────────────────────────────────────────────────────────────
  const reserveMutation = useMutation({
    mutationFn: (id: string) => reserveLead(id),
    onSuccess: (res) => setReserveUntil(res.reserved_until),
  });

  const buyMutation = useMutation({
    mutationFn: ({ id, choice }: { id: string; choice: "exclusive" | "non_exclusive" }) =>
      buyLead(id, choice),
    onSuccess: async () => {
      setSelectedId(null);
      setSelectedListItem(null);
      setReserveUntil(null);
      showToast("Lead purchased!", "success");
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
      await queryClient.invalidateQueries({ queryKey: ["leads", "my"] });
      await queryClient.invalidateQueries({ queryKey: ["leads", "marketplace"] });
    },
    onError: (err: unknown, vars) => {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          showToast("This lead is in Pro early access — upgrade to Pro to buy now", "error");
        } else if (err.status === 400) {
          showToast(err.message.includes("wallet") ? "Insufficient wallet balance — top up your wallet" : err.message, "error");
        } else if (err.status === 409) {
          showToast("This lead was just purchased by someone else", "error");
          setHiddenIds((s) => new Set([...s, vars.id]));
          setSelectedId(null);
          setSelectedListItem(null);
        } else {
          showToast(err.message, "error");
        }
      } else {
        showToast((err as Error).message ?? "Purchase failed", "error");
      }
    },
  });

  // ── modal helpers ─────────────────────────────────────────────────────────────
  const openModal = useCallback((lead: MarketplaceLeadRow) => {
    setSelectedId(lead.id);
    setSelectedListItem(lead);
    setReserveUntil(null);
    reserveMutation.reset();
    buyMutation.reset();
  }, [reserveMutation, buyMutation]);

  const closeModal = useCallback(() => {
    setSelectedId(null);
    setSelectedListItem(null);
    setReserveUntil(null);
  }, []);

  function clearFilters() {
    setType(""); setSourceFilter(""); setCity(""); setSelectedStates([]); setPropertyType("");
    setTimeline(""); setCondition(""); setZip(""); setDateFrom(""); setDateTo("");
    setMinPriceDollars(""); setMaxPriceDollars(""); setPage(1);
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mp-root { min-height: 100vh; background: #080a0f; color: white; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; }
        .page-body { flex: 1; }
        .leads-main { padding: 28px; max-width: 1280px; width: 100%; margin: 0 auto; }

        .leads-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 16px; }
        .leads-title { font-family: 'Manrope', sans-serif; font-size: 22px; font-weight: 700; }
        .leads-sub { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 3px; }

        .filters-shell {
          margin-bottom: 22px; padding: 18px; border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02)), rgba(8,10,15,0.9);
          box-shadow: 0 14px 40px rgba(0,0,0,0.22);
        }
        .filter-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
        .filter-row.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .filter-group { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .filter-label { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.45); }
        .filter-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; font-size: 13px; outline: none; }
        .filter-input:focus { border-color: rgba(99,102,241,0.4); }
        .filter-select { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; font-size: 13px; outline: none; appearance: none; }
        .filter-select:focus { border-color: rgba(99,102,241,0.4); }
        .filter-select option { background: #0d0f17; color: #fff; }

        .filter-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
        .clear-inline-btn { padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: rgba(255,255,255,0.6); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; }
        .clear-inline-btn:hover { color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.04); }

        /* grid */
        .lead-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 14px; }
        .lead-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; cursor: pointer; transition: border-color 0.2s, transform 0.15s; position: relative; }
        .lead-card:hover { border-color: rgba(99,102,241,0.3); transform: translateY(-2px); }

        .lead-title { font-family: 'Manrope', sans-serif; font-size: 14px; font-weight: 700; margin: 12px 0 3px; line-height: 1.3; color: rgba(255,255,255,0.92); }
        .lead-address { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 10px; }
        .blur-field { filter: blur(3.5px); user-select: none; opacity: 0.75; }
        .private-fields { display: grid; gap: 6px; margin: 12px 0; }
        .private-row { display: grid; grid-template-columns: 86px 1fr; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.45); }
        .private-label { color: rgba(255,255,255,0.28); text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; }
        .meta-tag { font-size: 11px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 3px 8px; color: rgba(255,255,255,0.45); margin-right: 5px; margin-bottom: 5px; display: inline-block; }

        /* dual price row */
        .price-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
        .price-option { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); text-align: center; cursor: pointer; transition: border-color 0.15s; }
        .price-option:hover { border-color: rgba(99,102,241,0.3); }
        .price-option-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.35); margin-bottom: 4px; }
        .price-option-amount { font-family: 'Manrope', sans-serif; font-size: 16px; font-weight: 800; }
        .price-option-sub { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .price-option.exclusive { border-color: rgba(245,158,11,0.25); }
        .price-option.exclusive .price-option-amount { color: #fbbf24; }
        .price-option.non-exclusive { border-color: rgba(99,102,241,0.2); }
        .price-option.non-exclusive .price-option-amount { color: #a5b4fc; }
        .price-option-btn { margin-top: 6px; padding: 5px 10px; border-radius: 7px; border: none; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity 0.15s; }
        .price-option-btn.exclusive { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
        .price-option-btn.exclusive:hover { background: rgba(245,158,11,0.25); }
        .price-option-btn.non-exclusive { background: rgba(99,102,241,0.15); color: #c7d2fe; border: 1px solid rgba(99,102,241,0.3); }
        .price-option-btn.non-exclusive:hover { background: rgba(99,102,241,0.25); }
        .price-option-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .slot-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .slot-dot.taken { background: #10b981; }
        .slot-dot.warn { background: #f59e0b; }
        .slot-dot.open { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.22); }

        /* state multi-select */
        .state-drop-wrap { position: relative; }
        .state-drop-btn { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; font-size: 13px; outline: none; cursor: pointer; text-align: left; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: space-between; }
        .state-drop-btn:focus { border-color: rgba(99,102,241,0.4); }
        .state-drop-panel { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50; background: #0d0f17; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 8px; max-height: 260px; overflow-y: auto; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
        .state-opt { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; color: rgba(255,255,255,0.8); transition: background 0.12s; }
        .state-opt:hover { background: rgba(255,255,255,0.05); }
        .state-opt input[type=checkbox] { accent-color: #6366f1; width: 14px; height: 14px; cursor: pointer; }

        /* early access badge */
        .early-access-badge { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); font-size: 12px; color: #fbbf24; margin-top: 12px; }

        /* empty state */
        .empty-state { grid-column: 1 / -1; text-align: center; padding: 80px 20px; color: rgba(255,255,255,0.3); }
        .clear-filters-btn { margin-top: 16px; padding: 10px 22px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); border-radius: 10px; color: #a5b4fc; font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; }

        /* pagination */
        .pager { display: flex; gap: 12px; align-items: center; margin-top: 24px; justify-content: center; }
        .pager button { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; font-family: 'Inter', sans-serif; }
        .pager button:disabled { opacity: 0.4; cursor: not-allowed; }
        .pager-info { font-size: 13px; color: rgba(255,255,255,0.35); }

        /* toasts */
        .toast-stack { position: fixed; bottom: 28px; right: 28px; display: flex; flex-direction: column; gap: 10px; z-index: 200; }
        .toast { padding: 12px 18px; border-radius: 12px; font-size: 14px; font-weight: 500; max-width: 360px; animation: slideIn 0.25s ease; }
        .toast.success { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; }
        .toast.error   { background: rgba(239,68,68,0.15);  border: 1px solid rgba(239,68,68,0.35);  color: #fca5a5; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .err { color: #f87171; font-size: 13px; margin: 8px 0; }
        .skeleton { background: rgba(255,255,255,0.06); border-radius: 8px; animation: pulse 1.4s ease infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }

        .was-price { font-size: 11px; color: rgba(255,255,255,0.3); text-decoration: line-through; }

        @media (max-width: 960px) {
          .filter-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .filter-row.three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 720px) {
          .leads-main { padding: 20px; }
          .filter-row, .filter-row.three { grid-template-columns: 1fr; }
          .filters-shell { padding: 16px; }
        }
      `}</style>

      <div className="mp-root">
        <div className="page-body">
          <main className="leads-main">
            <div className="leads-header">
              <div>
                <div className="leads-title">Lead Marketplace</div>
                <div className="leads-sub">
                  {isLoading ? "Loading…" : `${total} leads available`}
                  {wallet ? ` · Wallet ${fmtDollars(walletBalance)}` : ""}
                </div>
              </div>
            </div>

            {/* ── Filters ── */}
            <section className="filters-shell" aria-label="Marketplace filters">
              <div className="filter-row">
                <div className="filter-group">
                  <label className="filter-label" htmlFor="source-filter">Lead Source</label>
                  <select
                    id="source-filter"
                    className="filter-select"
                    value={sourceFilter}
                    onChange={(e) => { setSourceFilter(e.target.value as typeof sourceFilter); setPage(1); }}
                  >
                    <option value="">Any</option>
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="type-filter">Lead Type</label>
                  <select id="type-filter" className="filter-select" value={type}
                    onChange={(e) => { setType(e.target.value); setPage(1); }}>
                    <option value="">Any</option>
                    <option value="Divorce">Divorce</option>
                    <option value="Foreclosure">Foreclosure</option>
                    <option value="Inherited">Inherited</option>
                    <option value="Tired Landlord">Tired Landlord</option>
                    <option value="Need Cash">Need Cash</option>
                    <option value="Relocating">Relocating</option>
                    <option value="Old Age">Old Age</option>
                    <option value="Probate">Probate</option>
                    <option value="Tax Delinquent">Tax Delinquent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">State</label>
                  <div className="state-drop-wrap" ref={stateDropRef}>
                    <button
                      type="button"
                      className="state-drop-btn"
                      onClick={() => setStateDropOpen((o) => !o)}
                    >
                      <span style={{ color: selectedStates.length ? "#fff" : "rgba(255,255,255,0.3)" }}>
                        {selectedStates.length === 0
                          ? "Any state"
                          : selectedStates.length === 1
                          ? (US_STATES.find((s) => s.abbr === selectedStates[0])?.name ?? selectedStates[0])
                          : `${selectedStates.length} states selected`}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      </svg>
                    </button>
                    {stateDropOpen && (
                      <div className="state-drop-panel">
                        {US_STATES.map((s) => (
                          <label key={s.abbr} className="state-opt">
                            <input
                              type="checkbox"
                              checked={selectedStates.includes(s.abbr)}
                              onChange={() => {
                                setSelectedStates((prev) =>
                                  prev.includes(s.abbr) ? prev.filter((x) => x !== s.abbr) : [...prev, s.abbr]
                                );
                                setPage(1);
                              }}
                            />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="city-filter">City</label>
                  <input id="city-filter" className="filter-input" placeholder="Phoenix" value={city}
                    onChange={(e) => { setCity(e.target.value); setPage(1); }} />
                </div>
              </div>

              <div className="filter-row">
                <div className="filter-group">
                  <label className="filter-label" htmlFor="minprice-filter">Min Price</label>
                  <select id="minprice-filter" className="filter-select"
                    value={minPriceDollars} onChange={(e) => { setMinPriceDollars(e.target.value); setPage(1); }}>
                    <option value="">Any</option>
                    {PRICE_OPTIONS.map((v) => <option key={v} value={v}>${v}</option>)}
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="maxprice-filter">Max Price</label>
                  <select id="maxprice-filter" className="filter-select"
                    value={maxPriceDollars} onChange={(e) => { setMaxPriceDollars(e.target.value); setPage(1); }}>
                    <option value="">Any</option>
                    {PRICE_OPTIONS.map((v) => <option key={v} value={v}>${v}</option>)}
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="property-filter">Property Type</label>
                  <select id="property-filter" className="filter-select" value={propertyType}
                    onChange={(e) => { setPropertyType(e.target.value); setPage(1); }}>
                    <option value="">Any</option>
                    <option value="Single Family">Single Family</option>
                    <option value="Multifamily">Multifamily</option>
                    <option value="Mobile Home">Mobile Home</option>
                    <option value="Land">Land</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="zip-filter">ZIP Code</label>
                  <input id="zip-filter" className="filter-input" placeholder="85001" value={zip}
                    onChange={(e) => { setZip(e.target.value); setPage(1); }} />
                </div>
              </div>

              <div className="filter-row" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                <div className="filter-group">
                  <label className="filter-label" htmlFor="condition-filter">Condition</label>
                  <select id="condition-filter" className="filter-select" value={condition}
                    onChange={(e) => { setCondition(e.target.value); setPage(1); }}>
                    <option value="">Any</option>
                    <option value="Needs Repairs">Needs Repairs</option>
                    <option value="Move In Ready">Move In Ready</option>
                    <option value="Full Gut">Full Gut</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label" htmlFor="timeline-filter">Timeline</label>
                  <select id="timeline-filter" className="filter-select" value={timeline}
                    onChange={(e) => { setTimeline(e.target.value); setPage(1); }}>
                    <option value="">Any</option>
                    <option value="ASAP">ASAP</option>
                    <option value="0 to 30 Days">0 to 30 Days</option>
                    <option value="60 to 90 Days">60 to 90 Days</option>
                    <option value="No Rush">No Rush</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="filter-actions">
                  <button type="button" className="clear-inline-btn" onClick={clearFilters}>Clear all filters</button>
                </div>
              )}
            </section>

            {isError && (
              <div className="err">
                {(error as Error)?.message ?? "Failed to load marketplace"}
                <button type="button" style={{ marginLeft: 12, padding: "6px 12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", cursor: "pointer" }} onClick={() => refetch()}>Retry</button>
              </div>
            )}

            <div className="lead-grid">
              {!isLoading && items.length === 0 && (
                <div className="empty-state">
                  <p style={{ fontSize: 16, marginBottom: 8 }}>No leads match your filters.</p>
                  <p style={{ fontSize: 13 }}>Try adjusting the filters or broadening your search.</p>
                  {hasActiveFilters && (
                    <button type="button" className="clear-filters-btn" onClick={clearFilters}>Clear filters</button>
                  )}
                </div>
              )}

              {items.map((lead) => {
                const exclusivePrice = lead.exclusive_price_cents ?? lead.current_price;
                const sharedTaken = lead.non_exclusive_buyers_count ?? 0;
                const sharedCap = lead.max_non_exclusive_buyers ?? 3;
                const sharedPrice = computeSharedDisplayCents(exclusivePrice, sharedCap);
                const sharedAvailable = sharedTaken < sharedCap;
                const exclusiveAvailable = sharedTaken === 0;

                const isInEarlyAccess =
                  lead.early_access_until != null &&
                  new Date(lead.early_access_until) > new Date();
                const timeLeft = lead.early_access_until ? timeUntil(lead.early_access_until) : "";

                const isBuying = buyMutation.isPending;

                return (
                  <div key={lead.id} className="lead-card" onClick={() => openModal(lead)}>
                    {/* Title + location */}
                    <div className="lead-title">{lead.title}</div>
                    <div className="lead-address">{addressFromLead(lead)}</div>

                    {/* Private fields (blurred) */}
                    <div className="private-fields" aria-label="Private lead fields preview">
                      <div className="private-row">
                        <span className="private-label">Name</span>
                        <span className="blur-field">{metaValue(lead, ["name", "full_name", "first_name"], "••••••")}</span>
                      </div>
                      <div className="private-row">
                        <span className="private-label">Phone</span>
                        <span className="blur-field">{metaValue(lead, ["phone", "mobile"], "••••••")}</span>
                      </div>
                      <div className="private-row">
                        <span className="private-label">Email</span>
                        <span className="blur-field">{metaValue(lead, ["email"], "••••••")}</span>
                      </div>
                    </div>

                    {/* Meta tags */}
                    <div>
                      <span className="meta-tag">{lead.type}</span>
                      {metaValue(lead, ["state"]) !== "—" && <span className="meta-tag">{metaValue(lead, ["state"])}</span>}
                      {metaValue(lead, ["property_type", "propertyType"]) !== "—" && <span className="meta-tag">{metaValue(lead, ["property_type", "propertyType"])}</span>}
                      {metaValue(lead, ["timeline"]) !== "—" && <span className="meta-tag">{metaValue(lead, ["timeline"])}</span>}
                    </div>

                    <QualityBar score={lead.quality_score} />

                    {/* Early access badge */}
                    {isInEarlyAccess && (
                      <div className="early-access-badge">
                        <span>⚡</span>
                        <span>Pro early access{timeLeft ? ` — opens in ${timeLeft}` : ""}</span>
                      </div>
                    )}

                    {/* Dual-price options */}
                    <div className="price-row" onClick={(e) => e.stopPropagation()}>
                      <div className={`price-option exclusive${!exclusiveAvailable ? " opacity-40" : ""}`}>
                        <div className="price-option-label">Exclusive</div>
                        <div className="price-option-amount">{fmtDollars(exclusivePrice)}</div>
                        <div className="price-option-sub">1 buyer only</div>
                        {!isInEarlyAccess ? (
                          <button
                            type="button"
                            className="price-option-btn exclusive"
                            disabled={isBuying || !exclusiveAvailable}
                            onClick={() => buyMutation.mutate({ id: lead.id, choice: "exclusive" })}
                          >
                            {isBuying ? "…" : exclusiveAvailable ? "Buy" : "Locked"}
                          </button>
                        ) : (
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Pro only</div>
                        )}
                      </div>

                      <div className={`price-option non-exclusive${!sharedAvailable ? " opacity-40" : ""}`}>
                        <div className="price-option-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          Non Exclusive
                          {sharedTaken < sharedCap && (
                            <span className={
                              sharedTaken === 0 ? "slot-dot open"
                              : sharedTaken < sharedCap - 1 ? "slot-dot taken"
                              : "slot-dot warn"
                            } />
                          )}
                        </div>
                        <div className="price-option-amount">{fmtDollars(sharedPrice)}</div>
                        <div className="price-option-sub" style={{ marginBottom: 2 }}>Up to 3 buyers</div>
                        {!isInEarlyAccess ? (
                          <button
                            type="button"
                            className="price-option-btn non-exclusive"
                            disabled={isBuying || !sharedAvailable}
                            onClick={() => buyMutation.mutate({ id: lead.id, choice: "non_exclusive" })}
                          >
                            {isBuying ? "…" : sharedAvailable ? "Buy" : "Full"}
                          </button>
                        ) : (
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Pro only</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="pager">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Previous</button>
              <span className="pager-info">Page {page}{total > 0 ? ` of ${Math.ceil(total / PAGE_SIZE)}` : ""}</span>
              <button type="button" disabled={page * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          </main>
        </div>
      </div>

      <LeadDetailModal
        leadId={selectedId}
        onClose={closeModal}
        listPreview={selectedListItem}
        detail={detail}
        detailLoading={detailLoading}
        purchaseActions
        walletBalanceCents={walletBalance}
        reserveMutation={reserveMutation}
        buyMutation={buyMutation}
        reserveUntil={reserveUntil}
        secondsLeft={secondsLeft}
        getLeadQuote={getLeadQuote}
      />

      {/* Toast stack */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.variant}`}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}
