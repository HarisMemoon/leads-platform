"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Loader2,
  Lock,
  MapPin,
  PauseCircle,
  Settings2,
  ShieldCheck,
  Sliders,
  Tag,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  getBuyerPricingRulesMe,
  getDistributionMe,
  patchDistributionMe,
  upsertBuyerPricingRule,
  type BuyerPricingRuleDto,
  type DistributionRuleDto,
} from "@/lib/distribution-api";
import { getWalletMe, centsToNumber } from "@/lib/wallet-api";
import { queryKeys } from "@/lib/query-keys";
import { getAuthMe } from "@/lib/auth-api";

/* ─── constants ─────────────────────────────────────────────────────────── */

const MARKET_OPTIONS = [
  "Phoenix, AZ", "Dallas, TX", "Houston, TX", "Atlanta, GA",
  "Las Vegas, NV", "Tampa, FL", "Orlando, FL", "Miami, FL",
  "Charlotte, NC", "Nashville, TN", "Denver, CO", "Seattle, WA",
  "Chicago, IL", "Los Angeles, CA", "San Diego, CA", "Sacramento, CA",
];

const LEAD_TYPE_OPTIONS = [
  { value: "motivated_seller", label: "Motivated seller" },
  { value: "probate", label: "Probate" },
  { value: "foreclosure", label: "Foreclosure" },
  { value: "tax_delinquent", label: "Tax delinquent" },
  { value: "pre_foreclosure", label: "Pre-foreclosure" },
  { value: "vacant_property", label: "Vacant property" },
  { value: "inherited", label: "Inherited property" },
  { value: "divorce", label: "Divorce" },
  { value: "absentee_owner", label: "Absentee owner" },
  { value: "distressed", label: "Distressed" },
];

/* ─── helpers ────────────────────────────────────────────────────────────── */

function centsStrToDollars(cents: string | null): string {
  if (cents === null || cents === undefined) return "";
  const n = Number(cents);
  if (isNaN(n)) return "";
  return String(n / 100);
}

function dollarsToCents(v: string): number | null {
  const n = parseFloat(v);
  if (isNaN(n) || v.trim() === "") return null;
  return Math.round(n * 100);
}

function nullableInt(v: string): number | null {
  const n = parseInt(v, 10);
  if (isNaN(n) || v.trim() === "") return null;
  return n;
}

/* ─── NumberField ────────────────────────────────────────────────────────── */

function NumberField({
  label, value, onChange, prefix, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; placeholder?: string; hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{label}</span>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "rgba(255,255,255,0.3)", fontSize: 14, pointerEvents: "none", zIndex: 1,
          }}>
            {prefix}
          </span>
        )}
        <input
          type="number" min={0} value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? "Unlimited"}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: prefix ? "10px 12px 10px 26px" : "10px 14px",
            borderRadius: 10,
            border: `1px solid ${focused ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.09)"}`,
            background: focused ? "rgba(99,102,241,0.06)" : "rgba(0,0,0,0.3)",
            color: "#fff", fontSize: 14, outline: "none",
            transition: "border-color 0.15s, background 0.15s",
          }}
        />
      </div>
      {hint && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{hint}</span>}
    </label>
  );
}

/* ─── Toggle ─────────────────────────────────────────────────────────────── */

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div>
        <div style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{
          width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
          background: checked ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.1)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
          boxShadow: checked ? "0 0 16px rgba(99,102,241,0.4)" : "none",
        }}
      >
        <span style={{
          position: "absolute", top: 4, left: checked ? 26 : 4,
          width: 18, height: 18, borderRadius: "50%",
          background: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        }} />
      </button>
    </div>
  );
}

/* ─── MultiSelect ────────────────────────────────────────────────────────── */

