"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  buyLead,
  exclusiveBuyout,
  getLeadDetail,
  getLeadQuote,
  listMarketplaceLeads,
  reserveLead,
  type MarketplaceLeadRow,
} from "@/lib/leads-api";
import { getWalletMe, centsToNumber } from "@/lib/wallet-api";
import {
  getMySubscription,
  getSubscriptionPricing,
} from "@/lib/subscriptions-api";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import { CustomSelect } from "@/components/CustomSelect";

const PAGE_SIZE = 24;

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
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
 * Shared price comes from the API as a flat subscription rate:
 *   Inbound  → $30 (3000 cents)
 *   Outbound → $20 (2000 cents)
 * The `shared_price_cents` field on the lead is now always populated by
 * the backend, so this is just a safe accessor with a sensible fallback.
 */
function getSharedDisplayCents(
  sharedPriceCents: string | number | null | undefined,
  leadType: string,
) {
  if (sharedPriceCents != null) {
    const n = toSafeCents(sharedPriceCents);
    if (n > 0) return n;
  }
  return leadType === "outbound" ? 2000 : 3000;
}

function addressFromLead(lead: MarketplaceLeadRow) {
  const m = lead.metadata as Record<string, unknown> | undefined;
  return (m?.address as string) || lead.market;
}

function metaValue(lead: MarketplaceLeadRow, keys: string[], fallback = "—") {
  const meta = lead.metadata ?? {};
  for (const key of keys) {
    const value = meta[key];
    const text = value != null ? String(value).trim() : "";
    if (text && !/^•+$/.test(text)) return text;
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
  const show = useCallback(
    (msg: string, variant: Toast["variant"] = "success") => {
      const id = ++_tid;
      setToasts((t) => [...t, { id, msg, variant }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    },
    [],
  );
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
  const [sourceFilter, setSourceFilter] = useState<"" | "inbound" | "outbound">(
    "",
  );
  const [minPriceDollars, setMinPriceDollars] = useState("");
  const [maxPriceDollars, setMaxPriceDollars] = useState("");
  const [page, setPage] = useState(1);
  const [openFilters, setOpenFilters] = useState(false);

  // modal state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedListItem, setSelectedListItem] =
    useState<MarketplaceLeadRow | null>(null);
  const [reserveUntil, setReserveUntil] = useState<string | null>(null);
  const [reserveTick, setReserveTick] = useState(0);

  // sold-out leads to hide from list after conflict errors
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // close state dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        stateDropRef.current &&
        !stateDropRef.current.contains(e.target as Node)
      ) {
        setStateDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ── 400ms debounce for query params ──────────────────────────────────────────
  const rawParams = useMemo(
    () => ({
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
      minPrice: minPriceDollars
        ? Math.round(parseFloat(minPriceDollars) * 100)
        : undefined,
      maxPrice: maxPriceDollars
        ? Math.round(parseFloat(maxPriceDollars) * 100)
        : undefined,
    }),
    [
      page,
      type,
      sourceFilter,
      city,
      selectedStates,
      propertyType,
      timeline,
      condition,
      zip,
      dateFrom,
      dateTo,
      minPriceDollars,
      maxPriceDollars,
    ],
  );

  const [debouncedParams, setDebouncedParams] = useState(rawParams);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedParams(rawParams), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawParams]);

  // ── queries ───────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.leads.marketplace(
      debouncedParams as unknown as Record<string, unknown>,
    ),
    queryFn: () => listMarketplaceLeads(debouncedParams),
    placeholderData: (prev) => prev,
  });

  const { data: wallet } = useQuery({
    queryKey: queryKeys.wallet.me,
    queryFn: getWalletMe,
  });

  const { data: subscription } = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: getMySubscription,
  });
  const isSubscribed = subscription?.status === "active";

  const { data: subPricing } = useQuery({
    queryKey: ["subscriptions", "pricing"],
    queryFn: getSubscriptionPricing,
    staleTime: 5 * 60 * 1000,
  });
  const proDisplayPrice = subPricing?.proDisplayPrice ?? "$49";

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
    type ||
    sourceFilter ||
    city ||
    selectedStates.length > 0 ||
    propertyType ||
    timeline ||
    condition ||
    zip ||
    dateFrom.trim() ||
    dateTo.trim() ||
    minPriceDollars ||
    maxPriceDollars;

  // ── reserve timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!reserveUntil) return;
    const t = setInterval(() => setReserveTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [reserveUntil]);

  const secondsLeft = useMemo(() => {
    if (!reserveUntil) return 0;
    return Math.max(
      0,
      Math.floor((new Date(reserveUntil).getTime() - Date.now()) / 1000),
    );
  }, [reserveUntil, reserveTick]);

  // ── mutations ─────────────────────────────────────────────────────────────────
  const reserveMutation = useMutation({
    mutationFn: (id: string) => reserveLead(id),
    onSuccess: (res) => setReserveUntil(res.reserved_until),
  });

  const buyMutation = useMutation({
    mutationFn: ({
      id,
      choice,
    }: {
      id: string;
      choice: "exclusive" | "non_exclusive";
    }) => buyLead(id, choice),
    onSuccess: async () => {
      setSelectedId(null);
      setSelectedListItem(null);
      setReserveUntil(null);
      showToast("Lead purchased!", "success");
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
      await queryClient.invalidateQueries({ queryKey: ["leads", "my"] });
      await queryClient.invalidateQueries({
        queryKey: ["leads", "marketplace"],
      });
    },
    onError: (err: unknown, vars) => {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          if (err.message.includes("subscription")) {
            showToast(
              `Subscribe to unlock shared lead pricing — ${proDisplayPrice}/month`,
              "error",
            );
          } else {
            showToast(
              "This lead is in early access — subscribers get first access",
              "error",
            );
          }
        } else if (err.status === 400) {
          showToast(
            err.message.includes("wallet")
              ? "Insufficient wallet balance — top up your wallet"
              : err.message,
            "error",
          );
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

  const exclusiveBuyoutMutation = useMutation({
    mutationFn: (id: string) => exclusiveBuyout(id),
    onSuccess: async () => {
      setSelectedId(null);
      setSelectedListItem(null);
      showToast(
        "Exclusive buyout complete — this lead is now locked to you!",
        "success",
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
      await queryClient.invalidateQueries({ queryKey: ["leads", "my"] });
      await queryClient.invalidateQueries({
        queryKey: ["leads", "marketplace"],
      });
    },
    onError: (err: unknown) => {
      showToast(
        err instanceof ApiError
          ? err.message
          : ((err as Error).message ?? "Exclusive buyout failed"),
        "error",
      );
    },
  });

  // ── modal helpers ─────────────────────────────────────────────────────────────
  const openModal = useCallback(
    (lead: MarketplaceLeadRow) => {
      setSelectedId(lead.id);
      setSelectedListItem(lead);
      setReserveUntil(null);
      reserveMutation.reset();
      buyMutation.reset();
    },
    [reserveMutation, buyMutation],
  );

  const closeModal = useCallback(() => {
    setSelectedId(null);
    setSelectedListItem(null);
    setReserveUntil(null);
  }, []);

  function clearFilters() {
    setType("");
    setSourceFilter("");
    setCity("");
    setSelectedStates([]);
    setPropertyType("");
    setTimeline("");
    setCondition("");
    setZip("");
    setDateFrom("");
    setDateTo("");
    setMinPriceDollars("");
    setMaxPriceDollars("");
    setPage(1);
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mp-root { min-height: 100vh; background: #080a0f; color: white; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; }
        .page-body { flex: 1; }
        .leads-main { padding: 28px; max-width: 1280px; width: 100%; margin: 0 auto; }

       .leads-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.leads-header-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.leads-title {
  font-family: 'Manrope', sans-serif;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.leads-sub {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
}

.dot-separator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.wallet-badge {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

      /* ── Filters Shell ── */
.filters-shell {
  margin-bottom: 24px;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: 
    linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.015) 100%),
    rgba(10, 11, 16, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 
    0 20px 48px -12px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* ── Grid Layouts ── */
.filter-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.filter-row.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.filter-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: ;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.42);
}

/* ── Inputs & Selects Shared ── */
.filter-input,
.filter-select {
  width: 100%;
  height: 40px;
  padding: 0 13px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  outline: none;
  box-sizing: border-box;
  transition: 
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.filter-input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.filter-input:hover,
.filter-select:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.16);
}

.filter-input:focus,
.filter-select:focus {
  background: rgba(99, 102, 241, 0.06);
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

/* ── Custom Select Arrow ── */
.filter-select {
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  padding-right: 34px;
 
}

.filter-select option {
  background: #11131c;
  color: #fff;
  padding: 8px;
}

/* ── Actions Row ── */
.filter-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.clear-inline-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.clear-inline-btn:hover {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
}
        /* grid */
       .leads-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.lead-card {
  background: #111218;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.lead-card:hover {
  transform: translateY(-4px);
  border-color: rgba(99, 102, 241, 0.4);
  background: #15161d;
  box-shadow: 0 12px 40px -12px rgba(99, 102, 241, 0.2), inset 0 0 0 1px rgba(255,255,255,0.02);
}

/* Header inside Card */
.lead-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.lead-badges-right {
  display: flex;
  gap: 6px;
  align-items: center;
}

.lead-type-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: ;
  letter-spacing: 0.5px;
  padding: 4px 10px;
  border-radius: 20px;
}
.lead-type-badge.inbound { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
.lead-type-badge.outbound { background: rgba(16, 185, 129, 0.15); color: #34d399; }

.price-boost-badge, .early-access-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;
  border: 1px solid;
}

.early-access-badge {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.25);
}

.lead-location-title {
  font-family: 'Manrope', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 20px 0;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Details Grid */
.lead-details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 10px;
  text-transform: ;
  letter-spacing: 0.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
}

.detail-value {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}
.detail-value.empty {
  color: rgba(255, 255, 255, 0.2);
}

/* =========================================
   PRICE OPTIONS (Fixed alignment layout)
   ========================================= */
.price-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: auto;
  align-items: stretch;
}

.price-option {
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.price-option.locked { opacity: 0.5; cursor: not-allowed; }
.price-option:hover:not(.locked) { border-color: rgba(255, 255, 255, 0.2); }

.price-option.exclusive:hover:not(.locked) { border-color: rgba(245, 158, 11, 0.4); }
.price-option.non-exclusive:hover:not(.locked) { border-color: rgba(99, 102, 241, 0.4); }

.price-option-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: ;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 12px;
  line-height: 1.4;
  flex-grow: 1; /* Pushes everything below it to the bottom */
}

.partial-badge {
  margin-left: 6px;
  font-size: 9px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.price-option-amount {
  font-family: 'Manrope', sans-serif;
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  color: #ffffff;
  margin-bottom: 8px;
}

.price-option-sub, .early-access-note, .upsell-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.4;
  margin-bottom: 12px;
}

.warn-text { color: #f59e0b; }

/* Buttons perfectly locked to bottom */
.price-option-btn {
  margin-top: auto;
  width: 100%;
  padding: 8px 0;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  box-sizing: border-box;
}

.price-option-btn.exclusive {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}
.price-option-btn.exclusive:hover:not(:disabled) { background: rgba(245, 158, 11, 0.25); }

.price-option-btn.non-exclusive {
  background: rgba(99, 102, 241, 0.15);
  color: #c7d2fe;
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.price-option-btn.non-exclusive:hover:not(:disabled) { background: rgba(99, 102, 241, 0.25); }

.price-option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(100%);
}

.block-btn { text-decoration: none; }

/* Pips for slots */
.slot-bar { margin-bottom: 12px; }
.slot-pips { display: flex; justify-content: center; gap: 4px; margin-bottom: 6px; }
.slot-pip {
  width: 100%;
  max-width: 12px;
  height: 4px;
  border-radius: 2px;
}
.slot-pip.taken { background: #10b981; }
.slot-pip.warn { background: #f59e0b; }
.slot-pip.open { background: rgba(255, 255, 255, 0.15); }
.slot-text { font-size: 10px; color: rgba(255, 255, 255, 0.4); font-weight: 600; }

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

        /* lead-type badge */
        .lead-type-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: ; }
        .lead-type-badge.inbound  { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25); color: #a5b4fc; }
        .lead-type-badge.outbound { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.22); color: #6ee7b7; }

        /* slot progress */
        .slot-bar { display: flex; align-items: center; gap: 6px; margin-top: 4px; justify-content: center; }
        .slot-pips { display: flex; gap: 3px; }
        .slot-pip { width: 8px; height: 8px; border-radius: 50%; }
        .slot-pip.taken { background: #10b981; }
        .slot-pip.warn  { background: #f59e0b; }
        .slot-pip.open  { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); }
        .slot-text { font-size: 10px; color: rgba(255,255,255,0.38); }

        /* subscribe lock overlay */
        .sub-lock { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 8px; border-radius: 10px; background: rgba(99,102,241,0.07); border: 1px dashed rgba(99,102,241,0.25); text-align: center; }
        .sub-lock-label { font-size: 11px; font-weight: 600; color: rgba(196,181,253,0.8); }
        .sub-lock-cta { font-size: 10px; color: #a5b4fc; text-decoration: none; font-weight: 700; }
        .sub-lock-cta:hover { color: #c4b5fd; }

.filter-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.filter-toggle.active {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.4);
  color: #818cf8;
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.1);
}

.filter-toggle svg {
  width: 20px;
  height: 20px;
}

        @media (max-width: 960px) {
          .filter-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .filter-row.three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 720px) {
          .leads-main { padding: 20px; }
          .filter-row, .filter-row.three { grid-template-columns: 1fr; }
          .filters-shell { padding: 16px; }
          /* ── Responsive Adaptations ── */
@media (max-width: 900px) {
  .filter-row,
  .filter-row.three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 540px) {
  .filters-shell {
    padding: 16px;
    border-radius: 14px;
  }

  .filter-row,
  .filter-row.three {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .filter-actions {
    justify-content: stretch;
  }

  .clear-inline-btn {
    width: 100%;
  }
}
        }
      `}</style>

      <div className="mp-root">
        <div className="page-body">
          <main className="leads-main">
            <div className="leads-header">
              <div className="leads-header-content">
                <h1 className="leads-title">Lead Marketplace</h1>
                <div className="leads-sub">
                  <span className="leads-count">
                    {isLoading ? "Loading…" : `${total} leads available`}
                  </span>
                  {wallet && (
                    <>
                      <span className="dot-separator"></span>
                      <span className="wallet-badge">
                        Wallet {fmtDollars(walletBalance)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={`filter-toggle ${openFilters ? "active" : ""}`}
                onClick={() => setOpenFilters((open) => !open)}
                aria-expanded={openFilters}
                aria-label={openFilters ? "Close filters" : "Open filters"}
              >
                {openFilters ? (
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M5 5l10 10M15 5L5 15"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M3 5h14M3 10h14M3 15h14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="7" cy="5" r="1.5" fill="currentColor" />
                    <circle cx="13" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="9" cy="15" r="1.5" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
            {/* ── Filters ── */}
            {openFilters && (
              <section
                id="marketplace-filters"
                className="filters-shell"
                aria-label="Marketplace filters"
              >
                <div className="filter-row">
                  <div className="filter-group">
                    <label className="filter-label" htmlFor="source-filter">
                      Lead Source
                    </label>
                    <CustomSelect
                      id="source-filter"
                      value={sourceFilter}
                      placeholder="Any"
                      options={[
                        { value: "", label: "Any" },
                        { value: "inbound", label: "Inbound" },
                        { value: "outbound", label: "Outbound" },
                      ]}
                      onChange={(val) => {
                        setSourceFilter(val as typeof sourceFilter);
                        setPage(1);
                      }}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label" htmlFor="type-filter">
                      Lead Type
                    </label>
                    <CustomSelect
                      id="type-filter"
                      value={type}
                      placeholder="Any"
                      options={[
                        { value: "", label: "Any" },
                        ...[
                          "Divorce",
                          "Foreclosure",
                          "Inherited",
                          "Tired Landlord",
                          "Need Cash",
                          "Relocating",
                          "Old Age",
                          "Probate",
                          "Tax Delinquent",
                          "Other",
                        ].map((t) => ({ value: t, label: t })),
                      ]}
                      onChange={(val) => {
                        setType(val);
                        setPage(1);
                      }}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">State</label>
                    <div className="state-drop-wrap" ref={stateDropRef}>
                      <button
                        type="button"
                        className="state-drop-btn"
                        onClick={() => setStateDropOpen((o) => !o)}
                      >
                        <span
                          style={{
                            color: selectedStates.length
                              ? "#fff"
                              : "rgba(255,255,255,0.3)",
                          }}
                        >
                          {selectedStates.length === 0
                            ? "Any state"
                            : selectedStates.length === 1
                              ? (US_STATES.find(
                                  (s) => s.abbr === selectedStates[0],
                                )?.name ?? selectedStates[0])
                              : `${selectedStates.length} states selected`}
                        </span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="currentColor"
                          style={{
                            color: "rgba(255,255,255,0.35)",
                            flexShrink: 0,
                          }}
                        >
                          <path
                            d="M2 4l4 4 4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                            strokeLinecap="round"
                          />
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
                                    prev.includes(s.abbr)
                                      ? prev.filter((x) => x !== s.abbr)
                                      : [...prev, s.abbr],
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
                    <label className="filter-label" htmlFor="city-filter">
                      City
                    </label>
                    <input
                      id="city-filter"
                      className="filter-input"
                      placeholder="Phoenix"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>

                <div className="filter-row">
                  <div className="filter-group">
                    <label className="filter-label" htmlFor="minprice-filter">
                      Min Price
                    </label>
                    <CustomSelect
                      id="minprice-filter"
                      value={minPriceDollars}
                      placeholder="Any"
                      options={[
                        { value: "", label: "Any" },
                        ...PRICE_OPTIONS.map((v) => ({
                          value: String(v),
                          label: `$${v}`,
                        })),
                      ]}
                      onChange={(val) => {
                        setMinPriceDollars(val);
                        setPage(1);
                      }}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label" htmlFor="maxprice-filter">
                      Max Price
                    </label>

                    <CustomSelect
                      id="maxprice-filter"
                      value={maxPriceDollars}
                      placeholder="Any"
                      options={[
                        { value: "", label: "Any" },
                        ...PRICE_OPTIONS.map((v) => ({
                          value: String(v),
                          label: `$${v}`,
                        })),
                      ]}
                      onChange={(val) => {
                        setMaxPriceDollars(val);
                        setPage(1);
                      }}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label" htmlFor="property-filter">
                      Property Type
                    </label>
                    <CustomSelect
                      id="property-filter"
                      value={propertyType}
                      placeholder="Any"
                      options={[
                        { value: "", label: "Any" },
                        ...[
                          "Single Family",
                          "Multifamily",
                          "Mobile Home",
                          "Land",
                        ].map((t) => ({ value: t, label: t })),
                      ]}
                      onChange={(val) => {
                        setPropertyType(val);
                        setPage(1);
                      }}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label" htmlFor="zip-filter">
                      ZIP Code
                    </label>
                    <input
                      id="zip-filter"
                      className="filter-input"
                      placeholder="85001"
                      value={zip}
                      onChange={(e) => {
                        setZip(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>

                <div
                  className="filter-row"
                  style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}
                >
                  <div className="filter-group">
                    <label className="filter-label" htmlFor="condition-filter">
                      Condition
                    </label>
                    <CustomSelect
                      id="condition-filter"
                      value={condition}
                      placeholder="Any"
                      options={[
                        { value: "", label: "Any" },
                        ...["Needs Repairs", "Move In Ready", "Full Gut"].map(
                          (t) => ({ value: t, label: t }),
                        ),
                      ]}
                      onChange={(val) => {
                        setCondition(val);
                        setPage(1);
                      }}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label" htmlFor="timeline-filter">
                      Timeline
                    </label>
                    <CustomSelect
                      id="timeline-filter"
                      value={timeline}
                      placeholder="Any"
                      options={[
                        { value: "", label: "Any" },
                        ...[
                          "ASAP",
                          "0 to 30 Days",
                          "60 to 90 Days",
                          "No Rush",
                        ].map((t) => ({ value: t, label: t })),
                      ]}
                      onChange={(val) => {
                        setTimeline(val);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="filter-actions">
                    <button
                      type="button"
                      className="clear-inline-btn"
                      onClick={clearFilters}
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </section>
            )}

            {isError && (
              <div className="err">
                {(error as Error)?.message ?? "Failed to load marketplace"}
                <button
                  type="button"
                  style={{
                    marginLeft: 12,
                    padding: "6px 12px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                  onClick={() => refetch()}
                >
                  Retry
                </button>
              </div>
            )}

            <div className="leads-grid">
              {!isLoading && items.length === 0 && (
                <div className="empty-state">
                  <p style={{ fontSize: 16, marginBottom: 8 }}>
                    No leads match your filters.
                  </p>
                  <p style={{ fontSize: 13 }}>
                    Try adjusting the filters or broadening your search.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="clear-filters-btn"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {items.map((lead) => {
                const leadType = (lead.lead_type ?? "inbound").toLowerCase();
                const exclusivePrice =
                  lead.exclusive_price_cents ?? lead.current_price;
                const sharedTaken = lead.non_exclusive_buyers_count ?? 0;
                const sharedCap =
                  lead.max_non_exclusive_buyers ??
                  (leadType === "outbound" ? 3 : 5);
                // Flat subscription price: $30 inbound / $20 outbound (from API)
                const sharedPrice = getSharedDisplayCents(
                  lead.shared_price_cents,
                  leadType,
                );
                const sharedAvailable = sharedTaken < sharedCap;
                const exclusiveAvailable = sharedTaken === 0;
                // Partially claimed: some slots taken but still open
                const isPartiallyClaimed =
                  sharedTaken > 0 && sharedTaken < sharedCap;
                const slotsLeft = sharedCap - sharedTaken;

                const isInEarlyAccess =
                  lead.early_access_until != null &&
                  new Date(lead.early_access_until) > new Date();
                const timeLeft = lead.early_access_until
                  ? timeUntil(lead.early_access_until)
                  : "";

                const isBuying = buyMutation.isPending;

                // Boost / discount badge from list_price_anchor_cents
                const anchorCents = lead.list_price_anchor_cents
                  ? Number(lead.list_price_anchor_cents)
                  : null;
                const currentExclCents = lead.exclusive_price_cents
                  ? Number(lead.exclusive_price_cents)
                  : null;
                let priceBadge: {
                  label: string;
                  color: string;
                  bg: string;
                } | null = null;
                if (
                  anchorCents &&
                  currentExclCents &&
                  anchorCents !== currentExclCents
                ) {
                  const pct = Math.round(
                    ((currentExclCents - anchorCents) / anchorCents) * 100,
                  );
                  if (pct > 0) {
                    priceBadge = {
                      label: `+${pct}% boost`,
                      color: "#fbbf24",
                      bg: "rgba(245,158,11,0.15)",
                    };
                  } else if (pct < 0) {
                    priceBadge = {
                      label: `${pct}% off`,
                      color: "#34d399",
                      bg: "rgba(16,185,129,0.12)",
                    };
                  }
                }

                // Visible property details
                const marketParts = lead.market
                  .split(",")
                  .map((part) => part.trim())
                  .filter(Boolean);
                const city = metaValue(lead, ["city"], marketParts[0] ?? "—");
                const state = metaValue(lead, ["state"], marketParts[1] ?? "—");
                const locationLabel =
                  [city, state].filter((part) => part !== "—").join(", ") ||
                  lead.market;
                const propType = metaValue(lead, [
                  "property_type",
                  "propertyType",
                  "Propertytype",
                ]);
                const timeline = metaValue(lead, ["timeline", "howsoontosell"]);
                const condition = metaValue(lead, [
                  "condition",
                  "property_condition",
                ]);

                return (
                  <div
                    key={lead.id}
                    className="lead-card"
                    onClick={() => openModal(lead)}
                  >
                    {/* Top Badges */}
                    <div className="lead-card-header">
                      <span className={`lead-type-badge ${leadType}`}>
                        {leadType}
                      </span>
                      <div className="lead-badges-right">
                        {priceBadge && (
                          <span
                            className="price-boost-badge"
                            style={{
                              color: priceBadge.color,
                              background: priceBadge.bg,
                              borderColor: `${priceBadge.color}44`,
                            }}
                          >
                            {priceBadge.label}
                          </span>
                        )}
                        {isInEarlyAccess && (
                          <span className="early-access-badge">
                            Pro early access{timeLeft ? ` · ${timeLeft}` : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Location Title (Primary Focus) */}
                    <h3 className="lead-location-title">{locationLabel}</h3>

                    {/* Property Info Grid */}
                    <div className="lead-details-grid">
                      {[
                        { label: "type", value: propType },
                        { label: "timeline", value: timeline },
                        { label: "condition", value: condition },
                      ].map(({ label, value }) => (
                        <div key={label} className="detail-row">
                          <span className="detail-label">{label}</span>
                          <span
                            className={`detail-value ${value === "—" ? "empty" : ""}`}
                          >
                            {value !== "—" ? value : "—"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Price Options (Using the fixed flex logic) */}
                    <div
                      className="price-row"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Exclusive Card */}
                      <div
                        className={`price-option exclusive ${!exclusiveAvailable && !isPartiallyClaimed ? "locked" : ""}`}
                      >
                        <div className="price-option-label">Exclusive</div>
                        <div className="price-option-amount">
                          {fmtDollars(exclusivePrice)}
                        </div>

                        {isPartiallyClaimed ? (
                          <>
                            <div className="price-option-sub warn-text">
                              Lock it
                            </div>
                            {!isInEarlyAccess && (
                              <button
                                type="button"
                                className="price-option-btn exclusive"
                                disabled={exclusiveBuyoutMutation.isPending}
                                onClick={() =>
                                  exclusiveBuyoutMutation.mutate(lead.id)
                                }
                              >
                                {exclusiveBuyoutMutation.isPending
                                  ? "…"
                                  : "Buy exclusive"}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="price-option-sub">
                              You own it alone
                            </div>
                            {!isInEarlyAccess ? (
                              <button
                                type="button"
                                className="price-option-btn exclusive"
                                disabled={isBuying || !exclusiveAvailable}
                                onClick={() =>
                                  buyMutation.mutate({
                                    id: lead.id,
                                    choice: "exclusive",
                                  })
                                }
                              >
                                {isBuying
                                  ? "…"
                                  : exclusiveAvailable
                                    ? "Buy exclusive"
                                    : "Locked"}
                              </button>
                            ) : (
                              <div className="early-access-note">
                                Pro subscribers first
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Non-Exclusive Card */}
                      <div
                        className={`price-option non-exclusive ${!sharedAvailable ? "locked" : ""}`}
                      >
                        <div className="price-option-label">
                          Non Exclusive
                          {/* {isPartiallyClaimed && (
                            <span className="partial-badge">PARTIAL</span>
                          )} */}
                        </div>

                        {isSubscribed ? (
                          <>
                            <div className="price-option-amount">
                              {fmtDollars(sharedPrice)}
                            </div>
                            {sharedAvailable && (
                              <div className="slot-bar">
                                <div className="slot-pips">
                                  {Array.from({ length: sharedCap }).map(
                                    (_, i) => (
                                      <span
                                        key={i}
                                        className={`slot-pip ${i < sharedTaken ? (sharedTaken >= sharedCap - 1 ? "warn" : "taken") : "open"}`}
                                      />
                                    ),
                                  )}
                                </div>
                                <span className="slot-text">
                                  {slotsLeft}/{sharedCap} left
                                </span>
                              </div>
                            )}
                            {!sharedAvailable && (
                              <div className="price-option-sub">
                                All slots filled
                              </div>
                            )}

                            {!isInEarlyAccess && sharedAvailable && (
                              <button
                                type="button"
                                className="price-option-btn non-exclusive"
                                disabled={isBuying}
                                onClick={() =>
                                  buyMutation.mutate({
                                    id: lead.id,
                                    choice: "non_exclusive",
                                  })
                                }
                              >
                                {isBuying ? "…" : "Buy"}
                              </button>
                            )}
                            {isInEarlyAccess && (
                              <div className="early-access-note">
                                Pro subscribers first
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="price-option-amount">
                              {fmtDollars(sharedPrice)}
                            </div>
                            <div className="upsell-text">only for members</div>
                            <Link
                              href="/subscriptions"
                              className="price-option-btn non-exclusive block-btn"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Subscribe →
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="pager">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <span className="pager-info">
                Page {page}
                {total > 0 ? ` of ${Math.ceil(total / PAGE_SIZE)}` : ""}
              </span>
              <button
                type="button"
                disabled={page * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
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
          <div key={t.id} className={`toast ${t.variant}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
