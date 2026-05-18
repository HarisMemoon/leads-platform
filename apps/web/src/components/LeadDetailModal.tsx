"use client";

import { useEffect, useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeadDetailResponse, LeadQuoteResponse, MarketplaceLeadRow } from "@/lib/leads-api";
import { ApiError } from "@/lib/api";
import { createRefundRequest, patchAssignmentLifecycle } from "@/lib/leads-api";
import { queryKeys } from "@/lib/query-keys";

const PIPELINE_PHASES = [
  "open",
  "contacted",
  "under_contract",
  "closed_won",
] as const;

const PIPELINE_LABELS: Record<(typeof PIPELINE_PHASES)[number], string> = {
  open: "Open",
  contacted: "Contacted",
  under_contract: "Under contract",
  closed_won: "Closed",
};

function MyLeadPipelineBlock({
  leadId,
  assignment,
}: {
  leadId: string;
  assignment: NonNullable<LeadDetailResponse["lead_assignments"]>[number];
}) {
  const qc = useQueryClient();
  const aid = assignment.assignment_id;
  const [phase, setPhase] = useState(assignment.lifecycle_phase ?? "open");
  const [contract, setContract] = useState(
    assignment.contract_price_cents != null
      ? String(Number(assignment.contract_price_cents) / 100)
      : "",
  );
  const [sell, setSell] = useState(
    assignment.sell_price_cents != null ? String(Number(assignment.sell_price_cents) / 100) : "",
  );
  const [notes, setNotes] = useState(assignment.buyer_notes ?? "");
  const [refundReason, setRefundReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setPhase(assignment.lifecycle_phase ?? "open");
    setContract(
      assignment.contract_price_cents != null
        ? String(Number(assignment.contract_price_cents) / 100)
        : "",
    );
    setSell(
      assignment.sell_price_cents != null ? String(Number(assignment.sell_price_cents) / 100) : "",
    );
    setNotes(assignment.buyer_notes ?? "");
  }, [assignment]);

  const saveMut = useMutation({
    mutationFn: () =>
      patchAssignmentLifecycle(aid, {
        lifecycle_phase: phase,
        contract_price_cents: contract.trim() === "" ? null : Math.round(Number(contract) * 100),
        sell_price_cents: sell.trim() === "" ? null : Math.round(Number(sell) * 100),
        buyer_notes: notes.trim() === "" ? null : notes.trim(),
      }),
    onSuccess: async () => {
      setMsg("Pipeline saved.");
      await qc.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      await qc.invalidateQueries({ queryKey: ["leads", "my"] });
    },
    onError: (e: Error) => setMsg(e.message || "Save failed"),
  });

  const refundMut = useMutation({
    mutationFn: () => createRefundRequest(aid, refundReason.trim()),
    onSuccess: async () => {
      setMsg("Refund request submitted.");
      setRefundReason("");
      await qc.invalidateQueries({ queryKey: ["leads", "my"] });
    },
    onError: (e: Error) => setMsg(e.message || "Refund request failed"),
  });

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="ldm-section-h">Pipeline &amp; deal</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          Stage
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              color: "#fff",
            }}
          >
            {PIPELINE_PHASES.map((p) => (
              <option key={p} value={p}>
                {PIPELINE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          Contract price (USD)
          <input
            type="number"
            min={0}
            step="0.01"
            value={contract}
            onChange={(e) => setContract(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              color: "#fff",
            }}
          />
        </label>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          Sell / exit price (USD)
          <input
            type="number"
            min={0}
            step="0.01"
            value={sell}
            onChange={(e) => setSell(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              color: "#fff",
            }}
          />
        </label>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              color: "#fff",
              resize: "vertical",
            }}
          />
        </label>
        <button
          type="button"
          className="ldm-buy"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? "Saving…" : "Save pipeline"}
        </button>
      </div>
      <div className="ldm-section-h" style={{ marginTop: 22 }}>
        CRM sync
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
        GHL: {assignment.ghl_sync_status} · CRM: {assignment.crm_sync_status}
      </p>
      <div className="ldm-section-h" style={{ marginTop: 18 }}>
        Refund request
      </div>
      <textarea
        placeholder="Reason (required to submit)"
        value={refundReason}
        onChange={(e) => setRefundReason(e.target.value)}
        rows={2}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.25)",
          color: "#fff",
          marginBottom: 8,
        }}
      />
      <button
        type="button"
        className="ldm-hold"
        disabled={refundMut.isPending || !refundReason.trim()}
        onClick={() => refundMut.mutate()}
      >
        {refundMut.isPending ? "Submitting…" : "Submit refund request"}
      </button>
      {msg ? <p className="ldm-err" style={{ marginTop: 10, color: "#a5b4fc" }}>{msg}</p> : null}
    </div>
  );
}

