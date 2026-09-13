"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  patchAdminLead,
  postAdminLeadDiscount,
  postAdminLeadBoost,
  patchAdminLeadInternalCost,
  postAdminAssignLead,
  postAdminMarkLeadBad,
  type AdminLeadRow,
} from "@/lib/admin-api";
import { Pill } from "../../components/Pill";
import { Banner } from "../../components/Banner";
import {
  ActionDialog,
  type ActionDialogProps,
} from "../../components/ActionDialog";

interface LeadEditModalProps {
  lead: AdminLeadRow;
  onClose: () => void;
  onSaved: () => void;
}

export default function LeadEditModal({
  lead,
  onClose,
  onSaved,
}: LeadEditModalProps) {
  const [title, setTitle] = useState(lead.title ?? "");
  const [leadType, setLeadType] = useState(lead.lead_type ?? "");
  const [market, setMarket] = useState(lead.market ?? "");
  const [status, setStatus] = useState(lead.status ?? "");
  const [source, setSource] = useState(lead.source ?? "");
  const [dialogConfig, setDialogConfig] = useState<Omit<
    ActionDialogProps,
    "isOpen"
  > | null>(null);

  const closeDialog = () => setDialogConfig(null);

  const [excl, setExcl] = useState(
    lead.exclusive_price_cents
      ? String(Math.round(Number(lead.exclusive_price_cents) / 100))
      : "",
  );
  const [shared, setShared] = useState(
    lead.shared_price_cents
      ? String(Math.round(Number(lead.shared_price_cents) / 100))
      : "",
  );
  const [cap, setCap] = useState(String(lead.max_non_exclusive_buyers ?? 3));

  const [discountPct, setDiscountPct] = useState("");
  const [boostPct, setBoostPct] = useState("");

  const [costDollars, setCostDollars] = useState(
    lead.internal_cost_cents
      ? String(Math.round(Number(lead.internal_cost_cents) / 100))
      : "",
  );
  const [pingPostCost, setPingPostCost] = useState(
    lead.ping_post_cost_cents
      ? String(Math.round(Number(lead.ping_post_cost_cents) / 100))
      : "",
  );
  const [campaignName, setCampaignName] = useState(lead.campaign_name ?? "");
  const [adSource, setAdSource] = useState(lead.ad_source ?? "");
  const [costNotes, setCostNotes] = useState(lead.cost_notes ?? "");

  const vendorName = lead.canonical_lead_source
    ? ((lead.metadata as any)?.vendor_name ?? lead.source ?? "—")
    : (lead.source ?? "—");

  // --- Mutations ---
  const save = useMutation({
    mutationFn: () =>
      patchAdminLead(lead.id, {
        title: title || undefined,
        lead_type: leadType || undefined,
        market: market || undefined,
        status: (status as any) || undefined,
        source: source || undefined,
        exclusive_price_cents: excl
          ? Math.round(parseFloat(excl) * 100)
          : undefined,
        shared_price_cents: shared
          ? Math.round(parseFloat(shared) * 100)
          : undefined,
        max_non_exclusive_buyers: cap ? Number(cap) : undefined,
      }),
    onSuccess: onSaved,
  });

  const applyDiscount = useMutation({
    mutationFn: () =>
      postAdminLeadDiscount(lead.id, { percent: Number(discountPct) }),
    onSuccess: onSaved,
  });

  const applyBoost = useMutation({
    mutationFn: () =>
      postAdminLeadBoost(lead.id, { percent: Number(boostPct) }),
    onSuccess: onSaved,
  });

  const saveCost = useMutation({
    mutationFn: () =>
      patchAdminLeadInternalCost(lead.id, {
        internal_cost_cents: costDollars
          ? Math.round(parseFloat(costDollars) * 100)
          : null,
        ping_post_cost_cents: pingPostCost
          ? Math.round(parseFloat(pingPostCost) * 100)
          : null,
        campaign_name: campaignName.trim() || null,
        ad_source: adSource.trim() || null,
        cost_notes: costNotes.trim() || null,
      }),
    onSuccess: onSaved,
  });

  const actionError =
    save.error || applyDiscount.error || applyBoost.error || saveCost.error;
  const isPending =
    save.isPending ||
    applyDiscount.isPending ||
    applyBoost.isPending ||
    saveCost.isPending;

  return (
    <div
      className="lem-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        /* Backdrop & Container */
        .lem-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: lemFadeIn 0.2s ease-out;
        }
        .lem-dialog {
          background: #0e0e11; /* Clean, deep SaaS dark */
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          width: 100%; max-width: 900px; max-height: 90vh;
          display: flex; flex-direction: column;
          box-shadow: 0 25px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05);
          animation: lemSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        /* Header */
        .lem-header {
          padding: 24px 32px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex; justify-content: space-between; align-items: flex-start;
          background: #0e0e11;
          flex-shrink: 0;
        }
        .lem-title-area h2 {
          font-size: 22px; font-weight: 700; color: #fff;
          margin: 0 0 10px 0; font-family: 'Manrope', sans-serif;
          letter-spacing: -0.02em;
        }

        /* Body & Layout */
        .lem-body {
          overflow-y: auto;
          padding: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .lem-col {
          padding: 32px;
          display: flex; flex-direction: column; gap: 32px;
        }
        .lem-col-left { border-right: 1px solid rgba(255, 255, 255, 0.04); }

        /* Typography */
        .lem-section-title {
          font-size: 13px; font-weight: 600; color: #fff;
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 16px;
        }
        .lem-section-title::after {
          content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06);
        }

        /* Forms */
        .lem-field {
          display: flex; flex-direction: column; gap: 6px;
        }
        .lem-label {
          font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.5);
        }
        .lem-input-wrap {
          position: relative; display: flex; align-items: center;
        }
        .lem-prefix, .lem-suffix {
          position: absolute; color: rgba(255,255,255,0.4); font-size: 13px; pointer-events: none;
        }
        .lem-prefix { left: 12px; }
        .lem-suffix { right: 12px; font-size: 12px; }
        
        .lem-input {
          width: 100%; height: 40px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 0 12px;
          color: #fff; font-size: 14px; font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .lem-input:hover { border-color: rgba(255,255,255,0.15); }
        .lem-input:focus {
          border-color: #6366f1;
          background: rgba(99,102,241,0.05);
          outline: none;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }
        .lem-input[readonly] { opacity: 0.6; cursor: not-allowed; }
        select.lem-input { appearance: none; background-image: url('data:image/svg+xml;utf8,<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>'); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }

        .lem-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        /* Buttons */
        .lem-btn {
          height: 40px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; border: none; display: inline-flex; align-items: center; justify-content: center;
        }
        .lem-btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; box-shadow: 0 2px 10px rgba(99,102,241,0.2); }
        .lem-btn-primary:hover:not(:disabled) { box-shadow: 0 4px 15px rgba(99,102,241,0.4); }
        .lem-btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .lem-btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
        .lem-btn-danger { background: transparent; color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        .lem-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.1); }
        .lem-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Footer */
        .lem-footer {
          padding: 20px 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex; justify-content: space-between; align-items: center;
          background: rgba(0,0,0,0.2);
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .lem-body { grid-template-columns: 1fr; }
          .lem-col-left { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.04); }
          .lem-header { padding: 20px 24px; }
          .lem-col { padding: 24px; gap: 24px; }
          .lem-footer { padding: 16px 24px; flex-direction: column-reverse; gap: 12px; }
          .lem-footer button { width: 100%; }
        }

        @keyframes lemFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lemSlideUp { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div className="lem-dialog">
        <div className="lem-header">
          <div className="lem-title-area">
            <h2>{title || lead.title || "Untitled Lead"}</h2>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "monospace",
                  marginRight: 8,
                }}
              >
                ID: {lead.id.slice(0, 8)}
              </span>
              <Pill
                tone={
                  status === "available"
                    ? "good"
                    : status === "sold"
                      ? "info"
                      : "default"
                }
              >
                {status}
              </Pill>
              <Pill tone="info">{source}</Pill>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                {market || "Unknown market"} · {leadType || "Unknown type"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              fontSize: 20,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div className="lem-body">
          {/* LEFT COLUMN */}
          <div className="lem-col lem-col-left">
            <div>
              <div className="lem-section-title">Core Information</div>
              <div className="lem-grid-2">
                <div className="lem-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="lem-label">Title</label>
                  <input
                    className="lem-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="lem-field">
                  <label className="lem-label">Lead Type</label>
                  <input
                    className="lem-input"
                    value={leadType}
                    onChange={(e) => setLeadType(e.target.value)}
                  />
                </div>
                <div className="lem-field">
                  <label className="lem-label">Market</label>
                  <input
                    className="lem-input"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                  />
                </div>
                <div className="lem-field">
                  <label className="lem-label">Status</label>
                  <select
                    className="lem-input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="lem-field">
                  <label className="lem-label">Source</label>
                  <select
                    className="lem-input"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                    <option value="admin-ingestion">Admin Ingestion</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <div className="lem-section-title">Cost Tracking</div>
              <div className="lem-grid-2">
                <div className="lem-field">
                  <label className="lem-label">Vendor</label>
                  <input className="lem-input" readOnly value={vendorName} />
                </div>
                <div className="lem-field">
                  <label className="lem-label">Campaign</label>
                  <input
                    className="lem-input"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. FB Ads Q2"
                  />
                </div>
                <div className="lem-field">
                  <label className="lem-label">Acquisition Cost</label>
                  <div className="lem-input-wrap">
                    <span className="lem-prefix">$</span>
                    <input
                      className="lem-input"
                      style={{ paddingLeft: 24 }}
                      type="number"
                      step="0.01"
                      value={costDollars}
                      onChange={(e) => setCostDollars(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="lem-field">
                  <label className="lem-label">Ping/Post Cost</label>
                  <div className="lem-input-wrap">
                    <span className="lem-prefix">$</span>
                    <input
                      className="lem-input"
                      style={{ paddingLeft: 24 }}
                      type="number"
                      step="0.01"
                      value={pingPostCost}
                      onChange={(e) => setPingPostCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <button
                className="lem-btn lem-btn-secondary"
                style={{ width: "100%", marginTop: 16 }}
                disabled={saveCost.isPending}
                onClick={() => saveCost.mutate()}
              >
                {saveCost.isPending ? "Saving..." : "Update Cost Data"}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lem-col">
            <div>
              <div className="lem-section-title">Pricing Config</div>
              <div className="lem-grid-2">
                <div className="lem-field">
                  <label className="lem-label">Exclusive Price</label>
                  <div className="lem-input-wrap">
                    <span className="lem-prefix">$</span>
                    <input
                      className="lem-input"
                      style={{ paddingLeft: 24 }}
                      value={excl}
                      onChange={(e) => setExcl(e.target.value)}
                      placeholder="200"
                    />
                  </div>
                </div>
                <div className="lem-field">
                  <label className="lem-label">Shared Price</label>
                  <div className="lem-input-wrap">
                    <span className="lem-prefix">$</span>
                    <input
                      className="lem-input"
                      style={{ paddingLeft: 24 }}
                      value={shared}
                      onChange={(e) => setShared(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                </div>
                <div className="lem-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="lem-label">Max Shared Buyers</label>
                  <input
                    className="lem-input"
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                    placeholder="3"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="lem-section-title">Action Modifiers</div>
              <div className="lem-grid-2" style={{ alignItems: "end" }}>
                <div className="lem-field">
                  <label className="lem-label">Apply Discount</label>
                  <div className="lem-input-wrap">
                    <input
                      className="lem-input"
                      style={{ paddingRight: 28 }}
                      value={discountPct}
                      onChange={(e) => setDiscountPct(e.target.value)}
                      placeholder="15"
                    />
                    <span className="lem-suffix">%</span>
                  </div>
                </div>
                <button
                  className="lem-btn lem-btn-secondary"
                  onClick={() => applyDiscount.mutate()}
                  disabled={!discountPct || isPending}
                >
                  Discount Lead
                </button>

                <div className="lem-field">
                  <label className="lem-label">Apply Boost</label>
                  <div className="lem-input-wrap">
                    <input
                      className="lem-input"
                      style={{ paddingRight: 28 }}
                      value={boostPct}
                      onChange={(e) => setBoostPct(e.target.value)}
                      placeholder="10"
                    />
                    <span className="lem-suffix">%</span>
                  </div>
                </div>
                <button
                  className="lem-btn lem-btn-secondary"
                  onClick={() => applyBoost.mutate()}
                  disabled={!boostPct || isPending}
                >
                  Boost Lead
                </button>
              </div>
            </div>

            <div style={{ marginTop: "auto" }}>
              <div className="lem-section-title" style={{ color: "#f87171" }}>
                Danger Zone
              </div>
              <div className="lem-grid-2">
                <button
                  className="lem-btn lem-btn-secondary"
                  onClick={() => {
                    setDialogConfig({
                      type: "prompt",
                      tone: "warning",
                      title: "Force Assign Lead",
                      message:
                        "This will assign the lead to a specific user. Please provide the User ID.",
                      placeholder: "e.g. user_12345",
                      confirmText: "Assign Lead",
                      onConfirm: (userId) => {
                        const trimmedUserId = userId?.trim();
                        if (!trimmedUserId) return;
                        postAdminAssignLead(lead.id, trimmedUserId).then(() => {
                          closeDialog();
                          onSaved();
                        });
                      },
                      onCancel: closeDialog,
                    });
                  }}
                >
                  Force Assign
                </button>
                <button
                  className="lem-btn lem-btn-danger"
                  onClick={() => {
                    setDialogConfig({
                      type: "prompt",
                      tone: "danger",
                      title: "Mark Lead as Bad",
                      message:
                        "This will remove the lead from the marketplace. Please provide a reason for the audit log.",
                      placeholder: "e.g. Invalid phone number",
                      confirmText: "Mark Bad",
                      onConfirm: (reason) => {
                        if (reason) {
                          postAdminMarkLeadBad(lead.id, reason).then(() => {
                            closeDialog();
                            onSaved();
                          });
                        }
                      },
                      onCancel: closeDialog,
                    });
                  }}
                >
                  Mark as Bad
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Area */}
        {actionError && (
          <div style={{ padding: "0 24px 16px" }}>
            <Banner tone="bad">{(actionError as Error).message}</Banner>
          </div>
        )}
        <div className="lem-footer">
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Edits update the live marketplace immediately.
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="lem-btn lem-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="lem-btn lem-btn-primary"
              onClick={() => save.mutate()}
              disabled={isPending}
              style={{ minWidth: 140 }}
            >
              {save.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
      <ActionDialog
        isOpen={dialogConfig !== null}
        {...(dialogConfig || ({} as any))}
      />
    </div>
  );
}
