"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminPendingLeads,
  patchAdminApproveLead,
  patchAdminRejectLead,
  postAdminBulkApproveLeads,
  postAdminBulkRejectLeads,
  type PendingLeadGroup,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";
import { Pill } from "../../components/Pill";

export function PendingLeadsSection() {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: queryKeys.admin.pendingLeads,
    queryFn: getAdminPendingLeads,
    refetchInterval: 30000,
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
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.admin.pendingLeads }),
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
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.admin.pendingLeads }),
  });

  const total = pending.data?.total ?? 0;

  if (pending.isLoading) return null;
  if (total === 0) return null;

  return (
    <div className="pending-section">
      <style>{`
        .pending-section {
          background: linear-gradient(145deg, rgba(245, 158, 11, 0.04), rgba(12, 14, 20, 0.9));
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-left: 4px solid #f59e0b;
          border-radius: 20px;
          overflow: hidden;
          margin-bottom: 24px;
          box-shadow: 0 10px 40px -10px rgba(245, 158, 11, 0.15);
        }
        .pending-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px; background: rgba(245, 158, 11, 0.06);
          border-bottom: 1px solid rgba(245, 158, 11, 0.12);
          gap: 16px; flex-wrap: wrap;
        }
        .pending-badge {
          background: #f59e0b; color: #000; border-radius: 20px;
          padding: 2px 10px; font-size: 12px; font-weight: 800;
        }
        .group-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 24px; background: rgba(0, 0, 0, 0.25);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          gap: 12px; flex-wrap: wrap;
        }
        .lead-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr auto auto;
          gap: 16px;
          align-items: center;
          padding: 14px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          transition: background 0.2s;
        }
        .lead-row:hover { background: rgba(255,255,255,0.02); }
        .lead-row:last-child { border-bottom: none; }

        .action-btn {
          padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; border: none; display: inline-flex; align-items: center; justify-content: center;
        }
        .btn-approve { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .btn-approve:hover:not(:disabled) { background: rgba(16, 185, 129, 0.25); }
        .btn-reject { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }
        .btn-reject:hover:not(:disabled) { background: rgba(239, 68, 68, 0.25); }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 768px) {
          .pending-header { padding: 16px; flex-direction: column; align-items: stretch; }
          .pending-header > div:last-child { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .group-header { padding: 12px 16px; flex-direction: column; align-items: stretch; gap: 8px; }
          .group-header > div:last-child { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          
          .lead-row {
            grid-template-columns: 1fr;
            gap: 10px;
            padding: 16px;
          }
          .lead-row > div { display: flex; justify-content: space-between; width: 100%; }
          .lead-row-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        }
      `}</style>

      {/* Main Section Header */}
      <div className="pending-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="pending-badge">{total}</span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#fcd34d",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            Leads Pending Review
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            Approve to send to marketplace
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="action-btn btn-reject"
            disabled={bulkReject.isPending}
            onClick={() => {
              const ids =
                pending.data?.groups.flatMap((g) => g.leads.map((l) => l.id)) ??
                [];
              bulkReject.mutate(ids);
            }}
            style={{ flex: 1 }}
          >
            Reject All
          </button>
          <button
            className="action-btn btn-approve"
            disabled={bulkApprove.isPending}
            onClick={() => {
              const ids =
                pending.data?.groups.flatMap((g) => g.leads.map((l) => l.id)) ??
                [];
              bulkApprove.mutate(ids);
            }}
            style={{ flex: 1 }}
          >
            Approve All
          </button>
        </div>
      </div>

      {/* Vendor Groups */}
      {pending.data?.groups.map((group: PendingLeadGroup) => (
        <div
          key={group.vendor_id ?? "unknown"}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="group-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: group.vendor_id
                    ? "#10b981"
                    : "rgba(255,255,255,0.3)",
                }}
              />
              <span style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>
                {group.vendor_name}
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                ({group.count} leads)
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="action-btn btn-reject"
                style={{ padding: "6px 12px", fontSize: 11, flex: 1 }}
                disabled={bulkReject.isPending}
                onClick={() => bulkReject.mutate(group.leads.map((l) => l.id))}
              >
                Reject Group
              </button>
              <button
                className="action-btn btn-approve"
                style={{ padding: "6px 12px", fontSize: 11, flex: 1 }}
                disabled={bulkApprove.isPending}
                onClick={() => bulkApprove.mutate(group.leads.map((l) => l.id))}
              >
                Approve Group
              </button>
            </div>
          </div>

          {/* Lead Rows */}
          <div>
            {group.leads.map((lead) => (
              <div key={lead.id} className="lead-row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>
                    {lead.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      display: "none",
                    }}
                  >
                    {lead.market}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                  >
                    {lead.market}
                  </span>
                  <Pill>{lead.lead_type}</Pill>
                </div>

                <div
                  style={{
                    fontFamily: "monospace",
                    color: "#a5b4fc",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  ${(parseInt(lead.price_cents || "0", 10) / 100).toFixed(2)}
                </div>

                <div
                  className="lead-row-actions"
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    className="action-btn btn-reject"
                    style={{ padding: "6px 12px", fontSize: 11 }}
                    disabled={reject.isPending}
                    onClick={() => reject.mutate(lead.id)}
                  >
                    Reject
                  </button>
                  <button
                    className="action-btn btn-approve"
                    style={{ padding: "6px 12px", fontSize: 11 }}
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(lead.id)}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
