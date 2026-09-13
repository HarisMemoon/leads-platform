"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDistributionEngineSettings,
  getAdminExtendedMetrics,
  patchDistributionEngineSettings,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Stat } from "../../components/Stat";
import { Banner } from "../../components/Banner";
import { Empty } from "../../components/Empty";

// --- Sub-component: SettingField ---
function SettingField({
  label,
  description,
  value,
  onChange,
  suffix,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#fff",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.4)",
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 14,
            width: 80,
            textAlign: "right",
            outline: "none",
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />
        <span
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            fontWeight: 500,
          }}
        >
          {suffix}
        </span>
      </div>
    </div>
  );
}

// --- Main Tab ---
export default function DistributionTab() {
  const qc = useQueryClient();
  const engine = useQuery({
    queryKey: queryKeys.admin.engine,
    queryFn: getDistributionEngineSettings,
  });
  const metrics = useQuery({
    queryKey: queryKeys.admin.metrics,
    queryFn: getAdminExtendedMetrics,
  });

  const patch = useMutation({
    mutationFn: (body: any) => patchDistributionEngineSettings(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.engine });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metrics });
    },
  });

  const e = engine.data;
  const m = metrics.data;
  const isRunning = e != null && !e.queue_paused;

  const [maxRuns, setMaxRuns] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [mdDays, setMdDays] = useState("");
  const [mdPct, setMdPct] = useState("");
  const [earlyAccess, setEarlyAccess] = useState("");

  useEffect(() => {
    if (!e) return;
    setMaxRuns(String(e.max_auto_distribution_runs));
    setCooldown(String(e.cooldown_minutes_between_runs));
    setMdDays(String(e.markdown_after_days));
    setMdPct(String(e.markdown_percent));
    setEarlyAccess(String(e.early_access_minutes));
  }, [e?.updated_at]);

  function handleSave() {
    if (!e) return;
    patch.mutate({
      max_auto_distribution_runs:
        Number(maxRuns) || e.max_auto_distribution_runs,
      cooldown_minutes_between_runs:
        Number(cooldown) || e.cooldown_minutes_between_runs,
      markdown_after_days: Number(mdDays) || e.markdown_after_days,
      markdown_percent: Number(mdPct) || e.markdown_percent,
      early_access_minutes: Number(earlyAccess) || e.early_access_minutes,
    });
  }

  const fillRate =
    m &&
    m.availableLeads !== undefined &&
    m.autoDistributionParticipants !== undefined
      ? m.autoDistributionParticipants > 0
        ? Math.min(
            100,
            Math.round(
              (m.autoDistributionParticipants / Math.max(m.availableLeads, 1)) *
                100,
            ),
          )
        : 0
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
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "20px 24px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              fontFamily: "Manrope, sans-serif",
              color: "#fff",
            }}
          >
            Auto-Distribution Engine
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              margin: "4px 0 0",
            }}
          >
            Control the core system that automatically matches and routes leads
            to buyers.
          </p>
        </div>
        {e && (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(0,0,0,0.3)",
                padding: "8px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isRunning ? "#34d399" : "#f59e0b",
                  boxShadow: isRunning
                    ? "0 0 12px #34d399"
                    : "0 0 12px #f59e0b",
                  animation: isRunning ? "pulse 2s infinite" : "none",
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: isRunning ? "#34d399" : "#f59e0b",
                }}
              >
                {isRunning ? "Engine Active" : "Engine Paused"}
              </span>
            </div>
            <button
              disabled={patch.isPending}
              onClick={() => patch.mutate({ queue_paused: !e.queue_paused })}
              style={{
                background: isRunning
                  ? "rgba(245,158,11,0.15)"
                  : "rgba(52,211,153,0.15)",
                border: `1px solid ${isRunning ? "rgba(245,158,11,0.4)" : "rgba(52,211,153,0.4)"}`,
                color: isRunning ? "#fcd34d" : "#6ee7b7",
                padding: "10px 20px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {isRunning ? "Halt Engine" : "Start Engine"}
            </button>
          </div>
        )}
      </div>

      {engine.isError && (
        <Banner tone="bad">{(engine.error as Error).message}</Banner>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 16,
        }}
      >
        <Stat
          label="Available Leads"
          value={m?.availableLeads ?? "—"}
          accent="linear-gradient(135deg, #34d399, #10b981)"
        />
        <Stat
          label="Auto-Buy Participants"
          value={m?.autoDistributionParticipants ?? "—"}
          accent="linear-gradient(135deg, #6366f1, #8b5cf6)"
        />
        <Stat
          label="Active Subscriptions"
          value={m?.activeSubscriptions ?? "—"}
          accent="linear-gradient(135deg, #38bdf8, #6366f1)"
        />
        <Stat
          label="Total Assignments"
          value={m?.totalAssignments ?? "—"}
          accent="linear-gradient(135deg, #94a3b8, #64748b)"
        />
      </div>

      {fillRate !== null && (
        <div
          style={{
            background:
              "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                Pipeline Pressure
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 4,
                }}
              >
                Ratio of active buyers to available leads — higher means faster
                sellouts.
              </div>
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color:
                  fillRate > 80
                    ? "#34d399"
                    : fillRate > 40
                      ? "#f59e0b"
                      : "#f87171",
                fontFamily: "Manrope, sans-serif",
                lineHeight: 1,
              }}
            >
              {fillRate}%
            </div>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: "rgba(0,0,0,0.4)",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 4,
                width: `${Math.min(fillRate, 100)}%`,
                background:
                  fillRate > 80
                    ? "linear-gradient(90deg, #34d399, #10b981)"
                    : fillRate > 40
                      ? "linear-gradient(90deg, #f59e0b, #fcd34d)"
                      : "linear-gradient(90deg, #f87171, #ef4444)",
                transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
        </div>
      )}

      {engine.isLoading ? (
        <Empty title="Loading engine settings..." />
      ) : (
        e && (
          <div
            style={{
              background:
                "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 32,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 32,
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#818cf8",
                    marginBottom: 8,
                  }}
                >
                  Throughput Configuration
                </div>
                <SettingField
                  label="Max Passes Per Lead"
                  description="How many times the engine attempts to assign a lead before giving up."
                  value={maxRuns}
                  onChange={setMaxRuns}
                  suffix="passes"
                />
                <SettingField
                  label="Cooldown Between Passes"
                  description="Minimum wait time between distribution attempts for the exact same lead."
                  value={cooldown}
                  onChange={setCooldown}
                  suffix="minutes"
                />
                <SettingField
                  label="Pro Early-Access Window"
                  description="Pro subscribers see new leads before Free-plan buyers by this margin."
                  value={earlyAccess}
                  onChange={setEarlyAccess}
                  suffix="minutes"
                />
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#fcd34d",
                    marginBottom: 8,
                  }}
                >
                  Price Decay Logic
                </div>
                <SettingField
                  label="Markdown Starts After"
                  description="Leads sitting unsold longer than this automatically trigger price reductions."
                  value={mdDays}
                  onChange={setMdDays}
                  suffix="days"
                />
                <SettingField
                  label="Markdown Amount"
                  description="The base price is cut by this percentage once the markdown window opens."
                  value={mdPct}
                  onChange={setMdPct}
                  suffix="% off"
                />

                <div
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    padding: 20,
                    marginTop: "auto",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: 12,
                      fontWeight: 600,
                    }}
                  >
                    Active Variables
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      fontSize: 13,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      Max passes:{" "}
                      <strong style={{ color: "#fff" }}>
                        {e.max_auto_distribution_runs}
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      Cooldown:{" "}
                      <strong style={{ color: "#fff" }}>
                        {e.cooldown_minutes_between_runs}m
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      Early access:{" "}
                      <strong style={{ color: "#fff" }}>
                        {e.early_access_minutes}m
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      Markdown:{" "}
                      <strong style={{ color: "#fff" }}>
                        {e.markdown_percent}% @ {e.markdown_after_days}d
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 32,
                paddingTop: 24,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                Last updated {new Date(e.updated_at).toLocaleString()}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {patch.isSuccess && (
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#34d399" }}
                  >
                    Settings saved ✓
                  </span>
                )}
                <button
                  disabled={patch.isPending}
                  onClick={handleSave}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    color: "#fff",
                    padding: "12px 32px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
                  }}
                >
                  {patch.isPending ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
