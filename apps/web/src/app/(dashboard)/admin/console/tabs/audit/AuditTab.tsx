"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminAuditLogs, type AuditLogRow } from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Empty } from "../../components/Empty";

export default function AuditTab() {
  const audit = useQuery({
    queryKey: queryKeys.admin.audit,
    queryFn: getAdminAuditLogs,
  });
  const [filter, setFilter] = useState("");

  const filtered = (audit.data ?? []).filter((r: AuditLogRow) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      r.action.toLowerCase().includes(f) ||
      r.target_type.toLowerCase().includes(f) ||
      (r.actor?.email ?? "").toLowerCase().includes(f)
    );
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <SectionTitle
        title="Audit Log"
        sub="Record of all sensitive admin actions, sortable by actor and target."
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "16px 24px",
        }}
      >
        <svg
          width="18"
          height="18"
          fill="none"
          viewBox="0 0 24 24"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          placeholder="Filter by action, actor email, or target..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: 14,
            outline: "none",
          }}
        />
        <div
          style={{
            padding: "4px 10px",
            background: "rgba(0,0,0,0.3)",
            borderRadius: 6,
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 600,
          }}
        >
          {filtered.length} entries
        </div>
      </div>

      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {audit.isLoading && <Empty title="Loading audit logs..." />}
        {audit.data && filtered.length === 0 && (
          <Empty title="No matching entries" />
        )}

        {filtered.length > 0 && (
          <div style={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead
                style={{
                  background: "rgba(0,0,0,0.2)",
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  backdropFilter: "blur(10px)",
                }}
              >
                <tr>
                  <th
                    style={{
                      padding: "14px 24px",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    Timestamp
                  </th>
                  <th
                    style={{
                      padding: "14px 24px",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    Actor
                  </th>
                  <th
                    style={{
                      padding: "14px 24px",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    Action
                  </th>
                  <th
                    style={{
                      padding: "14px 24px",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    Target
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td
                      style={{
                        padding: "16px 24px",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.5)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "16px 24px",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.8)",
                      }}
                    >
                      {row.actor?.email ?? "System"}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span
                        style={{
                          background: "rgba(99,102,241,0.1)",
                          color: "#a5b4fc",
                          border: "1px solid rgba(99,102,241,0.2)",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}
                      >
                        {row.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "16px 24px",
                        fontSize: 13,
                        fontFamily: "DM Mono, monospace",
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      <span style={{ color: "#fff" }}>{row.target_type}</span> /{" "}
                      {row.target_id.slice(0, 12)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
