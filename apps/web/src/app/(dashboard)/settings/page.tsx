"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { getWebhookIntegration, patchWebhookIntegration, testWebhookIntegration } from "@/lib/integrations-api";
import { queryKeys } from "@/lib/query-keys";
import { getMySubscription } from "@/lib/subscriptions-api";

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
    desc: "Plan access, billing, and premium lead credits.",
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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hookMsg, setHookMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: getMySubscription,
  });

  const { data: hook, isLoading: hookLoading } = useQuery({
    queryKey: ["integrations", "webhook"],
    queryFn: getWebhookIntegration,
  });

  useEffect(() => {
    if (hook?.webhook_url != null) setWebhookUrl(hook.webhook_url);
  }, [hook?.webhook_url]);

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
                <MetricCard label="Premium leads" value={usageLabel} hint={usageHint} tone={hasActiveSubscription ? "info" : "warn"} />
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
                <span>Checking your subscription and monthly lead credit status.</span>
              ) : hasActiveSubscription ? (
                <>
                  <strong>{titleCase(sub.plan_type)}</strong> is active.
                  {sub.monthly_lead_limit != null ? (
                    <> You have used {sub.leads_used_this_period} of {sub.monthly_lead_limit} premium leads this period.</>
                  ) : null}
                  {" "}Monthly wallet credits are added after Stripe invoices are paid.
                </>
              ) : (
                <>
                  <strong>No active subscription.</strong> Choose a plan to unlock premium lead credits.
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
                      ? "Premium lead access is enabled."
                      : "Pick a plan to unlock credits."}
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
