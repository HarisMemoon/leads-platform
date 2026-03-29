"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import type { LeadDetailResponse, MarketplaceLeadRow } from "@/lib/leads-api";
import { ApiError } from "@/lib/api";

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

export function fmtDateModal(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  detail: LeadDetailResponse | undefined;
  detailLoading: boolean;
  purchaseActions?: boolean;
  walletBalanceCents?: number;
  reserveMutation?: UseMutationResult<
    { reserved_until: string; ttl_seconds: number },
    unknown,
    string
  >;
  buyMutation?: UseMutationResult<{ id: string }, unknown, string>;
  reserveUntil?: string | null;
  secondsLeft?: number;
};

export function LeadDetailModal({
  leadId,
  onClose,
  listPreview = null,
  detail,
  detailLoading,
  purchaseActions = false,
  walletBalanceCents = 0,
  reserveMutation,
  buyMutation,
  reserveUntil = null,
  secondsLeft = 0,
}: LeadDetailModalProps) {
  if (!leadId) return null;

  const modalLead = detail?.lead;
  const modalPriceHistory = detail?.lead_price_history ?? [];
  const modalPriceCents = modalLead
    ? Number(modalLead.current_price)
    : listPreview
      ? Number(listPreview.current_price)
      : 0;
  const modalAnchorCents = modalLead?.list_price_anchor_cents
    ? Number(modalLead.list_price_anchor_cents)
    : listPreview?.list_price_anchor_cents
      ? Number(listPreview.list_price_anchor_cents)
      : null;

  return (
    <>
      <style>{modalStyles}</style>
      <div className="ldm-overlay" onClick={onClose} role="presentation">
        <div className="ldm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="ldm-header">
            <div className="ldm-title">{modalLead?.title ?? listPreview?.title ?? "Lead detail"}</div>
            <button type="button" className="ldm-close" onClick={onClose} aria-label="Close">
              ×
            </button>
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
                  <div className="ldm-label">Market</div>
                  <div className="ldm-value">{modalLead?.market ?? listPreview?.market}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Lead type</div>
                  <div className="ldm-value">{modalLead?.type ?? listPreview?.type}</div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Exclusivity</div>
                  <div className="ldm-value">
                    {(() => {
                      const e = modalLead?.exclusivity ?? listPreview?.exclusivity ?? "";
                      const ec = exclusivityColor(e);
                      return (
                        <span className="ldm-excl" style={{ background: ec.bg, color: ec.color, borderColor: ec.border, fontSize: 12 }}>
                          {exclusivityLabel(e)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="ldm-item">
                  <div className="ldm-label">Status</div>
                  <div className="ldm-value" style={{ textTransform: "capitalize" }}>
                    {modalLead?.status ?? "—"}
                  </div>
                </div>
                {modalLead?.source && (
                  <div className="ldm-item">
                    <div className="ldm-label">Source</div>
                    <div className="ldm-value">{modalLead.source}</div>
                  </div>
                )}
                <div className="ldm-item">
                  <div className="ldm-label">Listed</div>
                  <div className="ldm-value">{fmtDateModal(modalLead?.created_at ?? listPreview?.created_at ?? "")}</div>
                </div>
                <div className="ldm-item full">
                  <div className="ldm-label">Quality score</div>
                  <QualityBar score={modalLead?.quality_score ?? listPreview?.quality_score ?? 0} />
                </div>
                {modalLead?.marketplace_tier && (
                  <div className="ldm-item">
                    <div className="ldm-label">Section</div>
                    <div className="ldm-value" style={{ textTransform: "capitalize" }}>
                      {modalLead.marketplace_tier}
                    </div>
                  </div>
                )}
              </div>

              <div className="ldm-price-row">
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Price</div>
                  <div className="ldm-price-big">{fmtDollarsModal(modalPriceCents)}</div>
                  {modalAnchorCents != null && modalAnchorCents > modalPriceCents && (
                    <div className="ldm-was">Was {fmtDollarsModal(modalAnchorCents)}</div>
                  )}
                </div>
                {purchaseActions && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Balance after</div>
                    <div
                      style={{
                        fontFamily: "Syne, sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                        color: walletBalanceCents >= modalPriceCents ? "#6ee7b7" : "#fca5a5",
                      }}
                    >
                      {fmtDollarsModal(walletBalanceCents - modalPriceCents)}
                    </div>
                  </div>
                )}
              </div>

              {(modalPriceHistory.length > 0 || detailLoading) && (
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
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · Paid {fmtDollarsModal(a.charged_amount)} · {a.purchase_type.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {purchaseActions && reserveMutation?.isError && (
                <div className="ldm-err">{(reserveMutation.error as Error).message}</div>
              )}
              {purchaseActions && buyMutation?.isError && (
                <div className="ldm-err">
                  {buyMutation.error instanceof ApiError && buyMutation.error.status === 400
                    ? "Insufficient wallet balance — top up your wallet"
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
                <button
                  type="button"
                  className="ldm-hold"
                  disabled={reserveMutation.isPending}
                  onClick={() => leadId && reserveMutation.mutate(leadId)}
                >
                  {reserveMutation.isPending ? "Reserving…" : "Start checkout hold (15 min)"}
                </button>
              )}

              {purchaseActions && buyMutation && (
                <button
                  type="button"
                  className="ldm-buy"
                  disabled={buyMutation.isPending || (!!reserveUntil && secondsLeft <= 0)}
                  onClick={() => leadId && buyMutation.mutate(leadId)}
                >
                  {buyMutation.isPending ? "Processing…" : `Confirm purchase — ${fmtDollarsModal(modalPriceCents)}`}
                </button>
              )}

              {purchaseActions && (
                <p
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.25)",
                    marginTop: 10,
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
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
