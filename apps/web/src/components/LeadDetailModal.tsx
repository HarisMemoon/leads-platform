"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Lock,
  X,
  MapPin,
  Calendar,
  Home,
  CheckCircle2,
  Shield,
  Info,
  Clock,
} from "lucide-react";
import type {
  LeadDetailResponse,
  LeadQuoteResponse,
  MarketplaceLeadRow,
} from "@/lib/leads-api";
import { ApiError } from "@/lib/api";
import { createRefundRequest, patchAssignmentLifecycle } from "@/lib/leads-api";
import { getSubscriptionPricing } from "@/lib/subscriptions-api";
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

// ---------------------------------------------
// UI Helper Components & Functions
// ---------------------------------------------

export function exclusivityLabel(e: string) {
  return (
    (
      {
        exclusive: "Exclusive",
        semi_exclusive: "Semi-Exclusive",
        shared: "Shared",
      } as Record<string, string>
    )[e] ?? e
  );
}

export function exclusivityColor(e: string) {
  return (
    (
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
    )[e] ?? { bg: "", color: "#fff", border: "" }
  );
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
    const text = value != null ? String(value).trim() : "";
    if (text && !/^•+$/.test(text)) return text;
  }
  return fallback;
}

export function QualityBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="ldm-quality-bar-wrapper">
      <div className="ldm-quality-track">
        <div
          className="ldm-quality-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="ldm-quality-text">{pct}</span>
    </div>
  );
}

// ---------------------------------------------
// Sub-Components
// ---------------------------------------------

