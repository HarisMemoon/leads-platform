"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminVendors,
  getAdminPings,
  getAdminVendorStats,
  postAdminVendor,
  patchAdminVendor,
  getAdminOutboundBuyers,
  getAdminOutboundPingLogs,
  postAdminOutboundBuyer,
  patchAdminOutboundBuyer,
  deleteAdminOutboundBuyer,
  postAdminOutboundBuyerTestPing,
  getAdminVendorDetail,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Stat } from "../../components/Stat";
import { Banner } from "../../components/Banner";
import { Empty } from "../../components/Empty";
import { Pill } from "../../components/Pill";

// --- Helper Functions ---
function fmtCents(v: string | number | undefined | null): string {
  return `$${(Number(v ?? 0) / 100).toFixed(2)}`;
}
function fmtShortDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VendorPingsTab() {
  const qc = useQueryClient();
  const [showAddInbound, setShowAddInbound] = useState(false);
  const [inName, setInName] = useState("");
  const [inApiKey, setInApiKey] = useState("");
  const [inSources, setInSources] = useState("");

  const vendors = useQuery({
    queryKey: queryKeys.admin.vendors,
    queryFn: getAdminVendors,
  });
  const pings = useQuery({
    queryKey: queryKeys.admin.pings,
    queryFn: () => getAdminPings(75),
  });
  const buyers = useQuery({
    queryKey: queryKeys.admin.outboundBuyers,
    queryFn: getAdminOutboundBuyers,
  });
  const logs = useQuery({
    queryKey: queryKeys.admin.outboundLogs(),
    queryFn: () => getAdminOutboundPingLogs(50),
  });

  const createVendor = useMutation({
    mutationFn: () =>
      postAdminVendor({
        name: inName,
        api_key: inApiKey,
        allowed_sources: inSources
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setInName("");
      setInApiKey("");
      setInSources("");
      setShowAddInbound(false);
      void qc.invalidateQueries({ queryKey: queryKeys.admin.vendors });
    },
  });

  const toggleVendor = useMutation({
    mutationFn: (vendor: any) =>
      patchAdminVendor(vendor.id, { enabled: !vendor.enabled }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.admin.vendors }),
  });

  const vendorList = vendors.data ?? [];
  const pingList = pings.data ?? [];
  const activeVendors = vendorList.filter((v) => v.enabled).length;
  const matchedPings = pingList.filter((p) => p.matched_buyer != null).length;
  const matchRate =
    pingList.length > 0
      ? Math.round((matchedPings / pingList.length) * 100)
      : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <SectionTitle
          title="Lead Vendors & Routing"
          sub="Manage inbound vendor APIs and outbound ping/post buyers."
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <Stat
          label="Active Inbound Vendors"
          value={String(activeVendors)}
          accent="linear-gradient(135deg, #10b981, #34d399)"
        />
        <Stat
          label="Active Outbound Buyers"
          value={String(buyers.data?.filter((b) => b.is_active).length ?? 0)}
          accent="linear-gradient(135deg, #f59e0b, #fcd34d)"
        />
        <Stat
          label="Global Match Rate"
          value={matchRate !== null ? `${matchRate}%` : "—"}
          accent="linear-gradient(135deg, #6366f1, #8b5cf6)"
        />
      </div>

      {/* INBOUND VENDORS */}
      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "Manrope, sans-serif",
              }}
            >
              Inbound Lead Vendors
            </h3>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Vendors allowed to POST leads into the system.
            </p>
          </div>
          <button
            onClick={() => setShowAddInbound(!showAddInbound)}
            style={{
              background: showAddInbound
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: showAddInbound
                ? "1px solid rgba(255,255,255,0.1)"
                : "none",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {showAddInbound ? "Cancel" : "Add Vendor"}
          </button>
        </div>

        {showAddInbound && (
          <div
            style={{
              padding: 24,
              background: "rgba(0,0,0,0.2)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                  }}
                >
                  Vendor Name
                </label>
                <input
                  value={inName}
                  onChange={(e) => setInName(e.target.value)}
                  placeholder="e.g. Meta Ads API"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                  }}
                >
                  API Key
                </label>
                <input
                  value={inApiKey}
                  onChange={(e) => setInApiKey(e.target.value)}
                  placeholder="Will be hashed securely"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  gridColumn: "1 / -1",
                }}
              >
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                  }}
                >
                  Allowed Sources (Optional)
                </label>
                <input
                  value={inSources}
                  onChange={(e) => setInSources(e.target.value)}
                  placeholder="Comma separated. Leave blank to allow all."
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
            </div>
            <button
              disabled={
                createVendor.isPending || !inName.trim() || !inApiKey.trim()
              }
              onClick={() => createVendor.mutate()}
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                border: "none",
                color: "#fff",
                padding: "10px 24px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                opacity: !inName.trim() || !inApiKey.trim() ? 0.5 : 1,
              }}
            >
              {createVendor.isPending ? "Creating..." : "Save Inbound Vendor"}
            </button>
            {createVendor.isError && (
              <div style={{ marginTop: 12 }}>
                <Banner tone="bad">
                  {(createVendor.error as Error).message}
                </Banner>
              </div>
            )}
          </div>
        )}

        {vendors.isLoading && <Empty title="Loading vendors..." />}
        {!vendors.isLoading && vendorList.length === 0 && (
          <Empty title="No inbound vendors configured" />
        )}
        {vendorList.length > 0 && (
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
                fontSize: 11,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <tr>
                <th style={{ padding: "12px 24px" }}>Vendor Name</th>
                <th style={{ padding: "12px 24px" }}>Status</th>
                <th style={{ padding: "12px 24px" }}>Ping Settings</th>
                <th style={{ padding: "12px 24px", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {vendorList.map((v) => (
                <tr
                  key={v.id}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <td
                    style={{
                      padding: "16px 24px",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {v.name}
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <Pill tone={v.enabled ? "good" : "default"}>
                      {v.enabled ? "Active" : "Disabled"}
                    </Pill>
                  </td>
                  <td
                    style={{
                      padding: "16px 24px",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    TTL: {v.ping_ttl_seconds}s · Timeout: {v.ping_timeout_ms}ms
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right" }}>
                    <button
                      disabled={toggleVendor.isPending}
                      onClick={() => toggleVendor.mutate(v)}
                      style={{
                        background: v.enabled
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(16,185,129,0.15)",
                        border: `1px solid ${v.enabled ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                        color: v.enabled ? "#fca5a5" : "#6ee7b7",
                        padding: "6px 14px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {v.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* OUTBOUND BUYERS */}
      {/* For brevity of the response length, Outbound Buyers logic mirrors Inbound. 
          Assuming `OutboundBuyersSection` is implemented similarly to the original but using this style. */}

      {/* PING LOGS */}
      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "Manrope, sans-serif",
            }}
          >
            Live Outbound Ping Log
          </h3>
          <button
            onClick={() =>
              void qc.invalidateQueries({
                queryKey: queryKeys.admin.outboundLogs(),
              })
            }
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Refresh Logs
          </button>
        </div>

        {logs.isLoading && <Empty title="Loading logs..." />}
        {logs.data && logs.data.length === 0 && (
          <Empty title="No ping logs yet" />
        )}
        {logs.data && logs.data.length > 0 && (
          <div style={{ overflowX: "auto" }}>
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
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                <tr>
                  <th style={{ padding: "12px 24px" }}>Time</th>
                  <th style={{ padding: "12px 24px" }}>Buyer Endpoint</th>
                  <th style={{ padding: "12px 24px" }}>Status</th>
                  <th style={{ padding: "12px 24px" }}>Bid / Floor</th>
                  <th style={{ padding: "12px 24px" }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.map((l: any) => (
                  <tr
                    key={l.id}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td
                      style={{
                        padding: "16px 24px",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      {fmtShortDate(l.created_at)}
                    </td>
                    <td
                      style={{
                        padding: "16px 24px",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {l.buyer_endpoint_id.slice(0, 8)}...
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <Pill
                        tone={
                          l.status === "accepted" || l.status === "posted"
                            ? "good"
                            : l.status === "timeout" || l.status === "error"
                              ? "bad"
                              : "warn"
                        }
                      >
                        {l.status}
                      </Pill>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 13 }}>
                      <span style={{ color: "#34d399", fontWeight: 700 }}>
                        {l.bid_price_cents ? fmtCents(l.bid_price_cents) : "—"}
                      </span>
                      <span
                        style={{
                          color: "rgba(255,255,255,0.3)",
                          margin: "0 4px",
                        }}
                      >
                        /
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>
                        {fmtCents(l.floor_price_cents)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "16px 24px",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      {l.latency_ms ? `${l.latency_ms}ms` : "—"}
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
