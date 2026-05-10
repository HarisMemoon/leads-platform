"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  CreditCard,
  Loader2,
  PlugZap,
  Route,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Wallet,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getWebhookIntegration, patchWebhookIntegration, testWebhookIntegration } from "@/lib/integrations-api";
import { queryKeys } from "@/lib/query-keys";
import { getMySubscription } from "@/lib/subscriptions-api";
import {
  getDistributionMe,
  patchDistributionMe,
  type ExclusivityPreference,
} from "@/lib/distribution-api";
import { getWalletMe, centsToNumber } from "@/lib/wallet-api";

type Tone = "good" | "warn" | "info" | "muted" | "bad";

type HubCard = {
  href: string;
  title: string;
  desc: string;
  eyebrow: string;
  cta: string;
  Icon: LucideIcon;
  accent: string;
};

const SETTINGS_AREAS: HubCard[] = [
  {
    href: "/wallet",
    title: "Wallet & funding",
    desc: "Balance, top-ups, transactions, and auto-reload.",
    eyebrow: "Funds",
    cta: "Manage wallet",
    Icon: Wallet,
    accent: "#10b981",
  },
  {
    href: "/subscriptions",
    title: "Plan & billing",
    desc: "Pro plan, billing, and subscription status.",
    eyebrow: "Subscription",
    cta: "View billing",
    Icon: CreditCard,
    accent: "#8b5cf6",
  },
  {
    href: "/distribution",
    title: "Distribution rules",
    desc: "Auto-buy, markets, caps, cooldowns, and reserves.",
    eyebrow: "Automation",
    cta: "Tune rules",
    Icon: Route,
    accent: "#06b6d4",
  },
  {
    href: "/market-alerts",
    title: "Alerts & notifications",
    desc: "Saved markets and lead opportunity notifications.",
    eyebrow: "Signals",
    cta: "Update alerts",
    Icon: Bell,
    accent: "#f59e0b",
  },
];

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`settings-pill ${tone}`}>{children}</span>;
}

