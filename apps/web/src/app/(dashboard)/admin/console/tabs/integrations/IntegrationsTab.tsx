"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminIntegrationsHealth } from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Banner } from "../../components/Banner";
import { Empty } from "../../components/Empty";
import { Pill } from "../../components/Pill";

export default function IntegrationsTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: queryKeys.admin.integrationsHealth,
    queryFn: getAdminIntegrationsHealth,
  });

  // Calculate overall system health
  const downCount = data?.filter((i) => i.status === "down").length || 0;
  const warnCount = data?.filter((i) => i.status === "warn").length || 0;

  const overallStatus =
    downCount > 0 ? "critical" : warnCount > 0 ? "degraded" : "operational";
  const overallColor =
    overallStatus === "critical"
      ? "#ef4444"
      : overallStatus === "degraded"
        ? "#f59e0b"
        : "#34d399";
  const overallBg =
    overallStatus === "critical"
      ? "rgba(239,68,68,0.1)"
      : overallStatus === "degraded"
        ? "rgba(245,158,11,0.1)"
        : "rgba(52,211,153,0.1)";

  return (
    <div className="integrations-container">
      <style>{`
        .integrations-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
        }

        /* Overall Health Banner */
        .health-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          border-radius: 16px;
          background: linear-gradient(145deg, rgba(24, 24, 27, 0.6), rgba(9, 9, 11, 0.8));
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
          position: relative;
          overflow: hidden;
        }

        /* Integration Card */
        .integration-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        
        .integration-card {
          background: linear-gradient(145deg, rgba(20, 22, 30, 0.6), rgba(12, 14, 20, 0.8));
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .integration-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 12px 30px rgba(0,0,0,0.4);
        }
        
        .card-glow {
          position: absolute;
          top: -50px;
          right: -50px;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.15;
          pointer-events: none;
          transition: opacity 0.3s;
        }
        .integration-card:hover .card-glow {
          opacity: 0.3;
        }

        /* Buttons & Utils */
        .btn-refresh {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-refresh:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
        }
        .btn-refresh:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .pulse-orb {
          width: 12px; height: 12px; border-radius: 50%;
          position: relative;
        }
        .pulse-orb::after {
          content: ''; position: absolute; inset: -4px;
          border-radius: 50%; border: 1px solid currentColor;
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }

        @media (max-width: 768px) {
          .header-row { flex-direction: column; align-items: stretch; }
          .health-banner { flex-direction: column; align-items: flex-start; }
          .integration-grid { grid-template-columns: 1fr; }
          .btn-refresh { justify-content: center; width: 100%; }
        }
      `}</style>

      <div className="header-row">
        <SectionTitle
          title="System Health & Integrations"
          sub="Live probes and latency tracking for external services."
        />
        <button
          className="btn-refresh"
          disabled={isFetching}
          onClick={() =>
            void qc.invalidateQueries({
              queryKey: queryKeys.admin.integrationsHealth,
            })
          }
        >
          <svg
            className={isFetching ? "spin" : ""}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isFetching ? "Probing Systems..." : "Refresh Probes"}
        </button>
      </div>

      {/* Overall Health Summary Banner */}
      {!isLoading && !isError && data && (
        <div className="health-banner">
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: overallColor,
            }}
          />
          <div style={{ color: overallColor }} className="pulse-orb" />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                fontFamily: "Manrope, sans-serif",
                color: "#fff",
                textTransform: "capitalize",
              }}
            >
              All Systems {overallStatus}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                marginTop: 4,
              }}
            >
              {data.length} services monitored · {downCount} offline ·{" "}
              {warnCount} degraded
            </div>
          </div>
          <div
            style={{
              background: overallBg,
              color: overallColor,
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              border: `1px solid ${overallColor}40`,
            }}
          >
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}

      {isLoading && (
        <div style={{ padding: "40px 0" }}>
          <Empty title="Running diagnostic probes..." />
        </div>
      )}
      {isError && <Banner tone="bad">{(error as Error).message}</Banner>}

      {data && (
        <div className="integration-grid">
          {data.map((it) => {
            const isOk = it.status === "ok";
            const isWarn = it.status === "warn";
            const isDown = it.status === "down";

            const accentColor = isOk
              ? "#34d399"
              : isWarn
                ? "#f59e0b"
                : isDown
                  ? "#ef4444"
                  : "#64748b";

            // Visual bar for latency (max 1000ms for calculation)
            const latencyPct = it.latency_ms
              ? Math.min(100, (it.latency_ms / 1000) * 100)
              : 0;
            const latencyColor =
              it.latency_ms && it.latency_ms > 500 ? "#f59e0b" : "#34d399";

            return (
              <div key={it.name} className="integration-card">
                <div
                  className="card-glow"
                  style={{ background: accentColor }}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {/* Generic Cloud/API Icon */}
                      <svg
                        width="20"
                        height="20"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                        />
                      </svg>
                    </div>
                    <div>
                      <strong
                        style={{
                          fontFamily: "Manrope, sans-serif",
                          fontSize: 18,
                          color: "#fff",
                          letterSpacing: "-0.01em",
                          display: "block",
                        }}
                      >
                        {it.name}
                      </strong>
                      <span
                        style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}
                      >
                        API Endpoint
                      </span>
                    </div>
                  </div>
                  <Pill
                    tone={
                      isOk
                        ? "good"
                        : isWarn
                          ? "warn"
                          : isDown
                            ? "bad"
                            : "default"
                    }
                  >
                    {isOk
                      ? "Online"
                      : isWarn
                        ? "Warning"
                        : isDown
                          ? "Down"
                          : "Unconfigured"}
                  </Pill>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.6,
                    minHeight: 42,
                    marginBottom: 20,
                  }}
                >
                  {it.note}
                </div>

                <div style={{ marginTop: "auto" }}>
                  {it.latency_ms != null ? (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>
                          Response Latency
                        </span>
                        <span style={{ color: latencyColor, fontWeight: 700 }}>
                          {it.latency_ms}ms
                        </span>
                      </div>
                      <div
                        style={{
                          height: 4,
                          borderRadius: 2,
                          background: "rgba(0,0,0,0.3)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(5, latencyPct)}%`,
                            background: latencyColor,
                            borderRadius: 2,
                            transition: "width 1s ease-out",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: 4, marginBottom: 16 }} /> // Spacer
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: 16,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                      fontWeight: 500,
                      textTransform: "",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <span>Last Checked</span>
                    <span>
                      {new Date(it.last_checked_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
