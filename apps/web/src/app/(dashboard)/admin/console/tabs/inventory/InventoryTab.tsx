"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminLeads,
  deleteAdminLead,
  getAdminMetricsIntake,
  type AdminLeadRow,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

// Reusable Components
import { SectionTitle } from "../../components/SectionTitle";
import { Stat } from "../../components/Stat";
import { Pill } from "../../components/Pill";
import { Banner } from "../../components/Banner";
import { Empty } from "../../components/Empty";
import LeadEditModal from "./LeadEditModal";

type InventoryPeriod = "today" | "week" | "month" | "all";

function periodToDateFrom(period: InventoryPeriod): string | undefined {
  if (period === "all") return undefined;
  const now = new Date();
  if (period === "today")
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

const PERIODS: { id: InventoryPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

export default function InventoryTab() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<InventoryPeriod>("today");
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<"" | "inbound" | "outbound">(
    "",
  );

  const [editLead, setEditLead] = useState<AdminLeadRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const intakeQ = useQuery({
    queryKey: queryKeys.admin.metricsIntake(period),
    queryFn: () => getAdminMetricsIntake(period as any),
    enabled: period !== "all",
  });

  const leadsQ = useQuery({
    queryKey: queryKeys.admin.leads({
      page,
      source: sourceFilter || undefined,
      date_from: periodToDateFrom(period),
    }),
    queryFn: () =>
      getAdminLeads({
        page,
        limit: 25,
        source: sourceFilter || undefined,
        date_from: periodToDateFrom(period),
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAdminLead(id),
    onSuccess: () => {
      setConfirmDeleteId(null);
      void qc.invalidateQueries({ queryKey: ["admin", "leads"] });
      void qc.invalidateQueries({ queryKey: ["admin", "metrics", "intake"] });
    },
  });

  const items = leadsQ.data?.items ?? [];

  return (
    <div className="inventory-container">
      <style>{`
        /* CRITICAL: Added width: 100% and min-width: 0 to force flex children to shrink */
        .inventory-container { 
          display: flex; 
          flex-direction: column; 
          gap: 24px; 
          width: 100%;
          min-width: 0;
          animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); 
        }
        
        .header-row { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-end; 
          gap: 16px; 
          flex-wrap: wrap; 
        }
        
        /* Mobile friendly horizontal scroll for tabs */
        .segmented-control-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; 
        }
        .segmented-control-wrapper::-webkit-scrollbar { display: none; }

        .segmented-control { 
          display: inline-flex; 
          background: rgba(0, 0, 0, 0.3); 
          border: 1px solid rgba(255, 255, 255, 0.06); 
          border-radius: 12px; 
          padding: 6px; 
          gap: 4px; 
          white-space: nowrap;
        }
        .seg-btn { 
          padding: 8px 20px; 
          border-radius: 8px; 
          border: none; 
          font-size: 13px; 
          font-weight: 600; 
          font-family: "Inter", sans-serif; 
          cursor: pointer; 
          transition: all 0.3s ease; 
        }
        .seg-btn[data-active="true"] { 
          background: rgba(99, 102, 241, 0.15); 
          color: #a5b4fc; 
          box-shadow: 0 2px 12px rgba(99, 102, 241, 0.2), inset 0 0 0 1px rgba(99, 102, 241, 0.3); 
        }
        .seg-btn[data-active="false"] { 
          background: transparent; 
          color: rgba(255, 255, 255, 0.4); 
        }
        .seg-btn[data-active="false"]:hover { 
          color: rgba(255, 255, 255, 0.9); 
          background: rgba(255, 255, 255, 0.05); 
        }

        .stat-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); 
          gap: 16px; 
        }

        /* CRITICAL: Constrain the glass panel so the table inside it can scroll */
        .glass-panel { 
          background: linear-gradient(145deg, rgba(24, 24, 27, 0.6), rgba(9, 9, 11, 0.8)); 
          border: 1px solid rgba(255, 255, 255, 0.05); 
          border-radius: 20px; 
          backdrop-filter: blur(16px); 
          box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5); 
          overflow: hidden; 
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        
        .filter-bar { 
          display: flex; 
          flex-wrap: wrap; 
          gap: 16px; 
          align-items: center; 
          justify-content: space-between; 
          padding: 16px 24px; 
          border-bottom: 1px solid rgba(255,255,255,0.05); 
        }
        
        /* Table Styles */
        .table-wrapper { 
          display: block;
          overflow-x: auto; 
          width: 100%; 
          max-width: 100%; 
          -webkit-overflow-scrolling: touch; 
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.2) transparent;
        }
        .table-wrapper::-webkit-scrollbar { height: 6px; }
        .table-wrapper::-webkit-scrollbar-track { background: transparent; }
        .table-wrapper::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }

        .admin-table { 
          width: 100%; 
          border-collapse: collapse; 
          min-width: 800px; 
        }
        .admin-th { 
          text-align: left; 
          padding: 16px 24px; 
          font-size: 11px; 
          font-weight: 700; 
          text-transform: ; 
          letter-spacing: 0.08em; 
          color: rgba(255, 255, 255, 0.35); 
          background: rgba(0,0,0,0.2); 
          border-bottom: 1px solid rgba(255, 255, 255, 0.05); 
          white-space: nowrap;
        }
        .admin-td { 
          padding: 16px 24px; 
          font-size: 13.5px; 
          color: rgba(255, 255, 255, 0.85); 
          border-bottom: 1px solid rgba(255, 255, 255, 0.03); 
          vertical-align: middle; 
        }
        .admin-tr { 
          position: relative; 
          transition: background-color 0.2s; 
        }
        .admin-tr:hover { background-color: rgba(255, 255, 255, 0.02); }
        .admin-tr:last-child .admin-td { border-bottom: none; }

        .select-modern { 
          appearance: none; 
          background: rgba(0,0,0,0.3) url('data:image/svg+xml;utf8,<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>') no-repeat right 14px center; 
          border: 1px solid rgba(255,255,255,0.1); 
          color: #fff; 
          padding: 10px 36px 10px 16px; 
          border-radius: 10px; 
          font-size: 13px; 
          font-weight: 500; 
          outline: none; 
          cursor: pointer; 
          transition: all 0.2s; 
        }
        .select-modern:focus, .select-modern:hover { border-color: rgba(99,102,241,0.5); }

        .btn-page { 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          color: #fff; 
          padding: 8px 16px; 
          border-radius: 8px; 
          font-size: 12px; 
          font-weight: 600; 
          cursor: pointer; 
          transition: all 0.2s; 
        }
        .btn-page:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
        .btn-page:disabled { opacity: 0.3; cursor: not-allowed; }

        .action-btn { 
          background: transparent; 
          border: 1px solid rgba(255,255,255,0.15); 
          color: rgba(255,255,255,0.7); 
          padding: 6px 14px; 
          border-radius: 8px; 
          font-size: 12px; 
          font-weight: 600; 
          cursor: pointer; 
          transition: all 0.2s; 
        }
        .action-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .action-btn.danger { border-color: rgba(239,68,68,0.3); color: #fca5a5; background: rgba(239,68,68,0.1); }
        .action-btn.danger:hover { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.5); color: #fff; }

        @media (max-width: 768px) {
          .header-row { flex-direction: column; align-items: stretch; }
          .segmented-control-wrapper { width: 100vw; margin-left: -24px; padding: 0 24px; }
          .filter-bar { flex-direction: column; align-items: stretch; gap: 16px; }
          .filter-bar > div { justify-content: space-between; }
        }
      `}</style>

      <div className="header-row">
        <SectionTitle
          title="Lead Inventory"
          sub="View leads by period, filter by source, edit or delete."
        />

        {/* Mobile Horizontal Scroll Wrapper */}
        <div className="segmented-control-wrapper">
          <div className="segmented-control">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                className="seg-btn"
                data-active={period === p.id}
                onClick={() => {
                  setPeriod(p.id);
                  setPage(1);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {period !== "all" && (
        <div className="stat-grid">
          <Stat
            label="Leads In"
            value={intakeQ.data?.leads_in ?? "—"}
            accent="linear-gradient(135deg, #6366f1, #8b5cf6)"
          />
          <Stat
            label="Leads Sold"
            value={intakeQ.data?.leads_sold ?? "—"}
            accent="linear-gradient(135deg, #10b981, #34d399)"
          />
          <Stat
            label="Revenue"
            value={
              intakeQ.data
                ? `$${(Number(intakeQ.data.revenue_cents) / 100).toFixed(0)}`
                : "—"
            }
            accent="linear-gradient(135deg, #f59e0b, #ea580c)"
          />
        </div>
      )}

      <div className="glass-panel">
        <div className="filter-bar">
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                textTransform: "",
                letterSpacing: "0.05em",
                display: "none",
              }}
            >
              Filter By
            </span>
            <select
              className="select-modern"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="">All Sources</option>
              <option value="inbound">Inbound API</option>
              <option value="outbound">Outbound Pings</option>
              <option value="admin-ingestion">Admin CSV</option>
            </select>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "space-between",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(0,0,0,0.2)",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.05)",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#6366f1",
                }}
              />
              <span
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {leadsQ.data?.pagination.total ?? 0} total leads
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn-page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  minWidth: 50,
                  textAlign: "center",
                }}
              >
                Pg {page}
              </span>
              <button
                className="btn-page"
                onClick={() => setPage((p) => p + 1)}
                disabled={items.length < 25}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {leadsQ.isLoading && (
          <div style={{ padding: 40 }}>
            <Empty title="Loading inventory..." />
          </div>
        )}
        {leadsQ.isError && (
          <div style={{ padding: 24 }}>
            <Banner tone="bad">{(leadsQ.error as Error).message}</Banner>
          </div>
        )}
        {!leadsQ.isLoading && items.length === 0 && (
          <div style={{ padding: 40 }}>
            <Empty title="No leads found for this period" />
          </div>
        )}

        {items.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%" /* Fix */,
              minWidth: 0 /* Fix */,
            }}
          >
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="admin-th">Title</th>
                    <th className="admin-th">Market & Type</th>
                    <th className="admin-th">Source</th>
                    <th className="admin-th">Status</th>
                    <th className="admin-th">Created</th>
                    <th
                      className="admin-th"
                      style={{ textAlign: "right", paddingRight: 32 }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((l) => {
                    const isDeleting = confirmDeleteId === l.id;
                    return (
                      <tr
                        key={l.id}
                        className="admin-tr"
                        style={{
                          background: isDeleting
                            ? "rgba(239,68,68,0.05)"
                            : undefined,
                        }}
                      >
                        <td
                          className="admin-td"
                          style={{ fontWeight: 600, whiteSpace: "nowrap" }}
                        >
                          {l.title || "Untitled Lead"}
                        </td>
                        <td className="admin-td">
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                color: "rgba(255,255,255,0.9)",
                                fontSize: 13,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {l.market || "—"}
                            </span>
                            <span
                              style={{
                                color: "rgba(255,255,255,0.4)",
                                fontSize: 11,
                                textTransform: "",
                                letterSpacing: "0.05em",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {l.lead_type}
                            </span>
                          </div>
                        </td>
                        <td className="admin-td">
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              background:
                                l.source === "inbound"
                                  ? "rgba(99,102,241,0.1)"
                                  : "rgba(16,185,129,0.1)",
                              color:
                                l.source === "inbound" ? "#a5b4fc" : "#6ee7b7",
                              border: `1px solid ${l.source === "inbound" ? "rgba(99,102,241,0.2)" : "rgba(16,185,129,0.2)"}`,
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "",
                              letterSpacing: "0.05em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <div
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: "50%",
                                background: "currentColor",
                              }}
                            />
                            {l.source || "System"}
                          </span>
                        </td>
                        <td className="admin-td">
                          <Pill
                            tone={
                              l.status === "available"
                                ? "good"
                                : l.status === "sold"
                                  ? "info"
                                  : "default"
                            }
                          >
                            {l.status}
                          </Pill>
                        </td>
                        <td
                          className="admin-td"
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(l.created_at).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </td>
                        <td
                          className="admin-td"
                          style={{ textAlign: "right", paddingRight: 32 }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "flex-end",
                              alignItems: "center",
                            }}
                          >
                            {isDeleting ? (
                              <>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "#fca5a5",
                                    marginRight: 8,
                                    fontWeight: 600,
                                    display: "none",
                                  }}
                                >
                                  Are you sure?
                                </span>
                                <button
                                  className="action-btn"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="action-btn danger"
                                  disabled={deleteMut.isPending}
                                  onClick={() => deleteMut.mutate(l.id)}
                                  style={{
                                    background: "#ef4444",
                                    color: "#fff",
                                    borderColor: "#ef4444",
                                  }}
                                >
                                  {deleteMut.isPending ? "..." : "Confirm"}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="action-btn"
                                  onClick={() => setEditLead(l)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="action-btn"
                                  style={{
                                    borderColor: "transparent",
                                    color: "rgba(255,255,255,0.4)",
                                  }}
                                  onClick={() => setConfirmDeleteId(l.id)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {editLead && (
        <LeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={() => {
            setEditLead(null);
            void qc.invalidateQueries({ queryKey: ["admin", "leads"] });
          }}
        />
      )}
    </div>
  );
}
