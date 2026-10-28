"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createMarketAlert,
  deleteMarketAlert,
  patchMarketAlert,
  getMarketAlertsMe,
  type AlertFrequency,
  type MarketAlertDto,
} from "@/lib/market-alerts-api";
import { queryKeys } from "@/lib/query-keys";

// ── Static options ────────────────────────────────────────────────────────────

const LEAD_TYPES = [
  { value: "Divorce", label: "Divorce" },
  { value: "Foreclosure", label: "Foreclosure" },
  { value: "Inherited", label: "Inherited" },
  { value: "Tired Landlord", label: "Tired Landlord" },
  { value: "Need Cash", label: "Need Cash" },
  { value: "Relocating", label: "Relocating" },
  { value: "Old Age", label: "Old Age" },
  { value: "Probate", label: "Probate" },
  { value: "Tax Delinquent", label: "Tax Delinquent" },
  { value: "Other", label: "Other" },
];

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
];

const FREQUENCIES: { value: AlertFrequency; label: string; hint: string }[] = [
  { value: "instant", label: "Instant", hint: "As soon as a match drops" },
  { value: "hourly", label: "Hourly", hint: "Digest every hour" },
  { value: "daily", label: "Daily", hint: "One summary per day" },
  { value: "weekly", label: "Weekly", hint: "Weekly roundup" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

function fmtFreq(f: string) {
  return FREQUENCIES.find((x) => x.value === f)?.label ?? f;
}

function fmtLeadTypes(types?: string[]) {
  if (!types?.length) return "Any lead type";
  return types
    .map((t) => LEAD_TYPES.find((x) => x.value === t)?.label ?? t)
    .join(", ");
}

function fmtStates(states?: string[]) {
  if (!states?.length) return "All states";
  const names = states.map(
    (a) => US_STATES.find((s) => s.abbr === a)?.name ?? a,
  );
  if (names.length <= 4) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

// ── Chip component ────────────────────────────────────────────────────────────

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: selected
          ? "1px solid rgba(99,102,241,0.6)"
          : "1px solid rgba(255,255,255,0.1)",
        background: selected
          ? "rgba(99,102,241,0.18)"
          : "rgba(255,255,255,0.04)",
        color: selected ? "#a5b4fc" : "rgba(255,255,255,0.55)",
        fontSize: 12,
        fontWeight: selected ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.12s",
        fontFamily: "Inter, sans-serif",
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
    </button>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateAlertForm({ onCreated }: { onCreated: () => void }) {
  const [leadTypes, setLeadTypes] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [freq, setFreq] = useState<AlertFrequency>("daily");

  const create = useMutation({
    mutationFn: () =>
      createMarketAlert({
        filters: {
          lead_types: leadTypes.length ? leadTypes : undefined,
          states: states.length ? states : undefined,
        },
        delivery_channels: channels,
        frequency: freq,
        is_active: true,
      }),
    onSuccess: () => {
      setLeadTypes([]);
      setStates([]);
      setChannels(["email"]);
      setFreq("daily");
      onCreated();
    },
  });

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div
        style={{
          fontFamily: "Manrope, sans-serif",
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        New alert
      </div>

      {/* Lead types */}
      <div style={{ marginBottom: 20 }}>
        <div style={labelStyle}>Lead types</div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            marginBottom: 10,
          }}
        >
          Leave blank to match any type
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
          {LEAD_TYPES.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              selected={leadTypes.includes(t.value)}
              onClick={() => setLeadTypes((prev) => toggle(prev, t.value))}
            />
          ))}
        </div>
      </div>

      {/* States */}
      <div style={{ marginBottom: 20 }}>
        <div style={labelStyle}>States</div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            marginBottom: 10,
          }}
        >
          Leave blank to match all states
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
          {US_STATES.map((s) => (
            <Chip
              key={s.abbr}
              label={s.name}
              selected={states.includes(s.abbr)}
              onClick={() => setStates((prev) => toggle(prev, s.abbr))}
            />
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div style={{ marginBottom: 20 }}>
        <div style={labelStyle}>Frequency</div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap" as const,
            marginTop: 10,
          }}
        >
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFreq(f.value)}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                border:
                  freq === f.value
                    ? "1px solid rgba(99,102,241,0.6)"
                    : "1px solid rgba(255,255,255,0.1)",
                background:
                  freq === f.value
                    ? "rgba(99,102,241,0.18)"
                    : "rgba(255,255,255,0.04)",
                color: freq === f.value ? "#a5b4fc" : "rgba(255,255,255,0.5)",
                fontSize: 13,
                fontWeight: freq === f.value ? 600 : 400,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <div>{f.label}</div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>
                {f.hint}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div style={{ marginBottom: 24 }}>
        <div style={labelStyle}>Channels</div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 10,
            flexWrap: "wrap" as const,
          }}
        >
          {[
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" },
          ].map((ch) => {
            const on = channels.includes(ch.value);
            return (
              <button
                key={ch.value}
                type="button"
                onClick={() =>
                  setChannels((prev) => {
                    const next = toggle(prev, ch.value);
                    return next.length === 0 ? prev : next;
                  })
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: on
                    ? "1px solid rgba(16,185,129,0.4)"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: on
                    ? "rgba(16,185,129,0.1)"
                    : "rgba(255,255,255,0.04)",
                  color: on ? "#6ee7b7" : "rgba(255,255,255,0.45)",
                  fontSize: 13,
                  fontWeight: on ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: on ? "#10b981" : "rgba(255,255,255,0.2)",
                    flexShrink: 0,
                  }}
                />
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          disabled={create.isPending || channels.length === 0}
          onClick={() => create.mutate()}
          style={{
            padding: "10px 22px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            opacity: create.isPending ? 0.7 : 1,
          }}
        >
          {create.isPending ? "Saving…" : "Save alert"}
        </button>
        {create.isError && (
          <span style={{ fontSize: 12, color: "#fca5a5" }}>
            {(create.error as Error).message}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onChange,
}: {
  alert: MarketAlertDto;
  onChange: () => void;
}) {
  const del = useMutation({
    mutationFn: () => deleteMarketAlert(alert.id),
    onSuccess: onChange,
  });
  const toggle = useMutation({
    mutationFn: () =>
      patchMarketAlert(alert.id, { is_active: !alert.is_active }),
    onSuccess: onChange,
  });

  const leadTypes = alert.filters?.lead_types;
  const states = alert.filters?.states;
  const channels = alert.delivery_channels ?? [];

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        border: `1px solid ${alert.is_active ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 14,
        padding: "18px 20px",
        opacity: alert.is_active ? 1 : 0.6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Lead types */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              marginBottom: 6,
            }}
          >
            {fmtLeadTypes(leadTypes)}
          </div>

          {/* States */}
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              marginBottom: 10,
            }}
          >
            {fmtStates(states)}
          </div>

          {/* Badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
            <span style={badge("#6366f1")}>{fmtFreq(alert.frequency)}</span>
            {channels.map((ch) => (
              <span key={ch} style={badge("#10b981")}>
                {ch}
              </span>
            ))}
            {!alert.is_active && <span style={badge("#64748b")}>paused</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {alert.is_active ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={() => del.mutate()}
            disabled={del.isPending}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.06)",
              color: "#fca5a5",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function badge(color: string) {
  return {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    background: `${color}22`,
    border: `1px solid ${color}44`,
    color: color,
    fontFamily: "Inter, sans-serif",
  } as const;
}

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "rgba(255,255,255,0.6)",
} as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketAlertsPage() {
  const qc = useQueryClient();
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: queryKeys.marketAlerts.me,
    queryFn: getMarketAlertsMe,
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: queryKeys.marketAlerts.me });
  }

  const active = alerts.filter((a) => a.is_active);
  const paused = alerts.filter((a) => !a.is_active);

  return (
    <div
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "36px 24px 92px",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "" as const,
            color: "#a5b4fc",
            marginBottom: 8,
          }}
        >
          Account settings
        </div>
        <h1
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 30,
            fontWeight: 800,
            margin: "0 0 8px",
            letterSpacing: "-0.5px",
          }}
        >
          Lead alerts
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 14,
            margin: 0,
            maxWidth: 520,
          }}
        >
          Get notified when new leads match your criteria. Configure lead types,
          states, delivery channel, and how often you want updates.
        </p>
      </div>

      {/* Summary row */}
      {alerts.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {[
            {
              label: "Active alerts",
              value: String(active.length),
              color: "#6366f1",
            },
            { label: "Paused", value: String(paused.length), color: "#64748b" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                minWidth: 100,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 4,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "" as const,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 22,
                  fontWeight: 800,
                  color,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <CreateAlertForm onCreated={refresh} />

      {/* Alert list */}
      <div style={{ marginTop: 32 }}>
        {isLoading && (
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
              padding: "24px 0",
            }}
          >
            Loading…
          </div>
        )}

        {!isLoading && alerts.length === 0 && (
          <div
            style={{
              textAlign: "center" as const,
              padding: "40px 20px",
              color: "rgba(255,255,255,0.3)",
              fontSize: 14,
              border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: 14,
            }}
          >
            No alerts yet. Create one above to get started.
          </div>
        )}

        {alerts.length > 0 && (
          <>
            {active.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ ...labelStyle, marginBottom: 12 }}>Active</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: 10,
                  }}
                >
                  {active.map((a) => (
                    <AlertCard key={a.id} alert={a} onChange={refresh} />
                  ))}
                </div>
              </div>
            )}

            {paused.length > 0 && (
              <div>
                <div style={{ ...labelStyle, marginBottom: 12 }}>Paused</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: 10,
                  }}
                >
                  {paused.map((a) => (
                    <AlertCard key={a.id} alert={a} onChange={refresh} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
