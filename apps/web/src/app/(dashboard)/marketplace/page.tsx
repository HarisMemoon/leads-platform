"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buyLead,
  getLeadDetail,
  listMarketplaceLeads,
  reserveLead,
  type MarketplaceLeadRow,
} from "@/lib/leads-api";
import { getWalletMe, centsToNumber } from "@/lib/wallet-api";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api";
import {
  LeadDetailModal,
  QualityBar,
  exclusivityColor,
  exclusivityLabel,
} from "@/components/LeadDetailModal";

// ─── constants ────────────────────────────────────────────────────────────────
const EXCLUSIVITY_OPTS = ["All", "exclusive", "semi_exclusive", "shared"] as const;
const TIER_TABS = [
  { id: "" as const, label: "All sections" },
  { id: "premium" as const, label: "Premium" },
  { id: "standard" as const, label: "Standard" },
  { id: "value" as const, label: "Value" },
];
const PAGE_SIZE = 24;

// ─── helpers ──────────────────────────────────────────────────────────────────
function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function fmtDollars(cents: string | number) {
  return `$${(Number(cents) / 100).toFixed(0)}`;
}

function addressFromLead(lead: MarketplaceLeadRow) {
  const m = lead.metadata as Record<string, unknown> | undefined;
  return (m?.address as string) || lead.market;
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
  const [market, setMarket] = useState("");
  const [type, setType] = useState("");
  const [excl, setExcl] = useState<string>("All");
  const [maxPrice, setMaxPrice] = useState(25000);
  const [maxAgeDays, setMaxAgeDays] = useState<number | "">("");
  const [tier, setTier] = useState<"" | "premium" | "standard" | "value">("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // modal state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedListItem, setSelectedListItem] = useState<MarketplaceLeadRow | null>(null);
  const [reserveUntil, setReserveUntil] = useState<string | null>(null);
  const [reserveTick, setReserveTick] = useState(0);

  // sold-out leads to hide from list after 409
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // ── 400ms debounce for query params ──────────────────────────────────────────
  const rawParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    market: market.trim() || undefined,
    type: type.trim() || undefined,
    exclusivity: excl === "All" ? undefined : excl,
    maxPrice,
    maxAgeDays: maxAgeDays === "" ? undefined : maxAgeDays,
    marketplaceTier: tier || undefined,
  }), [page, market, type, excl, maxPrice, maxAgeDays, tier]);

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

  const marketsFromData = useMemo(() => Array.from(new Set(items.map((l) => l.market))).sort(), [items]);
  const typesFromData = useMemo(() => Array.from(new Set(items.map((l) => l.type))).sort(), [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((l) =>
      l.title.toLowerCase().includes(q) ||
      l.market.toLowerCase().includes(q) ||
      l.type.toLowerCase().includes(q),
    );
  }, [items, search]);

  const hasActiveFilters = market || type || excl !== "All" || maxPrice !== 25000 || maxAgeDays !== "" || tier;

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
    mutationFn: (id: string) => buyLead(id),
    onSuccess: async () => {
      setSelectedId(null);
      setSelectedListItem(null);
      setReserveUntil(null);
      showToast("Lead purchased!", "success");
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
      await queryClient.invalidateQueries({ queryKey: ["leads", "my"] });
      await queryClient.invalidateQueries({ queryKey: ["leads", "marketplace"] });
    },
    onError: (err: unknown, leadId: string) => {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          showToast("Insufficient wallet balance — top up your wallet", "error");
        } else if (err.status === 409) {
          showToast("This lead was just purchased by someone else", "error");
          setHiddenIds((s) => new Set([...s, leadId]));
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
    setMarket(""); setType(""); setExcl("All");
    setMaxPrice(25000); setMaxAgeDays(""); setTier(""); setPage(1);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mp-root { min-height: 100vh; background: #080a0f; color: white; font-family: 'DM Sans', sans-serif; display: flex; flex-direction: column; }
        .page-body { flex: 1; display: grid; grid-template-columns: 260px 1fr; }

        /* sidebar */
        .filters-sidebar { border-right: 1px solid rgba(255,255,255,0.05); padding: 28px 20px; position: sticky; top: 88px; height: calc(100vh - 88px); overflow-y: auto; }
        .filter-section { margin-bottom: 28px; }
        .filter-label { font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
        .filter-opt { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; font-size: 13px; color: rgba(255,255,255,0.5); cursor: pointer; border: 1px solid transparent; user-select: none; }
        .filter-opt:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
        .filter-opt.selected { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.2); color: #a5b4fc; }
        .filter-input { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; font-size: 13px; margin-bottom: 8px; outline: none; }
        .filter-input:focus { border-color: rgba(99,102,241,0.4); }
        input[type=range] { width: 100%; -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #6366f1; cursor: pointer; }

        /* tier tabs */
        .tier-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
        .tier-tab { padding: 6px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); background: none; transition: all 0.15s; }
        .tier-tab:hover { border-color: rgba(99,102,241,0.35); color: rgba(255,255,255,0.8); }
        .tier-tab.on { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.35); color: #c7d2fe; }

        /* main */
        .leads-main { padding: 28px; }
        .leads-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
        .leads-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; }
        .leads-count { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .search-bar { width: 280px; max-width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 16px; font-size: 13px; color: #fff; outline: none; }
        .search-bar:focus { border-color: rgba(99,102,241,0.4); }

        /* grid */
        .lead-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 14px; }
        .lead-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; cursor: pointer; transition: border-color 0.2s, transform 0.15s; position: relative; }
        .lead-card:hover { border-color: rgba(99,102,241,0.3); transform: translateY(-2px); }

        .excl-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 100px; border: 1px solid; white-space: nowrap; }
        .tier-pill { font-size: 10px; padding: 3px 8px; background: rgba(255,255,255,0.06); border-radius: 100px; color: rgba(255,255,255,0.45); text-transform: capitalize; white-space: nowrap; }

        .lead-title { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; margin: 12px 0 3px; line-height: 1.3; color: rgba(255,255,255,0.92); }
        .lead-address { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 10px; }
        .meta-tag { font-size: 11px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 3px 8px; color: rgba(255,255,255,0.45); margin-right: 5px; margin-bottom: 5px; display: inline-block; }

        .card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
        .lead-price { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; }
        .was-price { font-size: 11px; color: rgba(255,255,255,0.3); text-decoration: line-through; }

        .buy-btn-card { padding: 8px 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 9px; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Syne', sans-serif; transition: opacity 0.15s; }
        .buy-btn-card:hover { opacity: 0.88; }
        .buy-btn-card:disabled { opacity: 0.45; cursor: not-allowed; }

        /* empty state */
        .empty-state { grid-column: 1 / -1; text-align: center; padding: 80px 20px; color: rgba(255,255,255,0.3); }
        .clear-filters-btn { margin-top: 16px; padding: 10px 22px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); border-radius: 10px; color: #a5b4fc; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }

        /* modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(8px); }
        .modal { background: #0d0f17; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 32px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; gap: 12px; }
        .modal-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.3; }
        .close-btn { background: rgba(255,255,255,0.07); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; color: rgba(255,255,255,0.5); font-size: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .close-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }

        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .detail-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px; }
        .detail-item.full { grid-column: 1 / -1; }
        .detail-label { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 5px; }
        .detail-value { font-size: 13px; color: rgba(255,255,255,0.85); }

        .price-section { display: flex; justify-content: space-between; align-items: center; margin: 16px 0; padding: 18px; background: rgba(99,102,241,0.08); border-radius: 14px; border: 1px solid rgba(99,102,241,0.2); }
        .modal-price { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; }

        .section-header { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.8px; margin: 18px 0 10px; }

        .modal-buy-btn { width: 100%; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 700; color: #fff; cursor: pointer; font-family: 'Syne', sans-serif; margin-top: 14px; transition: opacity 0.15s; }
        .modal-buy-btn:hover { opacity: 0.9; }
        .modal-buy-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .hold-btn { width: 100%; margin-top: 8px; padding: 12px; border-radius: 12px; border: 1px solid rgba(99,102,241,0.35); background: rgba(99,102,241,0.08); color: #c7d2fe; font-weight: 600; cursor: pointer; font-size: 14px; font-family: 'DM Sans', sans-serif; }
        .timer { text-align: center; font-size: 13px; color: #fbbf24; margin: 10px 0; }

        /* pagination */
        .pager { display: flex; gap: 12px; align-items: center; margin-top: 24px; justify-content: center; }
        .pager button { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; font-family: 'DM Sans', sans-serif; }
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

        @media (max-width: 800px) { .page-body { grid-template-columns: 1fr; } .filters-sidebar { display: none; } }
      `}</style>

      <div className="mp-root">
        <div className="page-body">
          {/* ── Filters sidebar ── */}
          <aside className="filters-sidebar">
            <div className="filter-section">
              <div className="filter-label">Market</div>
              <input className="filter-input" placeholder="Filter by market…" value={market}
                onChange={(e) => { setMarket(e.target.value); setPage(1); }} list="markets-list" />
              <datalist id="markets-list">{marketsFromData.map((m) => <option key={m} value={m} />)}</datalist>
            </div>

            <div className="filter-section">
              <div className="filter-label">Lead type</div>
              <input className="filter-input" placeholder="Filter by type…" value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }} list="types-list" />
              <datalist id="types-list">{typesFromData.map((t) => <option key={t} value={t} />)}</datalist>
            </div>

            <div className="filter-section">
              <div className="filter-label">Exclusivity</div>
              {EXCLUSIVITY_OPTS.map((e) => (
                <div key={e} className={`filter-opt ${excl === e ? "selected" : ""}`}
                  onClick={() => { setExcl(e); setPage(1); }}>
                  {e === "All" ? "All" : exclusivityLabel(e)}
                </div>
              ))}
            </div>

            <div className="filter-section">
              <div className="filter-label">Max lead age (days)</div>
              <input type="number" min={0} className="filter-input" placeholder="Any age"
                value={maxAgeDays}
                onChange={(e) => { setMaxAgeDays(e.target.value === "" ? "" : Math.max(0, Number(e.target.value))); setPage(1); }} />
            </div>

            <div className="filter-section">
              <div className="filter-label">Max price</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Up to ${(maxPrice / 100).toFixed(0)}</div>
              <input type="range" min={2500} max={250000} step={500} value={maxPrice}
                onChange={(e) => { setMaxPrice(+e.target.value); setPage(1); }} />
            </div>

            {hasActiveFilters && (
              <button type="button" onClick={clearFilters}
                style={{ marginTop: 4, width: "100%", padding: "9px 14px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, background: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Clear all filters ×
              </button>
            )}
          </aside>

          {/* ── Main content ── */}
          <main className="leads-main">
            <div className="tier-tabs">
              {TIER_TABS.map((t) => (
                <button key={t.id || "all"} type="button" className={`tier-tab ${tier === t.id ? "on" : ""}`}
                  onClick={() => { setTier(t.id); setPage(1); }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="leads-header">
              <div>
                <div className="leads-title">Lead Marketplace</div>
                <div className="leads-count">
                  {isLoading ? "Loading…" : `${total} leads match filters`}
                  {wallet ? ` · Wallet ${fmtDollars(walletBalance)}` : ""}
                </div>
              </div>
              <input className="search-bar" placeholder="Search this page…" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>

            {isError && (
              <div className="err">
                {(error as Error)?.message ?? "Failed to load marketplace"}
                <button type="button" className="buy-btn-card" style={{ marginLeft: 12 }} onClick={() => refetch()}>Retry</button>
              </div>
            )}

            <div className="lead-grid">
              {!isLoading && filteredItems.length === 0 && (
                <div className="empty-state">
                  <p style={{ fontSize: 16, marginBottom: 8 }}>No leads match your filters.</p>
                  <p style={{ fontSize: 13 }}>Try adjusting the filters or broadening your search.</p>
                  {hasActiveFilters && (
                    <button type="button" className="clear-filters-btn" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {filteredItems.map((lead) => {
                const ec = exclusivityColor(lead.exclusivity);
                const pc = Number(lead.current_price);
                const ac = lead.list_price_anchor_cents ? Number(lead.list_price_anchor_cents) : null;
                const isBuying = buyMutation.isPending && buyMutation.variables === lead.id;
                return (
                  <div key={lead.id} className="lead-card" onClick={() => openModal(lead)}>
                    {/* Top row: exclusivity + tier */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span className="excl-badge" style={{ background: ec.bg, color: ec.color, borderColor: ec.border }}>
                        {exclusivityLabel(lead.exclusivity)}
                      </span>
                      {lead.marketplace_tier && <span className="tier-pill">{lead.marketplace_tier}</span>}
                    </div>

                    {/* Title + address */}
                    <div className="lead-title">{lead.title}</div>
                    <div className="lead-address">{addressFromLead(lead)}</div>

                    {/* Meta tags */}
                    <div>
                      <span className="meta-tag">{lead.type}</span>
                      <span className="meta-tag">{lead.market}</span>
                      <span className="meta-tag">{daysSince(lead.created_at)}d old</span>
                    </div>

                    {/* Quality bar */}
                    <QualityBar score={lead.quality_score} />

                    {/* Price + Buy Now */}
                    <div className="card-bottom">
                      <div>
                        <div className="lead-price">{fmtDollars(pc)}</div>
                        {ac != null && ac > pc && <div className="was-price">Was {fmtDollars(ac)}</div>}
                      </div>
                      <button
                        type="button"
                        className="buy-btn-card"
                        disabled={isBuying}
                        onClick={(e) => {
                          e.stopPropagation();
                          buyMutation.mutate(lead.id);
                        }}
                      >
                        {isBuying ? "Buying…" : "Buy Now"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="pager">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Previous</button>
              <span className="pager-info">Page {page} {total > 0 ? `of ${Math.ceil(total / PAGE_SIZE)}` : ""}</span>
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
      />

      {/* ── Toast stack ── */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.variant}`}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}
