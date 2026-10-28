"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAdminExtendedMetrics,
  getAdminMetricsBreakdown,
  getAdminRefundRequests,
  getAdminMetricsIntake,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { Banner } from "../../components/Banner";
import { Empty } from "../../components/Empty";
import { Pill } from "../../components/Pill";

// --- Helper Functions ---
function fmtCents(v: string | number | undefined | null): string {
  const n = Number(v ?? 0);
  return `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Sub-component: Bento Stat Card ---
function BentoStat({ label, value, trend, trendLabel, gradient }: any) {
  return (
    <div
      style={{
        background:
          "linear-gradient(145deg, rgba(20,22,30,0.8), rgba(12,14,20,0.9))",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 20,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          background: gradient,
          filter: "blur(50px)",
          opacity: 0.15,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          textTransform: "",
          letterSpacing: "0.05em",
          marginBottom: 16,
        }}
      >
        {label}
      </div>
      <div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            fontFamily: "Manrope, sans-serif",
            color: "#fff",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        {trend && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
            }}
          >
            <span
              style={{
                background: "rgba(52,211,153,0.15)",
                color: "#34d399",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {trend}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              {trendLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-component: MiniBar Chart ---
function MiniBar({ items, max }: any) {
  const m =
    (max ??
      items.reduce((acc: number, it: any) => Math.max(acc, it.value), 0)) ||
    1;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        marginTop: 8,
      }}
    >
      {items.map((it: any) => {
        const pct = Math.max(2, (it.value / m) * 100);
        return (
          <div
            key={it.label}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(80px, 100px) 1fr 60px",
              gap: 16,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.6)",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {it.label}
            </span>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "rgba(255,255,255,0.05)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: it.color ?? "#6366f1",
                  borderRadius: 3,
                  transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 13,
                textAlign: "right",
                color: "#fff",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {it.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function OverviewTab() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");

  const metrics = useQuery({
    queryKey: queryKeys.admin.metrics,
    queryFn: getAdminExtendedMetrics,
  });
  const breakdown = useQuery({
    queryKey: queryKeys.admin.metricsBreakdown,
    queryFn: getAdminMetricsBreakdown,
  });
  const refunds = useQuery({
    queryKey: queryKeys.admin.refundRequests,
    queryFn: getAdminRefundRequests,
  });
  const intake = useQuery({
    queryKey: queryKeys.admin.metricsIntake(period),
    queryFn: () => getAdminMetricsIntake(period),
  });

  const m = metrics.data;
  const b = breakdown.data;
  const counts = m?.countByStatus ?? {};
  const inventoryAvailable = Number(counts["available"] ?? 0);
  const pendingRefunds = (refunds.data ?? []).filter(
    (r: any) => r.status === "pending",
  );

  const byStatus = Object.entries(counts)
    .map(([k, v]) => ({ label: k, value: Number(v) }))
    .sort((a, b) => b.value - a.value);
  const byType = (b?.soldByType ?? []).map((t: any) => ({
    label: t.lead_type,
    value: t.assignment_count,
    color: "linear-gradient(90deg, #818cf8, #6366f1)",
  }));

  const deliveryPct = b ? `${(b.deliverySuccessRate * 100).toFixed(1)}%` : "—";
  const churnPct = b
    ? `${(b.subscriptionChurn30d.churnRate * 100).toFixed(1)}%`
    : "—";

  return (
    <div className="overview-container">
      <style>{`
        .overview-container { display: flex; flex-direction: column; gap: 32px; animation: fadeIn 0.5s ease-out; }
        .dash-top-bar { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); borderRadius: 16px; padding: 12px 24px; border-radius: 16px; }
        .bento-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
        .stats-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

        @media (max-width: 1024px) {
          .dash-top-bar { flex-direction: column; align-items: stretch !important; gap: 16px; padding: 16px; }
          .dash-top-bar .segmented-control { width: 100%; display: flex; }
          .dash-top-bar .segmented-control button { flex: 1; text-align: center; }
          .stats-4 { grid-template-columns: repeat(2, 1fr); }
          .charts-row { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .stats-4 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dash-top-bar">
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          Executive Dashboard
        </div>
        <div
          className="segmented-control"
          style={{
            display: "flex",
            background: "rgba(0,0,0,0.3)",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {(["today", "week", "month"] as const).map((p) => {
            const isActive = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  background: isActive
                    ? "rgba(255,255,255,0.1)"
                    : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {metrics.isError && (
        <Banner tone="bad">{(metrics.error as Error).message}</Banner>
      )}

      {m && (
        <>
          <div className="bento-grid">
            <BentoStat
              label="Sales Revenue"
              value={
                <span
                  style={{
                    background: "linear-gradient(to right, #fff, #a5b4fc)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {fmtCents(m.totalRevenueCents)}
                </span>
              }
              gradient="#6366f1"
            />
            <BentoStat
              label="Buyer Deposits"
              value={fmtCents(m.totalWalletDepositsCents)}
              gradient="#38bdf8"
            />
            <BentoStat
              label="Available Leads"
              value={inventoryAvailable.toLocaleString()}
              gradient="#10b981"
            />

            {/* <div
              style={{
                background:
                  "linear-gradient(145deg, rgba(20,22,30,0.8), rgba(12,14,20,0.9))",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 20,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "",
                  letterSpacing: "0.05em",
                }}
              >
                Action Needed
              </div>
              <div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    fontFamily: "Manrope, sans-serif",
                    color: pendingRefunds.length > 0 ? "#fbbf24" : "#fff",
                    lineHeight: 1,
                    marginBottom: 12,
                  }}
                >
                  {pendingRefunds.length} Refunds
                </div>
                {pendingRefunds.length > 0 ? (
                  <button
                    style={{
                      background: "rgba(245,158,11,0.1)",
                      color: "#fcd34d",
                      border: "1px solid rgba(245,158,11,0.2)",
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Review Now
                  </button>
                ) : (
                  <span
                    style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}
                  >
                    All clear!
                  </span>
                )}
              </div>
            </div> */}
          </div>

          <div className="stats-4">
            {[
              { label: "Active Subscriptions", val: m.activeSubscriptions },
              {
                label: "MRR Estimate",
                val: b ? fmtCents(b.mrrEstimateCents) : "—",
              },
              { label: "Delivery Success", val: deliveryPct },
              {
                label: "30-Day Churn",
                val: churnPct,
                alert: b && b.subscriptionChurn30d.churnRate > 0.1,
              },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    fontFamily: "Manrope, sans-serif",
                    color: stat.alert ? "#fca5a5" : "#fff",
                  }}
                >
                  {stat.val}
                </div>
              </div>
            ))}
          </div>

          <div className="charts-row">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  background:
                    "linear-gradient(145deg, rgba(20,22,30,0.8), rgba(12,14,20,0.9))",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 20,
                  padding: 28,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 24px",
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: "Manrope, sans-serif",
                  }}
                >
                  Inventory by Status
                </h3>
                {byStatus.length === 0 ? (
                  <Empty title="No data yet" />
                ) : (
                  <MiniBar items={byStatus} />
                )}
              </div>
              <div
                style={{
                  background:
                    "linear-gradient(145deg, rgba(20,22,30,0.8), rgba(12,14,20,0.9))",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 20,
                  padding: 28,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 24px",
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: "Manrope, sans-serif",
                  }}
                >
                  Sales by Lead Type
                </h3>
                {breakdown.isLoading ? (
                  <Empty title="Loading…" />
                ) : byType.length === 0 ? (
                  <Empty title="No sales recorded yet" />
                ) : (
                  <MiniBar items={byType} />
                )}
              </div>
            </div>

            <div
              style={{
                background:
                  "linear-gradient(145deg, rgba(20,22,30,0.8), rgba(12,14,20,0.9))",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 20,
                padding: "28px 0",
                overflow: "hidden",
              }}
            >
              <h3
                style={{
                  margin: "0 0 20px",
                  padding: "0 28px",
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                Top Buyers
              </h3>
              {breakdown.isLoading ? (
                <div style={{ padding: "0 28px" }}>
                  <Empty title="Loading…" />
                </div>
              ) : !b || b.topBuyers.length === 0 ? (
                <div style={{ padding: "0 28px" }}>
                  <Empty title="No buyers yet" />
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: 400,
                    }}
                  >
                    <thead style={{ background: "rgba(0,0,0,0.2)" }}>
                      <tr>
                        <th
                          style={{
                            padding: "12px 28px",
                            textAlign: "left",
                            fontSize: 11,
                            color: "rgba(255,255,255,0.4)",
                            textTransform: "",
                            fontWeight: 600,
                          }}
                        >
                          Buyer
                        </th>
                        <th
                          style={{
                            padding: "12px 28px",
                            textAlign: "right",
                            fontSize: 11,
                            color: "rgba(255,255,255,0.4)",
                            textTransform: "",
                            fontWeight: 600,
                          }}
                        >
                          Leads
                        </th>
                        <th
                          style={{
                            padding: "12px 28px",
                            textAlign: "right",
                            fontSize: 11,
                            color: "rgba(255,255,255,0.4)",
                            textTransform: "",
                            fontWeight: 600,
                          }}
                        >
                          Spent
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.topBuyers.map((row: any, i: number) => {
                        const initial = row.email.charAt(0).toUpperCase();
                        const colors = [
                          "linear-gradient(135deg, #6366f1, #a855f7)",
                          "linear-gradient(135deg, #10b981, #3b82f6)",
                          "linear-gradient(135deg, #f59e0b, #ef4444)",
                          "linear-gradient(135deg, #ec4899, #8b5cf6)",
                        ];
                        return (
                          <tr
                            key={row.user_id}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
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
                            <td style={{ padding: "16px 28px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                }}
                              >
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    background: colors[i % colors.length],
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "#fff",
                                    flexShrink: 0,
                                  }}
                                >
                                  {initial}
                                </div>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "rgba(255,255,255,0.9)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {row.email}
                                </span>
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "16px 28px",
                                textAlign: "right",
                                fontSize: 13,
                                color: "rgba(255,255,255,0.6)",
                              }}
                            >
                              {row.assignment_count.toLocaleString()}
                            </td>
                            <td
                              style={{
                                padding: "16px 28px",
                                textAlign: "right",
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#34d399",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {fmtCents(row.total_spend_cents)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {!m && metrics.isLoading && <Empty title="Loading metrics…" />}
    </div>
  );
}