export function exclusivityLabel(e: string) {
  return (
    {
      exclusive: "Exclusive",
      semi_exclusive: "Semi-Exclusive",
      shared: "Shared",
    } as Record<string, string>
  )[e] ?? e;
}

export function exclusivityColor(e: string) {
  return (
    {
      exclusive: {
        bg: "rgba(139,92,246,0.15)",
        color: "#c4b5fd",
        border: "rgba(139,92,246,0.35)",
      },
      semi_exclusive: {
        bg: "rgba(245,158,11,0.12)",
        color: "#fcd34d",
        border: "rgba(245,158,11,0.3)",
      },
      shared: {
        bg: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.45)",
        border: "rgba(255,255,255,0.1)",
      },
    } as Record<string, { bg: string; color: string; border: string }>
  )[e] ?? { bg: "", color: "#fff", border: "" };
}

export function fmtDollarsModal(cents: string | number) {
  return `$${(Number(cents) / 100).toFixed(0)}`;
}

function toSafeCents(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function computeSharedDisplayCents(
  exclusivePriceCents: string | number,
  sharedCap: number | null | undefined,
) {
  const exclusive = toSafeCents(exclusivePriceCents);
  const cap = Math.max(1, Number(sharedCap ?? 3));
  return Math.max(0, Math.floor(exclusive / cap));
}

export function fmtDateModal(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function modalMetaValue(
  meta: Record<string, unknown> | undefined,
  keys: string[],
  fallback = "—",
) {
  for (const key of keys) {
    const value = meta?.[key];
    if (value != null && String(value).trim() !== "") return String(value);
  }
  return fallback;
}

export function QualityBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 4 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 2,
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 28, textAlign: "right", flexShrink: 0 }}>
        {pct}
      </span>
    </div>
  );
}