function MultiSelect({
  label, options, selected, onChange, placeholder, icon,
}: {
  label: string; options: { value: string; label: string }[];
  selected: string[]; onChange: (v: string[]) => void;
  placeholder?: string; icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value]);
  const remove = (value: string) => onChange(selected.filter((s) => s !== value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: open ? 50 : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <span style={{ color: "rgba(255,255,255,0.3)" }}>{icon}</span>}
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{label}</span>
      </div>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {selected.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span key={v} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 10px 3px 12px", borderRadius: 20,
                background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                color: "#c4b5fd", fontSize: 12, fontWeight: 500,
              }}>
                {opt?.label ?? v}
                <button type="button" onClick={() => remove(v)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: 0, lineHeight: 1, color: "rgba(196,181,253,0.6)",
                }}>
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 10,
        border: `1px solid ${open ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.09)"}`,
        background: open ? "rgba(99,102,241,0.06)" : "rgba(0,0,0,0.3)",
        color: selected.length === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.85)",
        fontSize: 13, cursor: "pointer", textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
      }}>
        <span>{selected.length === 0 ? (placeholder ?? "Select…") : `${selected.length} selected`}</span>
        <ChevronDown size={13} style={{ opacity: 0.4, transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 200,
            marginTop: 4,
            borderRadius: 12,
            border: "1px solid rgba(99,102,241,0.28)",
            background: "#13141f",
            boxShadow: "0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button key={opt.value} type="button" onClick={() => toggle(opt.value)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px",
                background: isSelected ? "rgba(99,102,241,0.12)" : "transparent",
                border: "none", color: isSelected ? "#c4b5fd" : "rgba(255,255,255,0.65)",
                fontSize: 13, cursor: "pointer", textAlign: "left",
                transition: "background 0.1s",
              }}>
                <span style={{
                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                  border: isSelected ? "none" : "1px solid rgba(255,255,255,0.18)",
                  background: isSelected ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: "#fff",
                }}>
                  {isSelected && "✓"}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── SectionCard ────────────────────────────────────────────────────────── */