function MetricCard({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: Tone;
}) {
  return (
    <div className={`settings-metric ${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-hint">{hint}</div>
    </div>
  );
}

function SettingsCard({ item }: { item: HubCard }) {
  const Icon = item.Icon;
  return (
    <Link href={item.href} className="settings-card" style={{ "--accent": item.accent } as CSSProperties}>
      <div className="settings-card-top">
        <span className="settings-card-icon">
          <Icon size={19} strokeWidth={2} aria-hidden />
        </span>
        <span className="settings-card-eyebrow">{item.eyebrow}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.desc}</p>
      <span className="settings-card-cta">
        {item.cta}
        <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
      </span>
    </Link>
  );
}

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
  { value: "inherited", label: "Inherited" },
  { value: "distressed", label: "Distressed" },
];

const EXCLUSIVITY_OPTIONS: { value: ExclusivityPreference; label: string; hint: string }[] = [
  { value: "exclusive", label: "Exclusive only", hint: "Buy leads exclusively — sole buyer" },
  { value: "non_exclusive", label: "Shared only", hint: "Buy shared leads at lower per-buyer price" },
  { value: "both", label: "Either type", hint: "Auto-buy exclusive or shared, whichever qualifies" },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hookMsg, setHookMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // ── auto-distribution local state ────────────────────────────────────────
  const [distEnabled, setDistEnabled] = useState(false);
  const [distMarkets, setDistMarkets] = useState<string[]>([]);
  const [distLeadTypes, setDistLeadTypes] = useState<string[]>([]);
  const [distMinWallet, setDistMinWallet] = useState("");
  const [distMaxPrice, setDistMaxPrice] = useState("");
  const [distExclusivity, setDistExclusivity] = useState<ExclusivityPreference>("both");
  const [distMsg, setDistMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: getMySubscription,
  });

  const { data: hook, isLoading: hookLoading } = useQuery({
    queryKey: ["integrations", "webhook"],
    queryFn: getWebhookIntegration,
  });

  const { data: wallet } = useQuery({
    queryKey: queryKeys.wallet.me,
    queryFn: getWalletMe,
  });

  const { data: distRule, isLoading: distLoading } = useQuery({
    queryKey: queryKeys.distribution.me,
    queryFn: getDistributionMe,
  });

  const distMutation = useMutation({
    mutationFn: patchDistributionMe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.distribution.me });
      setDistMsg({ tone: "success", text: "Auto-distribution settings saved." });
    },
    onError: (e: unknown) => {
      setDistMsg({ tone: "error", text: e instanceof Error ? e.message : "Save failed" });
    },
  });

  useEffect(() => {
    if (hook?.webhook_url != null) setWebhookUrl(hook.webhook_url);
  }, [hook?.webhook_url]);

  useEffect(() => {
    if (!distRule) return;
    setDistEnabled(distRule.is_active);
    setDistMarkets(distRule.market_filters ?? []);
    setDistLeadTypes(distRule.lead_type_filters ?? []);
    setDistMinWallet(
      distRule.min_wallet_balance_cents
        ? String(Math.round(Number(distRule.min_wallet_balance_cents) / 100))
        : ""
    );
    setDistMaxPrice(
      distRule.max_lead_price_cents
        ? String(Math.round(Number(distRule.max_lead_price_cents) / 100))
        : ""
    );
    setDistExclusivity(distRule.exclusivity_preference ?? "both");
  }, [distRule]);

  function toggleMarket(m: string) {
    setDistMarkets((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  function toggleLeadType(t: string) {
    setDistLeadTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function saveDistribution() {
    setDistMsg(null);
    const minWalletCents = distMinWallet ? Math.round(parseFloat(distMinWallet) * 100) : 0;
    const maxPriceCents = distMaxPrice ? Math.round(parseFloat(distMaxPrice) * 100) : null;
    distMutation.mutate({
      is_active: distEnabled,
      market_filters: distMarkets,
      lead_type_filters: distLeadTypes,
      min_wallet_balance_cents: minWalletCents,
      max_lead_price_cents: maxPriceCents,
      exclusivity_preference: distExclusivity,
    });
  }

  const walletBalanceDollars = wallet
    ? (centsToNumber(wallet.balance_cents) / 100).toFixed(2)
    : null;

  const hasActiveSubscription = sub?.status === "active";
  const planLabel = subLoading ? "Checking..." : sub ? titleCase(sub.plan_type) : "No plan";
  const planTone: Tone = subLoading ? "muted" : hasActiveSubscription ? "good" : "warn";
  const usageLabel =
    sub?.monthly_lead_limit != null
      ? `${sub.leads_used_this_period} / ${sub.monthly_lead_limit}`
      : hasActiveSubscription
        ? "Unlimited"
        : "Not started";
  const usageHint =
    sub?.monthly_lead_limit != null
      ? "Used this period"
      : hasActiveSubscription
        ? "Included this period"
        : "Unlock with a plan";
  const webhookConfigured = Boolean(hook?.webhook_url);
  const webhookStatus = hookLoading
    ? "Checking..."
    : webhookConfigured
      ? titleCase(hook?.status ?? "connected")
      : "Not connected";
  const webhookTone: Tone = hookLoading ? "muted" : webhookConfigured ? "info" : "warn";

  async function saveWebhook() {
    setIsSavingWebhook(true);
    setHookMsg(null);
    try {
      await patchWebhookIntegration(webhookUrl.trim());
      await queryClient.invalidateQueries({ queryKey: ["integrations", "webhook"] });
      setHookMsg({ tone: "success", text: "Webhook saved." });
    } catch (e: unknown) {
      setHookMsg({ tone: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setIsSavingWebhook(false);
    }
  }

  async function testWebhook() {
    setIsTestingWebhook(true);
    setHookMsg(null);
    try {
      const result = await testWebhookIntegration();
      setHookMsg({ tone: "success", text: `Test sent. HTTP ${result.status}` });
    } catch (e: unknown) {
      setHookMsg({ tone: "error", text: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setIsTestingWebhook(false);
    }
  }

  return (
    <>
      <style jsx>{`
        .settings-root {
          min-height: 100vh;
          background: radial-gradient(circle at top, rgba(99,102,241,0.08), transparent 58%);
          color: #fff;
          font-family: "DM Sans", sans-serif;
        }
        .settings-shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 20px 92px;
        }
        .settings-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 24px;
          padding: 30px;
          margin-bottom: 18px;
          background:
            radial-gradient(circle at 86% -10%, rgba(99,102,241,0.28), transparent 35%),
            radial-gradient(circle at 6% 106%, rgba(16,185,129,0.18), transparent 33%),
            linear-gradient(135deg, rgba(99,102,241,0.15), rgba(255,255,255,0.035));
          box-shadow: 0 18px 54px rgba(0,0,0,0.26);
        }
        .hero-inner {
          position: relative;
          z-index: 1;
        }
        .hero-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 22px;
        }
        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #a5b4fc;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .settings-hero h1 {
          font-family: "Syne", sans-serif;
          font-size: 38px;
          line-height: 1.04;
          letter-spacing: -1.2px;
          margin: 0;
        }
        .hero-copy {
          color: rgba(255,255,255,0.68);
          max-width: 560px;
          font-size: 15px;
          line-height: 1.55;
          margin: 10px 0 0;
        }
        .hero-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }
        .settings-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 7px 13px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.7);
        }
        .settings-pill.good {
          border-color: rgba(16,185,129,0.24);
          background: rgba(16,185,129,0.12);
          color: #6ee7b7;
        }
        .settings-pill.warn {
          border-color: rgba(245,158,11,0.3);
          background: rgba(245,158,11,0.12);
          color: #fcd34d;
        }
        .settings-pill.info {
          border-color: rgba(99,102,241,0.3);
          background: rgba(99,102,241,0.14);
          color: #c4b5fd;
        }
        .settings-pill.bad {
          border-color: rgba(239,68,68,0.34);
          background: rgba(239,68,68,0.12);
          color: #fca5a5;
        }
        .settings-pill.muted {
          color: rgba(255,255,255,0.48);
        }
        .hero-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .settings-metric {
          min-height: 92px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(9,12,24,0.42);
          padding: 15px;
          position: relative;
          overflow: hidden;
        }
        .settings-metric::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 2px;
          background: rgba(255,255,255,0.1);
        }
        .settings-metric.good::before { background: linear-gradient(90deg, #10b981, #34d399); }
        .settings-metric.warn::before { background: linear-gradient(90deg, #f59e0b, #fcd34d); }
        .settings-metric.info::before { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
        .settings-metric.bad::before { background: linear-gradient(90deg, #ef4444, #f97316); }
        .metric-label {
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .metric-value {
          font-family: "Syne", sans-serif;
          font-size: 23px;
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1.1;
        }
        .metric-hint {
          color: rgba(255,255,255,0.42);
          font-size: 12px;
          line-height: 1.35;
          margin-top: 6px;
        }
        .notice {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          border-radius: 16px;
          margin-bottom: 26px;
          padding: 13px 16px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.035);
          color: rgba(255,255,255,0.68);
          font-size: 13px;
          line-height: 1.55;
        }
        .notice.good {
          border-color: rgba(16,185,129,0.2);
          background: rgba(16,185,129,0.07);
        }
        .notice.warn {
          border-color: rgba(99,102,241,0.28);
          background: rgba(99,102,241,0.09);
        }
        .notice strong {
          color: #fff;
        }
        .notice a {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #a5b4fc;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
        }
        .section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          margin: 0 0 18px;
        }
        .section-head h2 {
          font-family: "Syne", sans-serif;
          font-size: 23px;
          margin: 0 0 5px;
        }
        .section-head p {
          color: rgba(255,255,255,0.48);
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 30px;
        }
        .settings-card {
          position: relative;
          min-height: 205px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 21px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.075);
          background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.022));
          color: #fff;
          text-decoration: none;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }
        .settings-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), transparent);
          opacity: 0.8;
        }
        .settings-card::after {
          content: "";
          position: absolute;
          top: -70px;
          right: -70px;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--accent) 20%, transparent);
          opacity: 0.8;
        }
        .settings-card:hover {
          transform: translateY(-3px);
          border-color: color-mix(in srgb, var(--accent) 38%, rgba(255,255,255,0.12));
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.028));
        }
        .settings-card-top {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }
        .settings-card-icon {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          border: 1px solid color-mix(in srgb, var(--accent) 30%, rgba(255,255,255,0.08));
          background: color-mix(in srgb, var(--accent) 14%, transparent);
          color: color-mix(in srgb, var(--accent) 78%, white);
        }
        .settings-card-eyebrow {
          color: rgba(255,255,255,0.36);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }
        .settings-card h3 {
          position: relative;
          z-index: 1;
          font-family: "Syne", sans-serif;
          font-size: 20px;
          line-height: 1.1;
          margin: 0 0 9px;
        }
        .settings-card p {
          position: relative;
          z-index: 1;
          color: rgba(255,255,255,0.52);
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }
        .settings-card-cta {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: auto;
          color: color-mix(in srgb, var(--accent) 76%, white);
          font-size: 13px;
          font-weight: 800;
        }
        .settings-lower {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(290px, 0.85fr);
          gap: 18px;
        }
        .panel {
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.075);
          background: rgba(255,255,255,0.032);
          padding: 20px;
        }
        .integration-panel {
          padding: 18px;
          background:
            linear-gradient(135deg, rgba(99,102,241,0.06), rgba(255,255,255,0.025));
        }
        .panel-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }
        .panel h2 {
          font-family: "Syne", sans-serif;
          font-size: 23px;
          margin: 0 0 4px;
        }
        .panel p {
          color: rgba(255,255,255,0.48);
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }
        .panel-icon {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: rgba(99,102,241,0.13);
          border: 1px solid rgba(99,102,241,0.24);
          color: #a5b4fc;
          flex-shrink: 0;
        }
        .webhook-input-wrap {
          display: block;
          margin: 14px 0 16px;
        }
        .webhook-label {
          display: block;
          color: rgba(255,255,255,0.45);
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 7px;
        }
        .webhook-input {
          width: 100%;
          box-sizing: border-box;
          padding: 13px 14px;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.28);
          color: #fff;
          font-family: "DM Sans", sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.16s, background 0.16s;
        }
        .webhook-input:focus {
          border-color: rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.055);
        }
        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding-top: 2px;
        }
        .primary-btn,
        .ghost-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 9px 16px;
          border-radius: 11px;
          font-family: "DM Sans", sans-serif;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s, background 0.15s, border-color 0.15s;
        }
        .primary-btn {
          border: none;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          box-shadow: 0 12px 28px rgba(99,102,241,0.24);
        }
        .ghost-btn {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.86);
        }
        .primary-btn:hover:not(:disabled),
        .ghost-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .ghost-btn:hover:not(:disabled) {
          border-color: rgba(99,102,241,0.34);
          background: rgba(99,102,241,0.12);
          color: #fff;
        }
        .primary-btn:disabled,
        .ghost-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .feedback {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 14px;
          border-radius: 13px;
          padding: 12px 13px;
          font-size: 13px;
          line-height: 1.45;
        }
        .feedback.success {
          border: 1px solid rgba(16,185,129,0.28);
          background: rgba(16,185,129,0.1);
          color: #6ee7b7;
        }
        .feedback.error {
          border: 1px solid rgba(239,68,68,0.3);
          background: rgba(239,68,68,0.1);
          color: #fca5a5;
        }
        .readiness-list {
          display: grid;
          gap: 10px;
        }
        .readiness-item {
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.026);
          padding: 12px 13px;
        }
        .readiness-item-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 5px;
        }
        .readiness-title {
          color: rgba(255,255,255,0.86);
          font-size: 13px;
          font-weight: 800;
        }
        .readiness-copy {
          color: rgba(255,255,255,0.42);
          font-size: 12px;
          line-height: 1.4;
        }
        .spinner {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 1020px) {
          .settings-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .settings-lower {
            grid-template-columns: 1fr;
          }
        }
        /* ── auto-distribution panel ── */
        .autodist-panel {
          margin-bottom: 30px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.075);
          background: linear-gradient(135deg, rgba(6,182,212,0.055), rgba(255,255,255,0.025));
          overflow: hidden;
        }
        .autodist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 20px 22px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .autodist-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .autodist-icon {
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: rgba(6,182,212,0.13);
          border: 1px solid rgba(6,182,212,0.28);
          color: #67e8f9;
          flex-shrink: 0;
        }
        .autodist-header h2 {
          font-family: "Syne", sans-serif;
          font-size: 21px;
          margin: 0 0 3px;
        }
        .autodist-header p {
          color: rgba(255,255,255,0.48);
          font-size: 13px;
          margin: 0;
        }
        .autodist-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          border-radius: 11px;
          border: none;
          font-family: "DM Sans", sans-serif;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .autodist-toggle-btn.on {
          background: rgba(6,182,212,0.16);
          border: 1px solid rgba(6,182,212,0.3);
          color: #67e8f9;
        }
        .autodist-toggle-btn.off {
          background: rgba(255,255,255,0.055);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6);
        }
        .autodist-toggle-btn:hover {
          transform: translateY(-1px);
        }
        .autodist-body {
          padding: 20px 22px;
          display: grid;
          gap: 22px;
        }
        .autodist-section-label {
          display: block;
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .chip-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.62);
          transition: all 0.15s;
          user-select: none;
        }
        .chip.active {
          border-color: rgba(6,182,212,0.38);
          background: rgba(6,182,212,0.14);
          color: #67e8f9;
        }
        .chip:hover {
          border-color: rgba(6,182,212,0.28);
          color: rgba(255,255,255,0.88);
        }
        .autodist-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .autodist-field label {
          display: block;
          color: rgba(255,255,255,0.42);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 7px;
        }
        .autodist-field input {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 13px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.28);
          color: #fff;
          font-family: "DM Sans", sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.16s;
        }
        .autodist-field input:focus {
          border-color: rgba(6,182,212,0.4);
        }
        .autodist-field .field-hint {
          color: rgba(255,255,255,0.3);
          font-size: 11px;
          margin-top: 5px;
        }
        .excl-options {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .excl-option {
          padding: 12px 13px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          transition: all 0.16s;
          user-select: none;
        }
        .excl-option.selected {
          border-color: rgba(6,182,212,0.35);
          background: rgba(6,182,212,0.1);
        }
        .excl-option:hover {
          border-color: rgba(6,182,212,0.25);
        }
        .excl-option-label {
          font-size: 13px;
          font-weight: 800;
          color: rgba(255,255,255,0.86);
          margin-bottom: 4px;
        }
        .excl-option.selected .excl-option-label {
          color: #67e8f9;
        }
        .excl-option-hint {
          font-size: 11px;
          color: rgba(255,255,255,0.38);
          line-height: 1.4;
        }
        .autodist-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding: 14px 22px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.1);
        }
        .wallet-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.38);
        }
        .wallet-hint strong {
          color: rgba(255,255,255,0.6);
        }
        @media (max-width: 760px) {
          .settings-shell {
            padding: 24px 16px 80px;
          }
          .settings-hero {
            padding: 22px;
          }
          .hero-top {
            flex-direction: column;
          }
          .hero-actions {
            align-items: flex-start;
          }
          .hero-metrics,
          .settings-grid {
            grid-template-columns: 1fr;
          }
          .settings-hero h1 {
            font-size: 32px;
          }
          .notice,
          .section-head {
            align-items: flex-start;
            flex-direction: column;
          }
          .settings-card {
            min-height: 200px;
          }
          .autodist-fields,
          .excl-options {
            grid-template-columns: 1fr;
          }
          .autodist-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="settings-root">
        <main className="settings-shell">
          <section className="settings-hero">
            <div className="hero-inner">
              <div className="hero-top">
                <div>
                  <div className="eyebrow">
                    <Sparkles size={13} strokeWidth={2} aria-hidden />
                    Settings Hub
                  </div>
                  <h1>Control center for your account</h1>
                  <p className="hero-copy">
                    Manage billing, wallet, distribution, alerts, and webhook delivery in one place.
                  </p>
                </div>
                <div className="hero-actions">
                  <StatusPill tone={planTone}>
                    {hasActiveSubscription ? (
                      <CheckCircle2 size={13} strokeWidth={2.2} aria-hidden />
                    ) : subLoading ? (
                      <Loader2 className="spinner" size={13} strokeWidth={2.2} aria-hidden />
                    ) : (
                      <XCircle size={13} strokeWidth={2.2} aria-hidden />
                    )}
                    {subLoading ? "Checking plan..." : hasActiveSubscription ? "Plan active" : "Plan needed"}
                  </StatusPill>
                  <StatusPill tone={webhookTone}>
                    <PlugZap size={13} strokeWidth={2.2} aria-hidden />
                    {webhookStatus}
                  </StatusPill>
                </div>
              </div>

              <div className="hero-metrics">
                <MetricCard label="Plan" value={planLabel} hint={hasActiveSubscription ? "Active subscription" : "Billing status"} tone={planTone} />
                <MetricCard label="Plan" value={hasActiveSubscription ? "Pro" : "Free"} hint={hasActiveSubscription ? "Pro entitlements active" : "Upgrade for 10% off leads"} tone={hasActiveSubscription ? "info" : "warn"} />
                <MetricCard
                  label="Webhook"
                  value={webhookConfigured ? "Configured" : hookLoading ? "Checking..." : "Not set"}
                  hint={webhookConfigured ? "Delivery URL saved" : "Optional delivery URL"}
                  tone={webhookTone}
                />
              </div>
            </div>
          </section>

          <div className={`notice ${hasActiveSubscription ? "good" : "warn"}`}>
            <div>
              {subLoading ? (
                <span>Checking your subscription status.</span>
              ) : hasActiveSubscription ? (
                <>
                  <strong>Pro</strong> is active — you receive 10% off all lead purchases, 60-minute early access, and priority notifications.
                </>
              ) : (
                <>
                  <strong>Free plan.</strong> Upgrade to Pro to unlock 10% off every lead, early access, and priority alerts.
                </>
              )}
            </div>
            {!subLoading && !hasActiveSubscription ? (
              <Link href="/subscriptions">
                Compare plans
                <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
          </div>

          <section>
            <div className="section-head">
              <div>
                <h2>Account controls</h2>
                <p>Quick access to the main account areas.</p>
              </div>
              <StatusPill tone="info">
                <ShieldCheck size={13} strokeWidth={2.2} aria-hidden />
                4 areas
              </StatusPill>
            </div>

            <div className="settings-grid">
              {SETTINGS_AREAS.map((item) => (
                <SettingsCard key={item.href} item={item} />
              ))}
            </div>
          </section>

          {/* ── Inline auto-distribution control ── */}
          <section className="autodist-panel">
            <div className="autodist-header">
              <div className="autodist-header-left">
                <span className="autodist-icon">
                  <Zap size={19} strokeWidth={2} aria-hidden />
                </span>
                <div>
                  <h2>Auto-distribution</h2>
                  <p>Automatically buy matching leads when your wallet has sufficient funds.</p>
                </div>
              </div>
              <button
                type="button"
                className={`autodist-toggle-btn ${distEnabled ? "on" : "off"}`}
                onClick={() => setDistEnabled((v) => !v)}
                disabled={distLoading}
              >
                {distLoading ? (
                  <Loader2 size={15} className="spinner" strokeWidth={2.2} aria-hidden />
                ) : distEnabled ? (
                  <ToggleRight size={17} strokeWidth={2} aria-hidden />
                ) : (
                  <ToggleLeft size={17} strokeWidth={2} aria-hidden />
                )}
                {distLoading ? "Loading..." : distEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            <div className="autodist-body">
              {/* Markets */}
              <div>
                <span className="autodist-section-label">Markets</span>
                <div className="chip-group">
                  {MARKET_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`chip ${distMarkets.includes(m) ? "active" : ""}`}
                      onClick={() => toggleMarket(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lead types */}
              <div>
                <span className="autodist-section-label">Lead types</span>
                <div className="chip-group">
                  {LEAD_TYPE_OPTIONS.map((lt) => (
                    <button
                      key={lt.value}
                      type="button"
                      className={`chip ${distLeadTypes.includes(lt.value) ? "active" : ""}`}
                      onClick={() => toggleLeadType(lt.value)}
                    >
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price / wallet fields */}
              <div className="autodist-fields">
                <div className="autodist-field">
                  <label htmlFor="dist-min-wallet">Min wallet balance ($)</label>
                  <input
                    id="dist-min-wallet"
                    type="number"
                    min="0"
                    step="1"
                    value={distMinWallet}
                    onChange={(e) => setDistMinWallet(e.target.value)}
                    placeholder="e.g. 50"
                  />
                  <div className="field-hint">Keep this much in your wallet before auto-buying.</div>
                </div>
                <div className="autodist-field">
                  <label htmlFor="dist-max-price">Max lead price ($)</label>
                  <input
                    id="dist-max-price"
                    type="number"
                    min="0"
                    step="1"
                    value={distMaxPrice}
                    onChange={(e) => setDistMaxPrice(e.target.value)}
                    placeholder="e.g. 150"
                  />
                  <div className="field-hint">Skip leads priced above this amount.</div>
                </div>
              </div>

              {/* Exclusivity preference */}
              <div>
                <span className="autodist-section-label">Exclusivity preference</span>
                <div className="excl-options">
                  {EXCLUSIVITY_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      role="button"
                      tabIndex={0}
                      className={`excl-option ${distExclusivity === opt.value ? "selected" : ""}`}
                      onClick={() => setDistExclusivity(opt.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDistExclusivity(opt.value); }}
                    >
                      <div className="excl-option-label">{opt.label}</div>
                      <div className="excl-option-hint">{opt.hint}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="autodist-footer">
              <div className="wallet-hint">
                {walletBalanceDollars !== null ? (
                  <>Current wallet: <strong>${walletBalanceDollars}</strong></>
                ) : (
                  <span>Loading wallet balance…</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {distMsg ? (
                  <div className={`feedback ${distMsg.tone}`} style={{ margin: 0, padding: "8px 12px" }}>
                    {distMsg.tone === "success" ? (
                      <CheckCircle2 size={15} strokeWidth={2.2} aria-hidden />
                    ) : (
                      <XCircle size={15} strokeWidth={2.2} aria-hidden />
                    )}
                    <span>{distMsg.text}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="primary-btn"
                  style={{ background: "linear-gradient(135deg,#0891b2,#06b6d4)", boxShadow: "0 10px 24px rgba(6,182,212,0.22)" }}
                  onClick={saveDistribution}
                  disabled={distMutation.isPending}
                >
                  {distMutation.isPending ? (
                    <Loader2 size={14} className="spinner" strokeWidth={2.2} aria-hidden />
                  ) : null}
                  {distMutation.isPending ? "Saving…" : "Save preferences"}
                </button>
              </div>
            </div>
          </section>

          <div className="settings-lower">
            <section className="panel integration-panel">
              <div className="panel-title-row">
                <div>
                  <h2>Integrations</h2>
                  <p>
                    Send lead and wallet events to your CRM or webhook.
                  </p>
                </div>
                <span className="panel-icon">
                  <PlugZap size={20} strokeWidth={1.8} aria-hidden />
                </span>
              </div>

              <label className="webhook-input-wrap">
                <span className="webhook-label">Webhook endpoint</span>
                <input
                  className="webhook-input"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>

              <div className="button-row">
                <button className="primary-btn" type="button" onClick={() => void saveWebhook()} disabled={isSavingWebhook}>
                  {isSavingWebhook ? <Loader2 className="spinner" size={15} strokeWidth={2.2} aria-hidden /> : null}
                  {isSavingWebhook ? "Saving..." : "Save webhook"}
                </button>
                <button className="ghost-btn" type="button" onClick={() => void testWebhook()} disabled={isTestingWebhook}>
                  {isTestingWebhook ? <Loader2 className="spinner" size={15} strokeWidth={2.2} aria-hidden /> : null}
                  {isTestingWebhook ? "Testing..." : "Test webhook"}
                </button>
              </div>

              {hookMsg ? (
                <div className={`feedback ${hookMsg.tone}`}>
                  {hookMsg.tone === "success" ? (
                    <CheckCircle2 size={17} strokeWidth={2.2} aria-hidden />
                  ) : (
                    <XCircle size={17} strokeWidth={2.2} aria-hidden />
                  )}
                  <span>{hookMsg.text}</span>
                </div>
              ) : null}
            </section>

            <aside className="panel">
              <div className="panel-title-row">
                <div>
                  <h2>Readiness</h2>
                  <p>Current setup at a glance.</p>
                </div>
              </div>

              <div className="readiness-list">
                <div className="readiness-item">
                  <div className="readiness-item-top">
                    <span className="readiness-title">Subscription</span>
                    <StatusPill tone={planTone}>{subLoading ? "Checking" : hasActiveSubscription ? "Active" : "Missing"}</StatusPill>
                  </div>
                  <div className="readiness-copy">
                    {hasActiveSubscription
                      ? "Pro entitlements are active (10% off, early access)."
                      : "Upgrade to Pro to unlock discounts and early access."}
                  </div>
                </div>

                <div className="readiness-item">
                  <div className="readiness-item-top">
                    <span className="readiness-title">Webhook delivery</span>
                    <StatusPill tone={webhookTone}>{webhookConfigured ? "Configured" : hookLoading ? "Checking" : "Needed"}</StatusPill>
                  </div>
                  <div className="readiness-copy">
                    {webhookConfigured
                      ? "Destination URL is saved."
                      : "Add an endpoint when you need CRM delivery."}
                  </div>
                </div>

                <div className="readiness-item">
                  <div className="readiness-item-top">
                    <span className="readiness-title">Distribution</span>
                    <StatusPill tone="info">Configurable</StatusPill>
                  </div>
                  <div className="readiness-copy">
                    Filters, caps, and reserves live in Distribution rules.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}