function PriceHistoryTable({ rows }: { rows: LeadDetailResponse["lead_price_history"] }) {
  if (!rows.length) {
    return (
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "8px 0" }}>No price changes recorded.</p>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {["Date", "From", "To", "Reason"].map((h) => (
            <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <td style={{ padding: "5px 6px", color: "rgba(255,255,255,0.5)" }}>{fmtDateModal(r.changed_at)}</td>
            <td style={{ padding: "5px 6px", color: "rgba(255,255,255,0.55)", textDecoration: "line-through" }}>
              {fmtDollarsModal(r.old_price_cents)}
            </td>
            <td style={{ padding: "5px 6px", color: "#a5b4fc", fontWeight: 600 }}>{fmtDollarsModal(r.new_price_cents)}</td>
            <td style={{ padding: "5px 6px", color: "rgba(255,255,255,0.4)" }}>{r.reason || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const modalStyles = `
  .ldm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(8px); }
  .ldm-modal { background: #0d0f17; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 32px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
  .ldm-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; gap: 12px; }
  .ldm-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.3; }
  .ldm-close { background: rgba(255,255,255,0.07); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; color: rgba(255,255,255,0.5); font-size: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .ldm-close:hover { background: rgba(255,255,255,0.12); color: #fff; }
  .ldm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  .ldm-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px; }
  .ldm-item.full { grid-column: 1 / -1; }
  .ldm-label { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 5px; }
  .ldm-value { font-size: 13px; color: rgba(255,255,255,0.85); }
  .ldm-blur { filter: blur(4px); user-select: none; opacity: 0.76; }
  .ldm-price-row { display: flex; justify-content: space-between; align-items: center; margin: 16px 0; padding: 18px; background: rgba(99,102,241,0.08); border-radius: 14px; border: 1px solid rgba(99,102,241,0.2); }
  .ldm-price-big { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; }
  .ldm-section-h { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.8px; margin: 18px 0 10px; }
  .ldm-buy { width: 100%; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 700; color: #fff; cursor: pointer; font-family: 'Syne', sans-serif; margin-top: 14px; transition: opacity 0.15s; }
  .ldm-buy:hover { opacity: 0.9; }
  .ldm-buy:disabled { opacity: 0.45; cursor: not-allowed; }
  .ldm-hold { width: 100%; margin-top: 8px; padding: 12px; border-radius: 12px; border: 1px solid rgba(99,102,241,0.35); background: rgba(99,102,241,0.08); color: #c7d2fe; font-weight: 600; cursor: pointer; font-size: 14px; font-family: 'DM Sans', sans-serif; }
  .ldm-timer { text-align: center; font-size: 13px; color: #fbbf24; margin: 10px 0; }
  .ldm-err { color: #f87171; font-size: 13px; margin: 8px 0; }
  .ldm-skeleton { background: rgba(255,255,255,0.06); border-radius: 8px; animation: ldm-pulse 1.4s ease infinite; }
  @keyframes ldm-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
  .ldm-excl { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 100px; border: 1px solid; white-space: nowrap; }
  .ldm-was { font-size: 11px; color: rgba(255,255,255,0.3); text-decoration: line-through; }
`;

export type LeadDetailModalProps = {
  leadId: string | null;
  onClose: () => void;
  listPreview?: MarketplaceLeadRow | null;
  myLeadPreview?: {
    assignment_id: string;
    charged_amount: string;
    exclusivity_choice?: "exclusive" | "non_exclusive";
    purchase_type?: string;
  } | null;
  detail: LeadDetailResponse | undefined;
  detailLoading: boolean;
  purchaseActions?: boolean;
  enableAssignmentPipeline?: boolean;
  walletBalanceCents?: number;
  reserveMutation?: UseMutationResult<
    { reserved_until: string; ttl_seconds: number },
    unknown,
    string
  >;
  buyMutation?: UseMutationResult<{ id: string }, unknown, { id: string; choice: "exclusive" | "non_exclusive" }>;
  reserveUntil?: string | null;
  secondsLeft?: number;
  getLeadQuote?: (leadId: string, choice: "exclusive" | "non_exclusive") => Promise<LeadQuoteResponse>;
};

export function LeadDetailModal({
  leadId,
  onClose,
  listPreview = null,
  myLeadPreview = null,
  detail,
  detailLoading,
  purchaseActions = false,
  enableAssignmentPipeline = false,
  walletBalanceCents = 0,
  reserveMutation,
  buyMutation,
  reserveUntil = null,
  secondsLeft = 0,
  getLeadQuote,
}: LeadDetailModalProps) {
  const [exclusivityChoice, setExclusivityChoice] = useState<"exclusive" | "non_exclusive">("non_exclusive");

  const { data: quoteData } = useQuery({
    queryKey: queryKeys.leads.quote(leadId ?? "", exclusivityChoice),
    queryFn: () => getLeadQuote!(leadId!, exclusivityChoice),
    enabled: !!leadId && !!getLeadQuote && purchaseActions,
    staleTime: 30_000,
  });

  if (!leadId) return null;

  const modalLead = detail?.lead;
  const modalPriceHistory = detail?.lead_price_history ?? [];
  const matchedAssignment =
    detail?.lead_assignments?.find(
      (a) => a.assignment_id === myLeadPreview?.assignment_id,
    ) ?? detail?.lead_assignments?.[0];

  const exclusivePrice = listPreview?.exclusive_price_cents ?? listPreview?.current_price ?? "0";
  const sharedCap = listPreview?.max_non_exclusive_buyers ?? 3;
  const sharedPrice = computeSharedDisplayCents(exclusivePrice, sharedCap);
  const rawPrice = exclusivityChoice === "exclusive" ? Number(exclusivePrice) : Number(sharedPrice);
  const isPro = quoteData?.is_pro ?? false;
  const canBuyNow = quoteData?.can_buy_now ?? true;
  const effectivePrice = quoteData ? Number(quoteData.effective_price_cents) : rawPrice;

  const modalAnchorCents = modalLead?.list_price_anchor_cents
    ? Number(modalLead.list_price_anchor_cents)
    : listPreview?.list_price_anchor_cents
      ? Number(listPreview.list_price_anchor_cents)
      : null;
  const modalMeta = modalLead?.metadata ?? listPreview?.metadata ?? {};
  const shouldBlurPrivate = purchaseActions;
  const privateClass = shouldBlurPrivate ? " ldm-blur" : "";

  const sharedTaken = listPreview?.non_exclusive_buyers_count ?? 0;
  const earlyAccessUntil = listPreview?.early_access_until ?? null;
  const isInEarlyAccess = earlyAccessUntil != null && new Date(earlyAccessUntil) > new Date();

  return (
    <>
      <style>{modalStyles}</style>
      <style>{`.ldm-seg { display: flex; gap: 6px; margin-bottom: 12px; }
        .ldm-seg-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.55); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .ldm-seg-btn.active-excl { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.35); color: #fbbf24; }
        .ldm-seg-btn.active-shared { background: rgba(99,102,241,0.14); border-color: rgba(99,102,241,0.35); color: #a5b4fc; }
        .ldm-early-access { padding: 10px 14px; border-radius: 10px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); font-size: 12px; color: #fbbf24; margin-bottom: 12px; }
        .ldm-pro-badge { display: inline-block; font-size: 10px; font-weight: 700; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border-radius: 100px; padding: 2px 7px; margin-left: 6px; vertical-align: middle; }
      `}</style>
      <div className="ldm-overlay" onClick={onClose} role="presentation">
        <div className="ldm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="ldm-header">
            <div className="ldm-title">
              {modalLead?.title ?? listPreview?.title ?? "Lead detail"}
              {isPro && <span className="ldm-pro-badge">Pro</span>}
            </div>
            <button type="button" className="ldm-close" onClick={onClose} aria-label="Close">×</button>
          </div>

          {detailLoading && !listPreview ? (
            <>
              {[100, 80, 120, 90].map((w, i) => (
                <div key={i} className="ldm-skeleton" style={{ height: 52, marginBottom: 10, width: `${w}%` }} />
              ))}
            </>
          ) : (
            <>
              <div className="ldm-grid">
                <div className="ldm-item">
                  <div className="ldm-label">Date</div>
                  <div className="ldm-value">{fmtDateModal(modalLead?.created_at ?? listPreview?.created_at ?? "")}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Lead type</div>
                  <div className="ldm-value">{modalLead?.type ?? listPreview?.type}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">City</div>
                  <div className="ldm-value">{modalMetaValue(modalMeta, ["city"])}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">State</div>
                  <div className="ldm-value">{modalMetaValue(modalMeta, ["state"])}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Property type</div>
                  <div className="ldm-value">{modalMetaValue(modalMeta, ["property_type", "propertyType"])}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Timeline</div>
                  <div className="ldm-value">{modalMetaValue(modalMeta, ["timeline"])}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Condition</div>
                  <div className="ldm-value">{modalMetaValue(modalMeta, ["condition"])}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">ZIP</div>
                  <div className="ldm-value">{modalMetaValue(modalMeta, ["zip", "postal"])}</div>
                </div>
                <div className="ldm-item full">
                  <div className="ldm-label">Name</div>
                  <div className={`ldm-value${privateClass}`}>{modalMetaValue(modalMeta, ["name", "full_name", "first_name"])}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Phone</div>
                  <div className={`ldm-value${privateClass}`}>{modalMetaValue(modalMeta, ["phone", "mobile"])}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Email</div>
                  <div className={`ldm-value${privateClass}`}>{modalMetaValue(modalMeta, ["email"])}</div>
                </div>
                <div className="ldm-item full">
                  <div className="ldm-label">Full address</div>
                  <div className={`ldm-value${privateClass}`}>{modalMetaValue(modalMeta, ["address", "full_address", "street"], modalLead?.market ?? listPreview?.market ?? "—")}</div>
                </div>
              </div>

              {purchaseActions && (
                <>
                  {isInEarlyAccess && (
                    <div className="ldm-early-access">
                      ⚡ Pro early access — this lead is not yet open to all buyers
                    </div>
                  )}

                  {/* Exclusive vs Shared segmented control */}
                  <div className="ldm-section-h">Purchase type</div>
                  <div className="ldm-seg">
                    <button
                      type="button"
                      className={`ldm-seg-btn${exclusivityChoice === "exclusive" ? " active-excl" : ""}`}
                      onClick={() => setExclusivityChoice("exclusive")}
                    >
                      Exclusive — {fmtDollarsModal(exclusivePrice)}
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>1 buyer only</div>
                    </button>
                    <button
                      type="button"
                      className={`ldm-seg-btn${exclusivityChoice === "non_exclusive" ? " active-shared" : ""}`}
                      onClick={() => setExclusivityChoice("non_exclusive")}
                    >
                      Non Exclusive — {fmtDollarsModal(sharedPrice)}
                      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 4 }}>
                        {Array.from({ length: sharedCap }).map((_, i) => {
                          let bg = "rgba(255,255,255,0.18)";
                          if (i < sharedTaken) bg = "#10b981";
                          else if (i === sharedTaken && sharedTaken === sharedCap - 1) bg = "#f59e0b";
                          return <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: bg, display: "inline-block" }} />;
                        })}
                      </div>
                    </button>
                  </div>
                </>
              )}

              <div className="ldm-price-row">
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                    {purchaseActions ? "Your price" : "Price"}
                    {isPro && purchaseActions && <span style={{ fontSize: 11, color: "#a5b4fc", marginLeft: 6 }}>10% Pro discount applied</span>}
                  </div>
                  <div className="ldm-price-big">
                    {fmtDollarsModal(
                      purchaseActions
                        ? effectivePrice
                        : matchedAssignment?.charged_amount != null
                          ? Number(matchedAssignment.charged_amount)
                          : myLeadPreview?.charged_amount != null
                            ? Number(myLeadPreview.charged_amount)
                          : modalLead
                            ? Number(modalLead.current_price)
                            : rawPrice,
                    )}
                  </div>
                  {modalAnchorCents != null && modalAnchorCents > effectivePrice && (
                    <div className="ldm-was">Was {fmtDollarsModal(modalAnchorCents)}</div>
                  )}
                  {!purchaseActions && (matchedAssignment?.purchase_type || myLeadPreview?.purchase_type) && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                      Purchased as{" "}
                      {matchedAssignment?.exclusivity_choice === "exclusive"
                        ? "Exclusive"
                        : matchedAssignment?.exclusivity_choice === "non_exclusive"
                          ? "Non Exclusive"
                          : myLeadPreview?.exclusivity_choice === "exclusive"
                            ? "Exclusive"
                            : myLeadPreview?.exclusivity_choice === "non_exclusive"
                              ? "Non Exclusive"
                          : (matchedAssignment?.purchase_type ?? myLeadPreview?.purchase_type ?? "")
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </div>
                  )}
                </div>
                {purchaseActions && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Balance after</div>
                    <div style={{
                      fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 700,
                      color: walletBalanceCents >= effectivePrice ? "#6ee7b7" : "#fca5a5",
                    }}>
                      {fmtDollarsModal(walletBalanceCents - effectivePrice)}
                    </div>
                  </div>
                )}
              </div>

              {!purchaseActions && (modalPriceHistory.length > 0 || detailLoading) && (
                <>
                  <div className="ldm-section-h">Price history</div>
                  {detailLoading ? (
                    <div className="ldm-skeleton" style={{ height: 40, borderRadius: 8 }} />
                  ) : (
                    <PriceHistoryTable rows={modalPriceHistory} />
                  )}
                </>
              )}

              {!purchaseActions && detail?.lead_assignments && detail.lead_assignments.length > 0 && (
                <>
                  <div className="ldm-section-h">Your purchase</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                    {detail.lead_assignments.map((a) => (
                      <li key={a.assignment_id} style={{ marginBottom: 6 }}>
                        {new Date(a.assigned_at).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}{" "}· Paid {fmtDollarsModal(a.charged_amount)} · {a.purchase_type.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {!purchaseActions && enableAssignmentPipeline && detail?.lead_assignments && detail.lead_assignments.length > 0 && leadId && (
                <MyLeadPipelineBlock leadId={leadId} assignment={detail.lead_assignments[0]} />
              )}

              {purchaseActions && reserveMutation?.isError && (
                <div className="ldm-err">{(reserveMutation.error as Error).message}</div>
              )}
              {purchaseActions && buyMutation?.isError && (
                <div className="ldm-err">
                  {buyMutation.error instanceof ApiError && buyMutation.error.status === 403
                    ? "This lead is in Pro early access — upgrade to Pro to purchase now"
                    : buyMutation.error instanceof ApiError && buyMutation.error.status === 400
                      ? (buyMutation.error as ApiError).message.includes("wallet") ? "Insufficient wallet balance — top up your wallet" : (buyMutation.error as ApiError).message
                      : buyMutation.error instanceof ApiError && buyMutation.error.status === 409
                        ? "This lead was just purchased by someone else"
                        : (buyMutation.error as Error).message}
                </div>
              )}

              {purchaseActions && reserveUntil && secondsLeft > 0 && (
                <div className="ldm-timer">
                  Checkout hold: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")} remaining
                </div>
              )}

              {purchaseActions && !reserveUntil && reserveMutation && (
                <button type="button" className="ldm-hold" disabled={reserveMutation.isPending}
                  onClick={() => leadId && reserveMutation.mutate(leadId)}>
                  {reserveMutation.isPending ? "Reserving…" : "Start checkout hold (15 min)"}
                </button>
              )}

              {purchaseActions && buyMutation && (
                <button
                  type="button"
                  className="ldm-buy"
                  disabled={buyMutation.isPending || (!!reserveUntil && secondsLeft <= 0) || !canBuyNow}
                  onClick={() => leadId && buyMutation.mutate({ id: leadId, choice: exclusivityChoice })}
                >
                  {!canBuyNow
                    ? "Pro early access only"
                    : buyMutation.isPending
                      ? "Processing…"
                      : `Confirm ${exclusivityChoice === "exclusive" ? "exclusive" : "non-exclusive"} purchase`}
                </button>
              )}

              {purchaseActions && (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
                  You can buy without a hold if the lead is still available. A hold blocks other buyers for 15 minutes.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