function SectionCard({
  children, accentColor, icon, title, subtitle, stackAboveNeighbors,
}: {
  children: React.ReactNode;
  accentColor?: string;
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Raise stacking so portaled-style dropdowns (MultiSelect) paint above the next card */
  stackAboveNeighbors?: boolean;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.022)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: "22px 22px 20px",
      marginBottom: 14,
      position: "relative",
      overflow: "visible",
      zIndex: stackAboveNeighbors ? 20 : undefined,
      transition: "border-color 0.2s",
    }}>
      {accentColor && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`,
        }} />
      )}
      {(icon || title) && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: subtitle ? 4 : 0 }}>
            {icon && (
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: accentColor ? `${accentColor}18` : "rgba(255,255,255,0.05)",
                border: accentColor ? `1px solid ${accentColor}25` : "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {icon}
              </div>
            )}
            {title && (
              <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                {title}
              </h2>
            )}
          </div>
          {subtitle && (
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0, paddingLeft: icon ? 40 : 0 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/* ─── StatusBanner ───────────────────────────────────────────────────────── */

function StatusBanner({ rule, walletBalanceCents }: { rule: DistributionRuleDto; walletBalanceCents: number }) {
  const minBalance = Number(rule.min_wallet_balance_cents ?? "0");
  const hasEnoughBalance = walletBalanceCents >= minBalance;

  let icon: React.ReactNode;
  let title: string;
  let sub: string;
  let bg: string;
  let border: string;
  let color: string;
  let glowColor: string;
  let dotColor: string;

  if (!rule.participation_enabled) {
    icon = <PauseCircle size={20} />;
    title = "Distribution paused";
    sub = "You are not currently participating in lead distribution. Enable participation below.";
    bg = "linear-gradient(135deg, rgba(234,179,8,0.1) 0%, rgba(234,179,8,0.04) 100%)";
    border = "rgba(234,179,8,0.25)";
    color = "#fde047";
    glowColor = "rgba(234,179,8,0.15)";
    dotColor = "#fde047";
  } else if (!hasEnoughBalance) {
    icon = <AlertTriangle size={20} />;
    title = "Insufficient wallet balance";
    sub = `Your wallet ($${(walletBalanceCents / 100).toFixed(2)}) is below your minimum reserve ($${(minBalance / 100).toFixed(2)}). Top up to resume.`;
    bg = "linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.04) 100%)";
    border = "rgba(239,68,68,0.25)";
    color = "#fca5a5";
    glowColor = "rgba(239,68,68,0.15)";
    dotColor = "#ef4444";
  } else {
    icon = <CheckCircle2 size={20} />;
    title = "Active in rotation";
    sub = "You are receiving leads from selected markets. Distribution engine is running.";
    bg = "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.04) 100%)";
    border = "rgba(34,197,94,0.25)";
    color = "#86efac";
    glowColor = "rgba(34,197,94,0.15)";
    dotColor = "#22c55e";
  }

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      padding: "18px 22px", borderRadius: 16,
      border: `1px solid ${border}`, background: bg,
      color, marginBottom: 28, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -30, right: -30,
        width: 120, height: 120,
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        borderRadius: "50%",
      }} />
      <div style={{
        width: 40, height: 40, borderRadius: 11,
        background: `${dotColor}18`, border: `1px solid ${dotColor}30`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1,
      }}>
        {icon}
      </div>
      <div style={{ zIndex: 1, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{sub}</div>
      </div>
      <div style={{
        zIndex: 1, display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 8,
        background: `${dotColor}18`, border: `1px solid ${dotColor}25`,
        fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0,
          boxShadow: rule.participation_enabled && hasEnoughBalance ? `0 0 8px ${dotColor}` : "none",
          animation: rule.participation_enabled && hasEnoughBalance ? "pulse 2s ease-in-out infinite" : "none",
        }} />
        {rule.participation_enabled && hasEnoughBalance ? "Live" : rule.participation_enabled ? "Paused" : "Off"}
      </div>
    </div>
  );
}

/* ─── Wallet Balance Widget ──────────────────────────────────────────────── */

function WalletWidget({ balanceCents }: { balanceCents: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 18px", borderRadius: 14,
      background: "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.04) 100%)",
      border: "1px solid rgba(16,185,129,0.22)",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Wallet size={18} color="#6ee7b7" aria-hidden />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Wallet balance</div>
          <div style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 800, color: "#6ee7b7", letterSpacing: -0.5 }}>
            ${(balanceCents / 100).toFixed(2)}
          </div>
        </div>
      </div>
      <Link href="/wallet" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderRadius: 9,
        background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)",
        color: "#6ee7b7", fontSize: 13, fontWeight: 600, textDecoration: "none",
        transition: "background 0.15s",
      }}>
        Top up <ArrowUpRight size={13} aria-hidden />
      </Link>
    </div>
  );
}

/* ─── DistributionForm ───────────────────────────────────────────────────── */

function DistributionForm({
  initial,
  walletBalanceCents,
  distributionLocked,
}: {
  initial: DistributionRuleDto;
  walletBalanceCents: number;
  distributionLocked: boolean;
}) {
  const qc = useQueryClient();

  const [participation, setParticipation] = useState(initial.participation_enabled);
  const [maxLeadsDay, setMaxLeadsDay] = useState(initial.max_leads_per_day != null ? String(initial.max_leads_per_day) : "");
  const [maxLeadsWeek, setMaxLeadsWeek] = useState(initial.max_leads_per_week != null ? String(initial.max_leads_per_week) : "");
  const [maxLeadsMonth, setMaxLeadsMonth] = useState(initial.max_leads_per_month != null ? String(initial.max_leads_per_month) : "");
  const [maxSpendDay, setMaxSpendDay] = useState(centsStrToDollars(initial.max_spend_per_day_cents));
  const [maxSpendWeek, setMaxSpendWeek] = useState(centsStrToDollars(initial.max_spend_per_week_cents));
  const [maxSpendMonth, setMaxSpendMonth] = useState(centsStrToDollars(initial.max_spend_per_month_cents));
  const [minBalance, setMinBalance] = useState(centsStrToDollars(initial.min_wallet_balance_cents) || "0");
  const [markets, setMarkets] = useState<string[]>(initial.market_filters ?? []);
  const [leadTypes, setLeadTypes] = useState<string[]>(initial.lead_type_filters ?? []);
  const [cooldown, setCooldown] = useState(String(initial.cooldown_minutes ?? 0));

  const liveRule: DistributionRuleDto = {
    ...initial,
    participation_enabled: participation,
    min_wallet_balance_cents: String(Math.round(parseFloat(minBalance || "0") * 100)),
  };

  const mutation = useMutation({
    mutationFn: () =>
      patchDistributionMe({
        participation_enabled: participation,
        max_leads_per_day: nullableInt(maxLeadsDay),
        max_leads_per_week: nullableInt(maxLeadsWeek),
        max_leads_per_month: nullableInt(maxLeadsMonth),
        max_spend_per_day_cents: dollarsToCents(maxSpendDay),
        max_spend_per_week_cents: dollarsToCents(maxSpendWeek),
        max_spend_per_month_cents: dollarsToCents(maxSpendMonth),
        min_wallet_balance_cents: Math.round(parseFloat(minBalance || "0") * 100),
        market_filters: markets,
        lead_type_filters: leadTypes,
        cooldown_minutes: parseInt(cooldown, 10) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.distribution.me });
    },
  });

  const readOnly = distributionLocked;

  return (
    <div>
      <StatusBanner rule={liveRule} walletBalanceCents={walletBalanceCents} />
      <WalletWidget balanceCents={walletBalanceCents} />

      {readOnly && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 14,
            marginBottom: 14,
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.28)",
            color: "#fcd34d",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <Lock size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#fde68a" }}>
              Distribution settings are locked
            </div>
            <div style={{ color: "rgba(253,230,138,0.88)" }}>
              An administrator has frozen changes to your auto-distribution rule. You can still review your
              settings and manage your wallet; contact support if you need this updated.
            </div>
          </div>
        </div>
      )}

      <div
        style={
          readOnly
            ? { opacity: 0.55, pointerEvents: "none" as const, userSelect: "none" as const }
            : undefined
        }
        aria-hidden={readOnly ? true : undefined}
      >
      {/* ── Participation ── */}
      <SectionCard
        accentColor="#6366f1"
        icon={<Activity size={15} color="#a5b4fc" aria-hidden />}
        title="Participation"
        subtitle="Enable to be included in the automatic lead distribution rotation."
      >
        <Toggle
          checked={participation}
          onChange={setParticipation}
          label="Participate in lead distribution"
          sub="Receive leads automatically when they match your criteria"
        />
      </SectionCard>

      {/* ── Lead limits ── */}
      <SectionCard
        accentColor="#8b5cf6"
        icon={<BarChart3 size={15} color="#c4b5fd" aria-hidden />}
        title="Lead limits"
        subtitle="Cap the number of leads you receive per period. Leave blank for no limit."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <NumberField
            label="Per day" value={maxLeadsDay} onChange={setMaxLeadsDay}
            hint="max leads/day"
          />
          <NumberField
            label="Per week" value={maxLeadsWeek} onChange={setMaxLeadsWeek}
            hint="max leads/week"
          />
          <NumberField
            label="Per month" value={maxLeadsMonth} onChange={setMaxLeadsMonth}
            hint="max leads/month"
          />
        </div>
      </SectionCard>

      {/* ── Spend limits ── */}
      <SectionCard
        accentColor="#10b981"
        icon={<CircleDollarSign size={15} color="#6ee7b7" aria-hidden />}
        title="Spend limits"
        subtitle="Cap total spend per period. Leave blank for no limit."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <NumberField label="Per day" value={maxSpendDay} onChange={setMaxSpendDay} prefix="$" placeholder="No limit" hint="daily spend cap" />
          <NumberField label="Per week" value={maxSpendWeek} onChange={setMaxSpendWeek} prefix="$" placeholder="No limit" hint="weekly spend cap" />
          <NumberField label="Per month" value={maxSpendMonth} onChange={setMaxSpendMonth} prefix="$" placeholder="No limit" hint="monthly spend cap" />
        </div>
      </SectionCard>

      {/* ── Budget protection ── */}
      <SectionCard
        accentColor="#f59e0b"
        icon={<ShieldCheck size={15} color="#fcd34d" aria-hidden />}
        title="Budget protection"
        subtitle="Prevent purchases if your wallet would drop below a minimum reserve."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "end" }}>
          <NumberField
            label="Minimum wallet balance before buying"
            value={minBalance}
            onChange={setMinBalance}
            prefix="$"
            placeholder="0"
            hint="distribution pauses if balance drops below this"
          />
          <div style={{
            padding: "14px 16px", borderRadius: 12,
            background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)",
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Auto-reload</div>
            <Link href="/wallet" style={{ color: "#a5b4fc", fontSize: 13, textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              Configure auto-reload <ArrowUpRight size={13} />
            </Link>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 6, lineHeight: 1.4 }}>
              Keep your wallet funded automatically to avoid distribution gaps.
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Market & lead filters ── */}
      <SectionCard
        stackAboveNeighbors
        accentColor="#06b6d4"
        icon={<Sliders size={15} color="#67e8f9" aria-hidden />}
        title="Market &amp; lead filters"
        subtitle="Limit which markets and lead types you receive. Empty = accept all."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <MultiSelect
            label="Markets"
            options={MARKET_OPTIONS.map((m) => ({ value: m, label: m }))}
            selected={markets}
            onChange={setMarkets}
            placeholder="All markets"
            icon={<MapPin size={12} />}
          />
          <MultiSelect
            label="Lead types"
            options={LEAD_TYPE_OPTIONS}
            selected={leadTypes}
            onChange={setLeadTypes}
            placeholder="All lead types"
            icon={<Tag size={12} />}
          />
        </div>
        {(markets.length > 0 || leadTypes.length > 0) && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 10,
            background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
            fontSize: 12, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 7,
          }}>
            <Settings2 size={13} color="#67e8f9" />
            Filtering to{" "}
            {markets.length > 0 && <><span style={{ color: "#67e8f9", fontWeight: 600 }}>{markets.length} market{markets.length !== 1 ? "s" : ""}</span></>}
            {markets.length > 0 && leadTypes.length > 0 && " and "}
            {leadTypes.length > 0 && <><span style={{ color: "#67e8f9", fontWeight: 600 }}>{leadTypes.length} lead type{leadTypes.length !== 1 ? "s" : ""}</span></>}
          </div>
        )}
      </SectionCard>

      {/* ── Cooldown ── */}
      <SectionCard
        accentColor="#a78bfa"
        icon={<Clock size={15} color="#c4b5fd" aria-hidden />}
        title="Rotation &amp; cooldown"
        subtitle="Enforce a minimum gap between consecutive purchases to spread lead intake."
      >
        <div style={{ maxWidth: 280 }}>
          <NumberField
            label="Cooldown between purchases"
            value={cooldown}
            onChange={setCooldown}
            placeholder="0"
            hint="minutes between purchases (0 = no cooldown)"
          />
        </div>
        {parseInt(cooldown, 10) > 0 && (
          <div style={{
            marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 14px", borderRadius: 10,
            background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
            fontSize: 12, color: "#c4b5fd",
          }}>
            <Clock size={13} />
            {cooldown} minute{parseInt(cooldown, 10) !== 1 ? "s" : ""} between purchases
          </div>
        )}
      </SectionCard>

      {/* ── Save ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 4 }}>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || readOnly}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 32px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "#fff", fontWeight: 700, fontSize: 14,
            cursor: mutation.isPending ? "not-allowed" : "pointer",
            opacity: mutation.isPending ? 0.7 : 1,
            transition: "opacity 0.15s, transform 0.15s",
            boxShadow: mutation.isPending ? "none" : "0 8px 24px rgba(99,102,241,0.35)",
            fontFamily: "Syne, sans-serif",
          }}
        >
          {mutation.isPending
            ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
            : <><Zap size={15} /> Save settings</>
          }
        </button>

        {mutation.isSuccess && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "10px 16px", borderRadius: 10,
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
            color: "#86efac", fontSize: 13, fontWeight: 600,
            animation: "fadeUp 0.3s ease both",
          }}>
            <CheckCircle2 size={15} /> Settings saved successfully
          </div>
        )}

        {mutation.isError && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "10px 16px", borderRadius: 10,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#fca5a5", fontSize: 13,
          }}>
            <AlertTriangle size={15} />
            {(mutation.error as Error).message}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function PricingRulesPanel({
  rules,
  distributionLocked,
}: {
  rules: BuyerPricingRuleDto[];
  distributionLocked: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("Default vendor bid");
  const [markets, setMarkets] = useState<string[]>([]);
  const [leadTypes, setLeadTypes] = useState<string[]>([]);
  const [fixedPrice, setFixedPrice] = useState("");
  const [maxBid, setMaxBid] = useState("");
  const [priority, setPriority] = useState("0");
  const [exclusivity, setExclusivity] = useState<"exclusive_only" | "non_exclusive_only" | "both">("both");

  const mutation = useMutation({
    mutationFn: () =>
      upsertBuyerPricingRule({
        name,
        markets,
        lead_types: leadTypes,
        fixed_price_cents: dollarsToCents(fixedPrice),
        max_bid_cents: dollarsToCents(maxBid),
        priority: parseInt(priority, 10) || 0,
        exclusivity_preference: exclusivity,
        routing_strategy: "highest_bid",
        is_active: true,
        paused: false,
      }),
    onSuccess: () => {
      setFixedPrice("");
      setMaxBid("");
      qc.invalidateQueries({ queryKey: queryKeys.distribution.pricingRules });
    },
  });

  return (
    <SectionCard
      stackAboveNeighbors
      accentColor="#22c55e"
      icon={<CircleDollarSign size={15} color="#86efac" aria-hidden />}
      title="Ping pricing & bid rules"
      subtitle="These rules tell the real-time ping engine what markets you buy and what you will pay."
    >
      {rules.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          {rules.map((rule) => (
            <div
              key={rule.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                fontSize: 12,
              }}
            >
              <div>
                <div style={{ color: "#fff", fontWeight: 700 }}>{rule.name}</div>
                <div style={{ color: "rgba(255,255,255,0.38)", marginTop: 3 }}>
                  {rule.markets.length ? rule.markets.join(", ") : "All markets"} ·{" "}
                  {rule.lead_types.length ? `${rule.lead_types.length} lead types` : "all lead types"}
                </div>
              </div>
              <div style={{ color: "rgba(255,255,255,0.62)" }}>
                Fixed {rule.fixed_price_cents ? `$${(Number(rule.fixed_price_cents) / 100).toFixed(0)}` : "not set"}
                <br />
                Max bid {rule.max_bid_cents ? `$${(Number(rule.max_bid_cents) / 100).toFixed(0)}` : "not set"}
              </div>
              <div style={{ color: rule.paused || !rule.is_active ? "#fca5a5" : "#86efac" }}>
                {rule.paused || !rule.is_active ? "Paused" : "Live"} · priority {rule.priority}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={
          distributionLocked
            ? { opacity: 0.55, pointerEvents: "none" as const, userSelect: "none" as const }
            : undefined
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Rule name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputLikeStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Exclusivity</span>
            <select
              value={exclusivity}
              onChange={(e) => setExclusivity(e.target.value as typeof exclusivity)}
              style={inputLikeStyle}
            >
              <option value="both">Exclusive or shared</option>
              <option value="exclusive_only">Exclusive only</option>
              <option value="non_exclusive_only">Shared only</option>
            </select>
          </label>
          <MultiSelect
            label="Ping markets"
            options={MARKET_OPTIONS.map((m) => ({ value: m, label: m }))}
            selected={markets}
            onChange={setMarkets}
            placeholder="All markets"
            icon={<MapPin size={12} />}
          />
          <MultiSelect
            label="Ping lead types"
            options={LEAD_TYPE_OPTIONS}
            selected={leadTypes}
            onChange={setLeadTypes}
            placeholder="All lead types"
            icon={<Tag size={12} />}
          />
          <NumberField label="Fixed price" value={fixedPrice} onChange={setFixedPrice} prefix="$" placeholder="Optional" />
          <NumberField label="Max bid" value={maxBid} onChange={setMaxBid} prefix="$" placeholder="Optional" />
          <NumberField label="Priority" value={priority} onChange={setPriority} placeholder="0" />
        </div>
        <button
          type="button"
          disabled={mutation.isPending || distributionLocked || !name.trim()}
          onClick={() => mutation.mutate()}
          style={{
            marginTop: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 18px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg,#10b981,#22c55e)",
            color: "#fff",
            fontWeight: 700,
            cursor: mutation.isPending ? "not-allowed" : "pointer",
          }}
        >
          {mutation.isPending ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={15} />}
          Save pricing rule
        </button>
        {mutation.isError && (
          <span style={{ marginLeft: 12, color: "#fca5a5", fontSize: 13 }}>{(mutation.error as Error).message}</span>
        )}
      </div>
    </SectionCard>
  );
}

const inputLikeStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(0,0,0,0.3)",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function DistributionSettingsPage() {
  const {
    data: rule,
    isLoading: ruleLoading,
    isError: ruleError,
    error: ruleErr,
  } = useQuery({
    queryKey: queryKeys.distribution.me,
    queryFn: getDistributionMe,
    retry: false,
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: queryKeys.wallet.me,
    queryFn: getWalletMe,
  });

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: getAuthMe,
  });

  const { data: pricingRules = [], isLoading: pricingLoading } = useQuery({
    queryKey: queryKeys.distribution.pricingRules,
    queryFn: getBuyerPricingRulesMe,
    retry: false,
  });

  const isLoading = ruleLoading || walletLoading || meLoading || pricingLoading;
  const walletBalanceCents = wallet ? centsToNumber(wallet.balance_cents) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; box-shadow: 0 0 6px currentColor; } 50% { opacity: 0.6; box-shadow: 0 0 12px currentColor; } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity: 0.35; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#080a0f",
        fontFamily: "DM Sans, sans-serif",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "36px 24px 100px" }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 32, animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))",
                border: "1px solid rgba(99,102,241,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Activity size={20} color="#a5b4fc" aria-hidden />
              </div>
              <div>
                <h1 style={{
                  fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 800,
                  margin: 0, letterSpacing: -0.8,
                  background: "linear-gradient(135deg,#fff 40%,rgba(255,255,255,0.5))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  Distribution Settings
                </h1>
              </div>
            </div>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, margin: 0, paddingLeft: 54 }}>
              Control how and when you receive leads from the auto-distribution engine.
            </p>
          </div>

          {/* ── Loading ── */}
          {isLoading && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "80px 0",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Loader2 size={24} color="#a5b4fc" style={{ animation: "spin 1s linear infinite" }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>Loading distribution settings…</p>
            </div>
          )}

          {/* ── Error ── */}
          {!isLoading && ruleError && (
            <div style={{
              padding: 24, borderRadius: 16,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#fca5a5", fontSize: 14,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <AlertTriangle size={18} />
                <strong style={{ fontFamily: "Syne, sans-serif", fontSize: 15 }}>No distribution rule found</strong>
              </div>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                {(ruleErr as Error).message?.includes("onboarding")
                  ? "Complete your onboarding to create a distribution rule, then return here."
                  : (ruleErr as Error).message}
              </p>
              {(ruleErr as Error).message?.includes("onboarding") && (
                <Link href="/onboarding" style={{
                  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14,
                  padding: "9px 16px", borderRadius: 9,
                  background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                  color: "#fca5a5", fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}>
                  Complete onboarding <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          )}

          {/* ── Form ── */}
          {!isLoading && rule && (
            <div style={{ animation: "fadeUp 0.4s ease 0.1s both" }}>
              <DistributionForm
                initial={rule}
                walletBalanceCents={walletBalanceCents}
                distributionLocked={Boolean(me?.distribution_locked)}
              />
              <PricingRulesPanel
                rules={pricingRules}
                distributionLocked={Boolean(me?.distribution_locked)}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