function PriceHistoryTable({
  rows,
}: {
  rows: LeadDetailResponse["lead_price_history"];
}) {
  if (!rows.length) {
    return (
      <div className="ldm-empty-state">
        <Info size={16} />
        <p>No price changes recorded.</p>
      </div>
    );
  }
  return (
    <div className="ldm-table-container">
      <table className="ldm-table">
        <thead>
          <tr>
            {["Date", "From", "To", "Reason"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{fmtDateModal(r.changed_at)}</td>
              <td className="ldm-strike">
                {fmtDollarsModal(r.old_price_cents)}
              </td>
              <td className="ldm-highlight">
                {fmtDollarsModal(r.new_price_cents)}
              </td>
              <td className="ldm-muted">{r.reason || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
    assignment.sell_price_cents != null
      ? String(Number(assignment.sell_price_cents) / 100)
      : "",
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
      assignment.sell_price_cents != null
        ? String(Number(assignment.sell_price_cents) / 100)
        : "",
    );
    setNotes(assignment.buyer_notes ?? "");
  }, [assignment]);

  const saveMut = useMutation({
    mutationFn: () =>
      patchAssignmentLifecycle(aid, {
        lifecycle_phase: phase,
        contract_price_cents:
          contract.trim() === "" ? null : Math.round(Number(contract) * 100),
        sell_price_cents:
          sell.trim() === "" ? null : Math.round(Number(sell) * 100),
        buyer_notes: notes.trim() === "" ? null : notes.trim(),
      }),
    onSuccess: async () => {
      setMsg("Pipeline saved successfully.");
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
    <div className="ldm-pipeline-wrapper">
      <div className="ldm-section-header">
        <h3>Pipeline &amp; Deal</h3>
      </div>
      <div className="ldm-form-grid">
        <label className="ldm-input-label">
          Stage
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="ldm-input"
          >
            {PIPELINE_PHASES.map((p) => (
              <option key={p} value={p}>
                {PIPELINE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <div className="ldm-input-row">
          <label className="ldm-input-label">
            Contract Price (USD)
            <div className="ldm-input-with-icon">
              <span className="ldm-currency-symbol">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={contract}
                onChange={(e) => setContract(e.target.value)}
                className="ldm-input ldm-pl"
                placeholder="0.00"
              />
            </div>
          </label>
          <label className="ldm-input-label">
            Sell / Exit Price (USD)
            <div className="ldm-input-with-icon">
              <span className="ldm-currency-symbol">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={sell}
                onChange={(e) => setSell(e.target.value)}
                className="ldm-input ldm-pl"
                placeholder="0.00"
              />
            </div>
          </label>
        </div>

        <label className="ldm-input-label">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="ldm-input"
            placeholder="Add context about this lead..."
          />
        </label>
        <button
          type="button"
          className="ldm-btn-primary"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? "Saving changes..." : "Save pipeline"}
        </button>
      </div>

      <div className="ldm-sync-status">
        <div className="ldm-sync-badge">
          <CheckCircle2 size={14} /> GHL:{" "}
          <span>{assignment.ghl_sync_status}</span>
        </div>
        <div className="ldm-sync-badge">
          <CheckCircle2 size={14} /> CRM:{" "}
          <span>{assignment.crm_sync_status}</span>
        </div>
      </div>

      <div className="ldm-section-header ldm-mt">
        <h3>Refund Request</h3>
      </div>
      <div className="ldm-form-grid">
        <textarea
          placeholder="Please provide a reason for the refund (required)"
          value={refundReason}
          onChange={(e) => setRefundReason(e.target.value)}
          rows={2}
          className="ldm-input"
        />
        <button
          type="button"
          className="ldm-btn-secondary"
          disabled={refundMut.isPending || !refundReason.trim()}
          onClick={() => refundMut.mutate()}
        >
          {refundMut.isPending
            ? "Submitting request..."
            : "Submit refund request"}
        </button>
      </div>

      {msg && (
        <div className="ldm-alert-msg">
          <Info size={16} />
          {msg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------
// Core Styles
// ---------------------------------------------
const modalStyles = `
  .ldm-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(8px); animation: ldmFadeIn 0.2s ease-out; }
  .ldm-modal { background: #09090b; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); display: flex; flex-direction: column; position: relative; animation: ldmSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  
  /* Header */
  .ldm-header { position: sticky; top: 0; background: rgba(9, 9, 11, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
  .ldm-title-group { display: flex; align-items: center; gap: 12px; }
  .ldm-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
  .ldm-close { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.6); cursor: pointer; transition: all 0.2s ease; }
  .ldm-close:hover { background: rgba(255,255,255,0.1); color: #fff; transform: scale(1.05); }

  /* Body Content */
  .ldm-body { padding: 28px; display: flex; flex-direction: column; gap: 24px; }

  /* Stat Cards */
  .ldm-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
  .ldm-stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 14px 16px; transition: background 0.2s ease; }
  .ldm-stat-card:hover { background: rgba(255,255,255,0.05); }
  .ldm-stat-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: ; letter-spacing: 0.05em; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
  .ldm-stat-value { font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500; line-height: 1.4; }

  /* Private Container & Blurring */
  .ldm-private-wrapper { position: relative; border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%); overflow: hidden; }
  .ldm-private-header { padding: 12px 20px; background: rgba(99,102,241,0.1); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; }
  .ldm-private-header.locked { color: #f59e0b; }
  .ldm-private-header.unlocked { color: #10b981; }
  .ldm-private-content { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .ldm-private-content.is-blurred { filter: blur(6px); opacity: 0.5; user-select: none; pointer-events: none; }
  .ldm-private-item { display: flex; flex-direction: column; gap: 4px; }
  .ldm-private-item.full { grid-column: 1 / -1; }
  
  .ldm-lock-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 2; }
  .ldm-lock-badge { background: rgba(9, 9, 11, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; padding: 10px 20px; display: flex; align-items: center; gap: 8px; color: #fff; font-size: 13px; font-weight: 600; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }

  /* Section Headers */
  .ldm-section-header { margin: 8px 0 16px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; }
  .ldm-section-header h3 { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8); margin: 0; }
  .ldm-section-header.ldm-mt { margin-top: 32px; }

  /* Pricing Segment / Tiers */
  .ldm-tier-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .ldm-tier-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; cursor: pointer; transition: all 0.2s ease; position: relative; overflow: hidden; text-align: left; }
  .ldm-tier-card:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); }
  .ldm-tier-card.active-exclusive { background: rgba(139, 92, 246, 0.1); border-color: #8b5cf6; box-shadow: inset 0 0 0 1px #8b5cf6; }
  .ldm-tier-card.active-shared { background: rgba(59, 130, 246, 0.1); border-color: #3b82f6; box-shadow: inset 0 0 0 1px #3b82f6; }
  .ldm-tier-title { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; }
  .ldm-tier-price { font-family: 'Syne', sans-serif; font-size: 16px; }
  .ldm-tier-desc { font-size: 11px; color: rgba(255,255,255,0.45); line-height: 1.4; }
  .ldm-slots { display: flex; gap: 4px; margin-top: 10px; }
  .ldm-slot-dot { width: 6px; height: 6px; border-radius: 50%; }

  /* Checkout Action Area */
  .ldm-checkout-area { background: rgba(99,102,241,0.05); border: 1px solid rgba(99,102,241,0.2); border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .ldm-price-flex { display: flex; justify-content: space-between; align-items: flex-end; }
  .ldm-price-label { font-size: 13px; color: rgba(255,255,255,0.5); font-weight: 500; margin-bottom: 6px; }
  .ldm-price-large { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; color: #fff; line-height: 1; }
  .ldm-price-strike { font-size: 14px; color: rgba(255,255,255,0.3); text-decoration: line-through; margin-top: 4px; }
  .ldm-balance { text-align: right; }
  .ldm-balance-value { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; }
  .ldm-balance-ok { color: #34d399; }
  .ldm-balance-low { color: #f87171; }

  /* Buttons */
  .ldm-btn-primary { width: 100%; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #fff; border: none; border-radius: 12px; padding: 16px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 15px -3px rgba(99, 102, 241, 0.4); display: flex; justify-content: center; align-items: center; gap: 8px; }
  .ldm-btn-primary:hover:not(:disabled) { box-shadow: 0 6px 20px -3px rgba(99, 102, 241, 0.6); transform: translateY(-1px); }
  .ldm-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(50%); box-shadow: none; }
  
  .ldm-btn-secondary { width: 100%; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
  .ldm-btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
  .ldm-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Form & Pipeline */
  .ldm-pipeline-wrapper { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 18px; padding: 24px; margin-top: 24px; }
  .ldm-form-grid { display: flex; flex-direction: column; gap: 16px; }
  .ldm-input-label { display: flex; flex-direction: column; gap: 8px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.7); }
  .ldm-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 14px; transition: all 0.2s ease; outline: none; font-family: inherit; }
  .ldm-input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139,92,246,0.2); }
  .ldm-input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .ldm-input-with-icon { position: relative; display: flex; align-items: center; }
  .ldm-currency-symbol { position: absolute; left: 14px; color: rgba(255,255,255,0.4); font-weight: 600; }
  .ldm-pl { padding-left: 32px; }

  .ldm-sync-status { display: flex; gap: 12px; margin-top: 16px; }
  .ldm-sync-badge { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.04); padding: 6px 12px; border-radius: 20px; }
  .ldm-sync-badge span { color: #fff; }

  /* Misc */
  .ldm-badge-pro { background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 12px; text-transform: ; letter-spacing: 0.05em; }
  .ldm-early-access { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .ldm-timer { display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #fbbf24; margin-top: 12px; }
  .ldm-alert-msg { background: rgba(99,102,241,0.1); color: #a5b4fc; padding: 12px 16px; border-radius: 10px; font-size: 13px; display: flex; align-items: center; gap: 8px; margin-top: 16px; }
  .ldm-alert-err { background: rgba(239,68,68,0.1); color: #fca5a5; }

  /* Quality Bar component internal styles */
  .ldm-quality-bar-wrapper { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
  .ldm-quality-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
  .ldm-quality-fill { height: 100%; border-radius: 4px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
  .ldm-quality-text { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); min-width: 24px; text-align: right; }

  /* Tables */
  .ldm-table-container { border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; }
  .ldm-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
  .ldm-table th { background: rgba(255,255,255,0.02); padding: 12px 16px; color: rgba(255,255,255,0.4); font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .ldm-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.02); color: rgba(255,255,255,0.7); }
  .ldm-table tr:last-child td { border-bottom: none; }
  .ldm-strike { text-decoration: line-through; color: rgba(255,255,255,0.3) !important; }
  .ldm-highlight { color: #a5b4fc !important; font-weight: 600; }
  .ldm-muted { color: rgba(255,255,255,0.4) !important; }
  .ldm-empty-state { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.4); font-size: 13px; padding: 16px 0; }

  /* Skeletons */
  .ldm-skeleton-line { background: rgba(255,255,255,0.05); border-radius: 8px; height: 16px; margin-bottom: 12px; animation: pulse 1.5s infinite ease-in-out; }
  @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
  @keyframes ldmFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ldmSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
`;

// ---------------------------------------------
// Main Modal Component
// ---------------------------------------------

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
  buyMutation?: UseMutationResult<
    { id: string },
    unknown,
    { id: string; choice: "exclusive" | "non_exclusive" }
  >;
  reserveUntil?: string | null;
  secondsLeft?: number;
  getLeadQuote?: (
    leadId: string,
    choice: "exclusive" | "non_exclusive",
  ) => Promise<LeadQuoteResponse>;
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
  const [exclusivityChoice, setExclusivityChoice] = useState<
    "exclusive" | "non_exclusive"
  >("non_exclusive");

  const { data: quoteData } = useQuery({
    queryKey: queryKeys.leads.quote(leadId ?? "", exclusivityChoice),
    queryFn: () => getLeadQuote!(leadId!, exclusivityChoice),
    enabled: !!leadId && !!getLeadQuote && purchaseActions,
    staleTime: 30_000,
  });

  const { data: subPricing } = useQuery({
    queryKey: ["subscriptions", "pricing"],
    queryFn: getSubscriptionPricing,
    staleTime: 5 * 60 * 1000,
  });

  const leadSharedPrice =
    listPreview?.shared_price_cents != null &&
    Number(listPreview.shared_price_cents) > 0
      ? `$${Math.round(Number(listPreview.shared_price_cents) / 100)}`
      : null;
  const leadExclusivePrice =
    listPreview?.exclusive_price_cents != null &&
    Number(listPreview.exclusive_price_cents) > 0
      ? `$${Math.round(Number(listPreview.exclusive_price_cents) / 100)}`
      : listPreview?.current_price != null &&
          Number(listPreview.current_price) > 0
        ? `$${Math.round(Number(listPreview.current_price) / 100)}`
        : null;

  if (!leadId) return null;

  const modalLead = detail?.lead;
  const modalPriceHistory = detail?.lead_price_history ?? [];
  const matchedAssignment =
    detail?.lead_assignments?.find(
      (a) => a.assignment_id === myLeadPreview?.assignment_id,
    ) ?? detail?.lead_assignments?.[0];

  const exclusivePrice =
    listPreview?.exclusive_price_cents ?? listPreview?.current_price ?? "0";
  const _leadTypeForCap = (listPreview as any)?.lead_type ?? "inbound";
  const sharedCap =
    listPreview?.max_non_exclusive_buyers ??
    (_leadTypeForCap === "outbound" ? 3 : 5);
  const sharedPrice =
    listPreview?.shared_price_cents != null &&
    Number(listPreview.shared_price_cents) > 0
      ? Number(listPreview.shared_price_cents)
      : computeSharedDisplayCents(exclusivePrice, sharedCap);
  const rawPrice =
    exclusivityChoice === "exclusive"
      ? Number(exclusivePrice)
      : Number(sharedPrice);
  const isPro = quoteData?.is_pro ?? false;
  const isSubscribed = quoteData?.is_subscribed ?? false;
  const subscriptionRequiredForShared =
    quoteData?.subscription_required_for_shared ?? false;
  const canBuyNow = quoteData?.can_buy_now ?? true;
  const sharedBlocked =
    exclusivityChoice === "non_exclusive" && subscriptionRequiredForShared;
  const effectivePrice = quoteData
    ? Number(quoteData.effective_price_cents)
    : rawPrice;

  const modalAnchorCents = modalLead?.list_price_anchor_cents
    ? Number(modalLead.list_price_anchor_cents)
    : listPreview?.list_price_anchor_cents
      ? Number(listPreview.list_price_anchor_cents)
      : null;
  const modalMeta = modalLead?.metadata ?? listPreview?.metadata ?? {};
  const modalMarket = modalLead?.market ?? listPreview?.market ?? "";
  const modalMarketParts = modalMarket
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const modalCity = modalMetaValue(
    modalMeta,
    ["city"],
    modalMarketParts[0] ?? "—",
  );
  const modalState = modalMetaValue(
    modalMeta,
    ["state"],
    modalMarketParts[1] ?? "—",
  );
  const modalZip = modalMetaValue(modalMeta, ["zip", "postal"]);
  const shouldBlurPrivate = purchaseActions;

  const sharedTaken = listPreview?.non_exclusive_buyers_count ?? 0;
  const slotsLeft = sharedCap - sharedTaken;
  const earlyAccessUntil = listPreview?.early_access_until ?? null;
  const isInEarlyAccess =
    earlyAccessUntil != null && new Date(earlyAccessUntil) > new Date();

  return (
    <>
      <style>{modalStyles}</style>
      <div className="ldm-overlay" onClick={onClose} role="presentation">
        <div
          className="ldm-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="ldm-header">
            <div className="ldm-title-group">
              <div className="ldm-title">
                {modalLead?.title ?? listPreview?.title ?? "Lead details"}
              </div>
              {isPro && <span className="ldm-badge-pro">Pro</span>}
            </div>
            <button
              type="button"
              className="ldm-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="ldm-body">
            {detailLoading && !listPreview ? (
              <div>
                {[100, 80, 120, 90].map((w, i) => (
                  <div
                    key={i}
                    className="ldm-skeleton-line"
                    style={{ width: `${w}%`, height: 40 }}
                  />
                ))}
              </div>
            ) : (
              <>
                {/* Visible Property Details */}
                <div className="ldm-stat-grid">
                  <div className="ldm-stat-card">
                    <div className="ldm-stat-label">
                      <MapPin size={12} /> City
                    </div>
                    <div className="ldm-stat-value">{modalCity}</div>
                  </div>
                  <div className="ldm-stat-card">
                    <div className="ldm-stat-label">
                      <MapPin size={12} /> State
                    </div>
                    <div className="ldm-stat-value">{modalState}</div>
                  </div>
                  <div className="ldm-stat-card">
                    <div className="ldm-stat-label">
                      <MapPin size={12} /> ZIP
                    </div>
                    <div className="ldm-stat-value">{modalZip}</div>
                  </div>
                  <div className="ldm-stat-card">
                    <div className="ldm-stat-label">Lead type</div>
                    <div
                      className="ldm-stat-value"
                      style={{ textTransform: "capitalize" }}
                    >
                      {modalLead?.type ?? listPreview?.type}
                    </div>
                  </div>
                  <div className="ldm-stat-card">
                    <div className="ldm-stat-label">
                      <Home size={12} /> Property type
                    </div>
                    <div className="ldm-stat-value">
                      {modalMetaValue(modalMeta, [
                        "property_type",
                        "propertyType",
                      ])}
                    </div>
                  </div>
                  <div className="ldm-stat-card">
                    <div className="ldm-stat-label">
                      <Calendar size={12} /> Timeline
                    </div>
                    <div className="ldm-stat-value">
                      {modalMetaValue(modalMeta, ["timeline"])}
                    </div>
                  </div>
                  <div className="ldm-stat-card">
                    <div className="ldm-stat-label">Condition</div>
                    <div className="ldm-stat-value">
                      {modalMetaValue(modalMeta, ["condition"])}
                    </div>
                  </div>
                  <div className="ldm-stat-card">
                    <div className="ldm-stat-label">
                      <Clock size={12} /> Received
                    </div>
                    <div className="ldm-stat-value">
                      {fmtDateModal(
                        modalLead?.created_at ?? listPreview?.created_at ?? "",
                      )}
                    </div>
                  </div>
                </div>

                {/* Private Contact Details */}
                <div className="ldm-private-wrapper">
                  <div
                    className={`ldm-private-header ${
                      shouldBlurPrivate ? "locked" : "unlocked"
                    }`}
                  >
                    {shouldBlurPrivate ? (
                      <Lock size={14} />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    {shouldBlurPrivate
                      ? "Contact details hidden"
                      : "Contact details"}
                  </div>

                  <div
                    className={`ldm-private-content ${
                      shouldBlurPrivate ? "is-blurred" : ""
                    }`}
                  >
                    <div className="ldm-private-item full">
                      <div className="ldm-stat-label">Full Name</div>
                      <div className="ldm-stat-value">
                        {modalMetaValue(modalMeta, [
                          "name",
                          "full_name",
                          "first_name",
                        ])}
                      </div>
                    </div>
                    <div className="ldm-private-item">
                      <div className="ldm-stat-label">Phone Number</div>
                      <div className="ldm-stat-value">
                        {modalMetaValue(modalMeta, ["phone", "mobile"])}
                      </div>
                    </div>
                    <div className="ldm-private-item">
                      <div className="ldm-stat-label">Email Address</div>
                      <div className="ldm-stat-value">
                        {modalMetaValue(modalMeta, ["email"])}
                      </div>
                    </div>
                    <div className="ldm-private-item full">
                      <div className="ldm-stat-label">Full Address</div>
                      <div className="ldm-stat-value">
                        {modalMetaValue(
                          modalMeta,
                          ["address", "full_address", "street"],
                          modalLead?.market ?? listPreview?.market ?? "—",
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Absolute Center Blur Lock */}
                  {shouldBlurPrivate && (
                    <div className="ldm-lock-overlay">
                      <div className="ldm-lock-badge">
                        <Lock size={16} color="#f59e0b" />
                        Unlock to reveal contact info
                      </div>
                    </div>
                  )}
                </div>

                {/* Purchase Actions Area */}
                {purchaseActions && (
                  <>
                    {isInEarlyAccess && (
                      <div className="ldm-early-access">
                        <Shield size={16} />
                        Subscriber early access — opens to all buyers soon
                      </div>
                    )}

                    <div className="ldm-section-header">
                      <h3>Select Purchase Type</h3>
                    </div>

                    <div className="ldm-tier-grid">
                      <div
                        className={`ldm-tier-card ${
                          exclusivityChoice === "exclusive"
                            ? "active-exclusive"
                            : ""
                        }`}
                        onClick={() => setExclusivityChoice("exclusive")}
                      >
                        <div className="ldm-tier-title">
                          Exclusive
                          <span className="ldm-tier-price">
                            {fmtDollarsModal(exclusivePrice)}
                          </span>
                        </div>
                        <div className="ldm-tier-desc">
                          Sold once. Fully yours.
                        </div>
                      </div>

                      <div
                        className={`ldm-tier-card ${
                          exclusivityChoice === "non_exclusive"
                            ? "active-shared"
                            : ""
                        }`}
                        onClick={() => setExclusivityChoice("non_exclusive")}
                      >
                        <div className="ldm-tier-title">
                          Shared
                          <span className="ldm-tier-price">
                            {isSubscribed
                              ? fmtDollarsModal(sharedPrice)
                              : "Subscribe"}
                          </span>
                        </div>
                        <div className="ldm-tier-desc">
                          {slotsLeft} of {sharedCap} slots available
                        </div>
                        <div className="ldm-slots">
                          {Array.from({ length: sharedCap }).map((_, i) => {
                            let bg = "rgba(255,255,255,0.15)";
                            if (i < sharedTaken)
                              bg = i >= sharedCap - 1 ? "#f59e0b" : "#34d399";
                            return (
                              <div
                                key={i}
                                className="ldm-slot-dot"
                                style={{ background: bg }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Subscription Blocked state */}
                    {sharedBlocked && (
                      <div
                        style={{
                          background: "rgba(139,92,246,0.1)",
                          border: "1px solid rgba(139,92,246,0.2)",
                          borderRadius: 16,
                          padding: 20,
                          marginBottom: 16,
                        }}
                      >
                        <div
                          style={{ display: "flex", gap: 12, marginBottom: 16 }}
                        >
                          <Lock size={24} color="#a855f7" />
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: "#e9d5ff",
                                fontSize: 14,
                              }}
                            >
                              Subscription required for Shared leads
                            </div>
                            <div
                              style={{
                                color: "rgba(255,255,255,0.6)",
                                fontSize: 13,
                                marginTop: 4,
                                lineHeight: 1.5,
                              }}
                            >
                              Only active {subPricing?.proDisplayPrice ?? "$49"}
                              /mo subscribers can buy shared leads at{" "}
                              {leadSharedPrice
                                ? `${leadSharedPrice} `
                                : "this price "}
                              . Switch to Exclusive, or subscribe below.
                            </div>
                          </div>
                        </div>
                        <Link
                          href="/subscriptions"
                          className="ldm-btn-primary"
                          style={{ padding: "12px", fontSize: 14 }}
                        >
                          Subscribe now for{" "}
                          {subPricing?.proDisplayPrice ?? "$49"}/mo
                        </Link>
                      </div>
                    )}

                    <div className="ldm-checkout-area">
                      <div className="ldm-price-flex">
                        <div>
                          <div className="ldm-price-label">
                            Your Total Price
                          </div>
                          <div className="ldm-price-large">
                            {fmtDollarsModal(effectivePrice)}
                          </div>
                          {modalAnchorCents != null &&
                            modalAnchorCents > effectivePrice && (
                              <div className="ldm-price-strike">
                                Was {fmtDollarsModal(modalAnchorCents)}
                              </div>
                            )}
                        </div>

                        <div className="ldm-balance">
                          <div className="ldm-price-label">Balance After</div>
                          <div
                            className={`ldm-balance-value ${
                              walletBalanceCents >= effectivePrice
                                ? "ldm-balance-ok"
                                : "ldm-balance-low"
                            }`}
                          >
                            {fmtDollarsModal(
                              walletBalanceCents - effectivePrice,
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Timers & Errors */}
                      {reserveUntil && secondsLeft > 0 && (
                        <div className="ldm-timer">
                          <Clock size={16} />
                          Checkout hold: {Math.floor(secondsLeft / 60)}:
                          {String(secondsLeft % 60).padStart(2, "0")} remaining
                        </div>
                      )}

                      {reserveMutation?.isError && (
                        <div className="ldm-alert-msg ldm-alert-err">
                          <Info size={16} />
                          {(reserveMutation.error as Error).message}
                        </div>
                      )}

                      {buyMutation?.isError && (
                        <div className="ldm-alert-msg ldm-alert-err">
                          <Info size={16} />
                          {buyMutation.error instanceof ApiError &&
                          buyMutation.error.status === 403
                            ? (buyMutation.error as ApiError).message.includes(
                                "subscription",
                              )
                              ? "A $49/month subscription is required to purchase shared leads"
                              : "This lead is in subscriber early access — subscribe to purchase now"
                            : buyMutation.error instanceof ApiError &&
                                buyMutation.error.status === 400
                              ? (
                                  buyMutation.error as ApiError
                                ).message.includes("wallet")
                                ? "Insufficient wallet balance — top up your wallet"
                                : (buyMutation.error as ApiError).message
                              : buyMutation.error instanceof ApiError &&
                                  buyMutation.error.status === 409
                                ? "This lead was just purchased by someone else"
                                : (buyMutation.error as Error).message}
                        </div>
                      )}

                      {/* Action Buttons */}
                      {!reserveUntil && reserveMutation && (
                        <button
                          type="button"
                          className="ldm-btn-secondary"
                          disabled={reserveMutation.isPending}
                          onClick={() =>
                            leadId && reserveMutation.mutate(leadId)
                          }
                        >
                          {reserveMutation.isPending
                            ? "Reserving..."
                            : "Start 15-min checkout hold"}
                        </button>
                      )}

                      {buyMutation && (
                        <button
                          type="button"
                          className="ldm-btn-primary"
                          disabled={
                            buyMutation.isPending ||
                            (!!reserveUntil && secondsLeft <= 0) ||
                            !canBuyNow ||
                            sharedBlocked
                          }
                          onClick={() =>
                            leadId &&
                            buyMutation.mutate({
                              id: leadId,
                              choice: exclusivityChoice,
                            })
                          }
                        >
                          {!canBuyNow
                            ? "Subscriber early access only"
                            : sharedBlocked
                              ? "Subscribe to buy shared"
                              : buyMutation.isPending
                                ? "Processing Transaction..."
                                : `Confirm Purchase`}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* View Owned States */}
                {!purchaseActions &&
                  detail?.lead_assignments &&
                  detail.lead_assignments.length > 0 && (
                    <>
                      <div className="ldm-section-header ldm-mt">
                        <h3>Your Purchase Record</h3>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {detail.lead_assignments.map((a) => (
                          <div
                            key={a.assignment_id}
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              padding: "12px 16px",
                              borderRadius: "12px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "13px",
                            }}
                          >
                            <div style={{ color: "rgba(255,255,255,0.6)" }}>
                              {new Date(a.assigned_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "12px",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ color: "#fff", fontWeight: 600 }}>
                                {fmtDollarsModal(a.charged_amount)}
                              </span>
                              <span
                                style={{
                                  background: "rgba(99,102,241,0.15)",
                                  color: "#a5b4fc",
                                  padding: "4px 10px",
                                  borderRadius: "100px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  textTransform: "capitalize",
                                }}
                              >
                                {a.purchase_type.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                {/* Pipeline Block */}
                {!purchaseActions &&
                  enableAssignmentPipeline &&
                  detail?.lead_assignments &&
                  detail.lead_assignments.length > 0 &&
                  leadId && (
                    <MyLeadPipelineBlock
                      leadId={leadId}
                      assignment={detail.lead_assignments[0]}
                    />
                  )}

                {/* Price History */}
                {!purchaseActions &&
                  (modalPriceHistory.length > 0 || detailLoading) && (
                    <>
                      <div className="ldm-section-header ldm-mt">
                        <h3>Price History</h3>
                      </div>
                      {detailLoading ? (
                        <div
                          className="ldm-skeleton-line"
                          style={{ height: 60 }}
                        />
                      ) : (
                        <PriceHistoryTable rows={modalPriceHistory} />
                      )}
                    </>
                  )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
