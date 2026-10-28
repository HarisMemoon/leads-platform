"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  PlugZap,
  Radio,
  Settings2,
  ShieldCheck,
  Target,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import {
  getWebhookIntegration,
  patchWebhookIntegration,
  testWebhookIntegration,
} from "@/lib/integrations-api";
import { queryKeys } from "@/lib/query-keys";
import {
  getMySubscription,
  getSubscriptionPricing,
} from "@/lib/subscriptions-api";
import {
  getBuyerPricingRulesMe,
  getDistributionMe,
  type ExclusivityPreference,
} from "@/lib/distribution-api";
import {
  getWalletMe,
  getPaymentMethodPreview,
  centsToNumber,
} from "@/lib/wallet-api";
import { getMarketAlertsMe } from "@/lib/market-alerts-api";

const EXCLUSIVITY_OPTIONS: {
  value: ExclusivityPreference;
  label: string;
  desc: string;
}[] = [
  {
    value: "exclusive_only",
    label: "Exclusive",
    desc: "Sole buyer on each lead",
  },
  {
    value: "non_exclusive_only",
    label: "Non Exclusive",
    desc: "Up to 3 buyers at lower price",
  },
  { value: "both", label: "Either", desc: "Auto-buy whichever qualifies" },
];

const PRO_BULLETS = [
  "Shared inbound leads at $30/buyer (up to 5 buyers per lead)",
  "Shared outbound leads at $20/buyer (up to 3 buyers per lead)",
  "Early access — see new leads 60 min before non-subscribers",
  "Cancel anytime via billing portal",
];

const FREE_BULLETS = [
  "Browse the full lead marketplace",
  "Buy leads manually at standard prices",
  "No monthly commitment required",
];

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // ── webhook state ────────────────────────────────────────────────
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hookMsg, setHookMsg] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // ── queries ──────────────────────────────────────────────────────
  const { data: pricing } = useQuery({
    queryKey: ["subscriptions", "pricing"],
    queryFn: getSubscriptionPricing,
    staleTime: 5 * 60 * 1000,
  });
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
  const { data: paymentMethod } = useQuery({
    queryKey: ["stripe", "payment-method-preview"],
    queryFn: getPaymentMethodPreview,
  });
  const { data: distRule, isLoading: distLoading } = useQuery({
    queryKey: queryKeys.distribution.me,
    queryFn: getDistributionMe,
  });
  const { data: pricingRules = [], isLoading: pricingRulesLoading } = useQuery({
    queryKey: queryKeys.distribution.pricingRules,
    queryFn: getBuyerPricingRulesMe,
  });
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["market-alerts", "me"],
    queryFn: getMarketAlertsMe,
  });

  async function saveWebhook() {
    setIsSavingWebhook(true);
    setHookMsg(null);
    try {
      await patchWebhookIntegration(webhookUrl.trim());
      await queryClient.invalidateQueries({
        queryKey: ["integrations", "webhook"],
      });
      setHookMsg({ tone: "success", text: "Webhook saved." });
    } catch (e: unknown) {
      setHookMsg({
        tone: "error",
        text: e instanceof Error ? e.message : "Save failed",
      });
    } finally {
      setIsSavingWebhook(false);
    }
  }
  async function testWebhook() {
    setIsTestingWebhook(true);
    setHookMsg(null);
    try {
      const result = await testWebhookIntegration();
      setHookMsg({
        tone: "success",
        text: `Test sent — HTTP ${result.status}`,
      });
    } catch (e: unknown) {
      setHookMsg({
        tone: "error",
        text: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setIsTestingWebhook(false);
    }
  }

  if (hook?.webhook_url != null && webhookUrl !== hook.webhook_url) {
    setWebhookUrl(hook.webhook_url);
  }

  // ── derived values ────────────────────────────────────────────────
  const walletBalance = wallet
    ? (centsToNumber(wallet.balance_cents) / 100).toFixed(2)
    : null;
  const isPro = sub?.status === "active";
  const autoDeliveryOn = Boolean(
    distRule?.participation_enabled && distRule?.is_active,
  );
  const distributionMarkets = distRule?.market_filters ?? [];
  const distributionLeadTypes = distRule?.lead_type_filters ?? [];
  const distributionExclusivity = EXCLUSIVITY_OPTIONS.find(
    (opt) => opt.value === (distRule?.exclusivity_preference ?? "both"),
  );
  const distributionMinWallet = distRule?.min_wallet_balance_cents
    ? `$${Math.round(Number(distRule.min_wallet_balance_cents) / 100)}`
    : "$0";
  const distributionMaxLeadPrice = distRule?.max_lead_price_cents
    ? `$${Math.round(Number(distRule.max_lead_price_cents) / 100)}`
    : "No limit";
  const distributionCooldown = distRule?.cooldown_minutes ?? 0;
  const distributionDailyCap = distRule?.max_leads_per_day ?? null;
  const distributionWeeklyCap = distRule?.max_leads_per_week ?? null;
  const distributionMonthlyCap = distRule?.max_leads_per_month ?? null;
  const distributionSummaryCards = [
    {
      label: "Status",
      value: distLoading ? "Loading…" : autoDeliveryOn ? "Enabled" : "Paused",
      sub: autoDeliveryOn
        ? "Automation is currently live."
        : "Automation is currently paused.",
    },
    {
      label: "Markets",
      value: distLoading
        ? "Loading…"
        : distributionMarkets.length > 0
          ? `${distributionMarkets.length} selected`
          : "All markets",
      sub:
        distributionMarkets.length > 0
          ? distributionMarkets.slice(0, 2).join(" • ")
          : "No market restriction",
    },
    {
      label: "Lead types",
      value: distLoading
        ? "Loading…"
        : distributionLeadTypes.length > 0
          ? `${distributionLeadTypes.length} selected`
          : "All lead types",
      sub:
        distributionLeadTypes.length > 0
          ? distributionLeadTypes.slice(0, 2).join(" • ")
          : "No lead-type restriction",
    },
    {
      label: "Purchase type",
      value: distLoading
        ? "Loading…"
        : (distributionExclusivity?.label ?? "Either"),
      sub: distributionExclusivity?.desc ?? "Auto-buy whichever qualifies",
    },
    {
      label: "Minimum wallet",
      value: distLoading ? "Loading…" : distributionMinWallet,
      sub: "Reserve required before buying",
    },
    {
      label: "Max lead price",
      value: distLoading ? "Loading…" : distributionMaxLeadPrice,
      sub: "Per-lead cap from full settings",
    },
    {
      label: "Cooldown",
      value: distLoading
        ? "Loading…"
        : distributionCooldown > 0
          ? `${distributionCooldown} min`
          : "Off",
      sub:
        distributionCooldown > 0
          ? "Gap between purchases"
          : "No cooldown applied",
    },
    {
      label: "Lead caps",
      value: distLoading
        ? "Loading…"
        : [
            distributionDailyCap ? `${distributionDailyCap}/day` : null,
            distributionWeeklyCap ? `${distributionWeeklyCap}/week` : null,
            distributionMonthlyCap ? `${distributionMonthlyCap}/month` : null,
          ]
            .filter(Boolean)
            .join(" • ") || "No caps",
      sub: "Saved limit controls",
    },
  ];
  const hasSavedPingPostSettings = pricingRules.length > 0;
  const pingPostEnabled = autoDeliveryOn && hasSavedPingPostSettings;
  const pingPostReadyToSave = autoDeliveryOn && !hasSavedPingPostSettings;
  const crmConnected = Boolean(hook?.webhook_url);
  const card = paymentMethod?.paymentMethod ?? null;
  const activeAlerts = alerts?.filter((a) => a.is_active) ?? [];
  const hasEmailAlert = activeAlerts.some((a) =>
    a.delivery_channels.includes("email"),
  );
  const hasSmsAlert = activeAlerts.some((a) =>
    a.delivery_channels.includes("sms"),
  );
  const renewalDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      <style jsx>{`
        .page {
          min-height: 100vh;
          color: #fff;
          font-family: "Inter", sans-serif;
        }
        .shell {
          max-width: 920px;
          margin: 0 auto;
          padding: 44px 24px 100px;
        }

        /* ── Page Header (Marketplace Style) ── */
        .page-header {
          margin-bottom: 36px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .page-header-content {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .page-header-title {
          font-family: "Manrope", sans-serif;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin: 0;
          background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .page-header-sub {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .page-header-desc {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          font-weight: 500;
          line-height: 1.5;
        }

        /* ── Status Pills & Badges ── */
        .header-chips {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        /* Plan Badge */
        .plan-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .plan-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .plan-pill.pro {
          color: #6ee7b7;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.22);
        }

        .plan-pill.pro .plan-dot {
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
        }

        .plan-pill.free {
          color: #fcd34d;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.22);
        }

        .plan-pill.free .plan-dot {
          background: #f59e0b;
        }

        /* Wallet Badge */
        .wallet-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          white-space: nowrap;
          font-family: var(--font-mono, monospace);
          letter-spacing: -0.01em;
        }

        .wallet-pill svg {
          color: rgba(255, 255, 255, 0.45);
        }
        /* ── Upgrade banner ── */
        .upgrade-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 20px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: color-mix(
            in srgb,
            var(--c) 8%,
            rgba(255, 255, 255, 0.02)
          );
          color: rgba(255, 255, 255, 0.72);
          font-size: 13.5px;
          line-height: 1.55;
          margin-bottom: 30px;
        }
        .upgrade-banner strong {
          color: #fff;
        }
        .upgrade-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #c4b5fd;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          transition: color 0.14s;
        }
        .upgrade-link:hover {
          color: #a78bfa;
        }

        /* ── Feature section (shared) ── */
        .fs {
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.072);
          background: rgba(255, 255, 255, 0.025);
          overflow: hidden;
          margin-bottom: 20px;
          position: relative;
        }
        .fs::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--c) 70%, transparent),
            transparent 60%
          );
        }
        .fs-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 26px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: color-mix(in srgb, var(--c) 3%, transparent);
        }
        .fs-head-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .fs-icon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: color-mix(in srgb, var(--c) 12%, transparent);
          border: 1px solid
            color-mix(in srgb, var(--c) 28%, rgba(255, 255, 255, 0.06));
          color: color-mix(in srgb, var(--c) 80%, white);
          flex-shrink: 0;
        }
        .fs-title {
          font-family: "Manrope", sans-serif;
          font-size: 17px;
          font-weight: 700;
          margin: 0 0 3px;
          color: #fff;
        }
        .fs-desc {
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
          margin: 0;
          line-height: 1.4;
        }
        .fs-body {
          padding: 24px 26px;
        }
        /* Card wrapper anchor */
        .fs-card-link {
          display: block;
          text-decoration: none;
          color: inherit;
        }

        /* Arrow badge button */
        .fs-arrow-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          flex-shrink: 0;
          background: color-mix(
            in srgb,
            var(--c) 12%,
            rgba(255, 255, 255, 0.04)
          );
          border: 1px solid
            color-mix(in srgb, var(--c) 26%, rgba(255, 255, 255, 0.08));
          color: color-mix(in srgb, var(--c) 80%, white);
          transition:
            transform 0.15s ease,
            background 0.15s ease;
        }

        .fs-card-link:hover .fs-arrow-btn {
          background: color-mix(
            in srgb,
            var(--c) 18%,
            rgba(255, 255, 255, 0.06)
          );
          transform: translateX(2px);
        }
        /* ── Link / action button ── */
        .fs-link-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: max-content;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 10px;
          font-family: "Inter", sans-serif;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          background: color-mix(
            in srgb,
            var(--c) 12%,
            rgba(255, 255, 255, 0.04)
          );
          border: 1px solid
            color-mix(in srgb, var(--c) 26%, rgba(255, 255, 255, 0.08));
          color: color-mix(in srgb, var(--c) 80%, white);
          transition: all 0.15s;
        }
        .fs-link-btn svg {
          display: block; /* Prevents vertical alignment issues with SVGs */
        }
        .fs-link-btn:hover {
          background: color-mix(
            in srgb,
            var(--c) 18%,
            rgba(255, 255, 255, 0.06)
          );
          transform: translateY(-1px);
        }
        .fs-link-div {
          display: flex;
          gap: 10px;
          justifycontent: center;
          alignitems: center;
        }
        /* ── Stat grid ── */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .stat-box {
          padding: 16px 18px;
          border-radius: 14px;
          background: color-mix(
            in srgb,
            var(--c) 5%,
            rgba(255, 255, 255, 0.02)
          );
          border: 1px solid
            color-mix(in srgb, var(--c) 14%, rgba(255, 255, 255, 0.06));
        }
        .stat-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.38);
          margin-bottom: 8px;
          letter-spacing: 0.03em;
        }
        .stat-value {
          font-family: "Manrope", sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1;
          margin-bottom: 6px;
          color: #fff;
        }
        .stat-value.val-accent {
          color: color-mix(in srgb, var(--c) 78%, white);
        }
        .stat-value.val-muted {
          color: rgba(255, 255, 255, 0.3);
          font-size: 18px;
        }
        .stat-sub {
          font-size: 11.5px;
          color: rgba(255, 255, 255, 0.3);
          line-height: 1.4;
        }

        /* ── Billing plan card ── */
        .plan-card {
          border-radius: 16px;
          border: 1px solid
            color-mix(in srgb, var(--c) 18%, rgba(255, 255, 255, 0.07));
          background: color-mix(
            in srgb,
            var(--c) 5%,
            rgba(255, 255, 255, 0.02)
          );
          padding: 20px 22px;
        }
        .plan-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .plan-name-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .plan-badge {
          font-family: "Manrope", sans-serif;
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -0.3px;
          color: #fff;
        }
        .plan-check {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.14);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #6ee7b7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .plan-renews {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
        }
        .plan-bullets {
          list-style: none;
          padding: 0;
          margin: 0 0 16px;
          display: grid;
          gap: 9px;
        }
        .plan-bullets li {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13.5px;
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.4;
        }
        .plan-bullets li .bicon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .bicon-yes {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.24);
          color: #6ee7b7;
        }
        .bicon-no {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.09);
          color: rgba(255, 255, 255, 0.2);
        }
        .plan-bullets li.muted-bullet {
          color: rgba(255, 255, 255, 0.35);
        }
        .plan-divider {
          border: none;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          margin: 14px 0;
        }
        .plan-unlock-label {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.3);
          letter-spacing: 0.06em;
          margin-bottom: 10px;
        }
        .upgrade-plan-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 11px 22px;
          border-radius: 11px;
          border: none;
          font-family: "Inter", sans-serif;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: #fff;
          box-shadow: 0 6px 20px rgba(139, 92, 246, 0.28);
          transition:
            opacity 0.14s,
            transform 0.14s;
        }
        .upgrade-plan-btn:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }

        /* ── Alerts section specifics ── */
        .alerts-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 32px 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.38);
          font-size: 14px;
        }
        .alerts-empty-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 10px;
          border: 1px solid rgba(245, 158, 11, 0.24);
          background: rgba(245, 158, 11, 0.08);
          color: #fcd34d;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.14s;
        }
        .alerts-empty-link:hover {
          background: rgba(245, 158, 11, 0.14);
        }

        /* ── CRM status badge ── */
        .crm-badge {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
        }
        .crm-on {
          color: #6ee7b7;
        }
        .crm-off {
          color: rgba(255, 255, 255, 0.4);
        }

        /* ── Dot indicators ── */
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot-green {
          background: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
        }
        .dot-amber {
          background: #f59e0b;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
        }
        .dot-muted {
          background: rgba(255, 255, 255, 0.18);
        }

        /* ── Field groups (auto-buy form) ── */
        .field-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.82);
          margin-bottom: 4px;
        }
        .field-desc {
          color: rgba(255, 255, 255, 0.36);
          font-size: 12.5px;
          margin: 0 0 13px;
          line-height: 1.55;
        }

        /* ── Chips ── */
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 13px;
          border-radius: 999px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.034);
          color: rgba(255, 255, 255, 0.52);
          transition: all 0.12s;
          user-select: none;
        }
        .chip.on {
          border-color: rgba(6, 182, 212, 0.36);
          background: rgba(6, 182, 212, 0.1);
          color: #67e8f9;
        }
        .chip:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.16);
          color: rgba(255, 255, 255, 0.82);
        }
        .chip:disabled {
          cursor: default;
        }

        /* ── Two-col ── */
        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        /* ── Inputs ── */
        .input-field label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.62);
          margin-bottom: 8px;
        }
        .prefixed {
          display: flex;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.22);
          overflow: hidden;
          transition:
            border-color 0.15s,
            background 0.15s;
        }
        .prefixed:focus-within {
          border-color: rgba(6, 182, 212, 0.36);
          background: rgba(6, 182, 212, 0.04);
        }
        .pfx {
          padding: 0 4px 0 14px;
          color: rgba(255, 255, 255, 0.3);
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .prefixed input {
          flex: 1;
          padding: 12px 14px;
          background: none;
          border: none;
          outline: none;
          color: #fff;
          font-family: "Inter", sans-serif;
          font-size: 14px;
        }
        .url-input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 15px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.22);
          color: #fff;
          font-family: "Inter", sans-serif;
          font-size: 14px;
          outline: none;
          transition:
            border-color 0.15s,
            background 0.15s;
        }
        .url-input:focus {
          border-color: rgba(99, 102, 241, 0.36);
          background: rgba(99, 102, 241, 0.04);
        }
        .field-hint {
          display: block;
          color: rgba(255, 255, 255, 0.28);
          font-size: 11.5px;
          margin-top: 6px;
          line-height: 1.4;
        }

        /* ── Exclusivity picker ── */
        .excl-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .excl-btn {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 14px 15px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.022);
          cursor: pointer;
          text-align: left;
          color: #fff;
          transition: all 0.14s;
          width: 100%;
        }
        .excl-btn.sel {
          border-color: rgba(6, 182, 212, 0.32);
          background: rgba(6, 182, 212, 0.09);
        }
        .excl-btn:hover:not(:disabled):not(.sel) {
          border-color: rgba(255, 255, 255, 0.13);
          background: rgba(255, 255, 255, 0.038);
        }
        .excl-btn:disabled {
          cursor: default;
        }
        .excl-circle {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
          transition: all 0.13s;
        }
        .excl-btn.sel .excl-circle {
          border-color: #06b6d4;
          background: rgba(6, 182, 212, 0.18);
          color: #67e8f9;
        }
        .excl-l {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.82);
          margin-bottom: 3px;
        }
        .excl-btn.sel .excl-l {
          color: #67e8f9;
        }
        .excl-d {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.34);
          line-height: 1.4;
        }

        /* ── Section footer ── */
        .sec-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding: 15px 26px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(0, 0, 0, 0.07);
        }
        .foot-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
        }
        .foot-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* ── Buttons ── */
        .primary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 10px 22px;
          border-radius: 11px;
          border: none;
          font-family: "Inter", sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          box-shadow: 0 6px 18px rgba(99, 102, 241, 0.2);
          transition:
            opacity 0.13s,
            transform 0.13s;
        }
        .primary-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          opacity: 0.9;
        }
        .primary-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ghost-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 10px 22px;
          border-radius: 11px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          font-family: "Inter", sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.68);
          transition: all 0.13s;
        }
        .ghost-btn:hover:not(:disabled) {
          border-color: rgba(99, 102, 241, 0.3);
          background: rgba(99, 102, 241, 0.08);
          color: #fff;
          transform: translateY(-1px);
        }
        .ghost-btn:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .btn-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* ── Save messages ── */
        .save-msg {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          padding: 7px 12px;
          border-radius: 9px;
        }
        .save-ok {
          background: rgba(16, 185, 129, 0.09);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #6ee7b7;
        }
        .save-err {
          background: rgba(239, 68, 68, 0.09);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }
        .feedback {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.45;
        }
        .feedback.ok {
          background: rgba(16, 185, 129, 0.09);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #6ee7b7;
        }
        .feedback.err {
          background: rgba(239, 68, 68, 0.09);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        /* ── Body grid for auto-buy ── */
        .dist-body {
          display: grid;
          gap: 26px;
        }

        /* ── Auto-buy status banner ── */
        .dist-status {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.45;
        }
        .dist-status.paused {
          background: rgba(245, 158, 11, 0.07);
          border: 1px solid rgba(245, 158, 11, 0.18);
          color: rgba(255, 255, 255, 0.55);
        }
        .dist-status.running {
          background: rgba(6, 182, 212, 0.07);
          border: 1px solid rgba(6, 182, 212, 0.2);
          color: rgba(255, 255, 255, 0.6);
        }
        .dist-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dist-status.running .dist-status-dot {
          background: #06b6d4;
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.18);
        }
        .dist-status.paused .dist-status-dot {
          background: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
        }

        /* ── Toggle switch ── */
        .toggle-switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
          font-size: 13px;
          font-weight: 600;
        }
        .toggle-track {
          width: 44px;
          height: 24px;
          border-radius: 999px;
          flex-shrink: 0;
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.06);
          transition:
            background 0.2s,
            border-color 0.2s;
          position: relative;
        }
        .toggle-track.on {
          background: rgba(6, 182, 212, 0.25);
          border-color: rgba(6, 182, 212, 0.4);
        }
        .toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.35);
          transition:
            transform 0.2s,
            background 0.2s;
        }
        .toggle-track.on .toggle-thumb {
          transform: translateX(20px);
          background: #67e8f9;
        }
        .toggle-label-off {
          color: rgba(255, 255, 255, 0.38);
        }
        .toggle-label-on {
          color: #67e8f9;
        }

        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ── Responsive ── */
        @media (max-width: 720px) {
          .shell {
            padding: 26px 16px 80px;
          }
          .page-header {
            flex-direction: column;
            gap: 12px;
          }
          .page-header h1 {
            font-size: 24px;
          }
          .stat-grid {
            grid-template-columns: 1fr;
          }
          .two-col {
            grid-template-columns: 1fr;
          }
          .excl-grid {
            grid-template-columns: 1fr;
          }
          .fs-head {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 18px 18px 16px;
          }
          .sec-foot {
            flex-direction: column;
            align-items: flex-start;
          }
          .fs-head {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 18px 18px 16px;
          }
          .page-header-title {
            font-size: 26px;
          }

          .page-header-sub {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
        }
      `}</style>

      <div className="page">
        <div className="shell">
          {/* ── Page header ── */}
          <header className="page-header">
            <div className="page-header-content">
              <h1 className="page-header-title">Account settings</h1>
              <div className="page-header-sub">
                <span className="page-header-desc">
                  Your wallet, plan, automation rules, and integrations.
                </span>

                <div className="header-chips">
                  {!subLoading && (
                    <span className={`plan-pill ${isPro ? "pro" : "free"}`}>
                      <span className="plan-dot" />
                      {isPro ? "Pro Plan" : "Free Plan"}
                    </span>
                  )}
                  <span className="wallet-pill">
                    <Wallet size={13} strokeWidth={2.2} />
                    {walletBalance !== null ? `$${walletBalance}` : "—"}
                  </span>
                </div>
              </div>
            </div>
          </header>
          {/* ── Upgrade nudge (free only) ── */}
          {!subLoading && !isPro && (
            <div
              className="upgrade-banner"
              style={{ "--c": "#d8c661" } as CSSProperties}
            >
              <span>
                <strong>
                  Subscribe for {pricing?.proDisplayPrice ?? "…"}/month
                </strong>
                — unlock shared lead pricing (
                {pricing
                  ? `$${Math.round(pricing.sharedInboundPriceCents / 100)} inbound / $${Math.round(pricing.sharedOutboundPriceCents / 100)} outbound`
                  : "…"}
                ), early access to new leads, and auto-buy distribution.
              </span>
              <div
                className="fs-link-div"
                style={{ "--c": "#d8c661" } as CSSProperties}
              >
                {/* <Link href="/subscriptions" className="fs-link-btn">
                  See full plans
                </Link> */}
                <Link href="/subscriptions" className="fs-card-link">
                  <div className="fs-arrow-btn" aria-hidden="true">
                    <ArrowRight size={18} strokeWidth={2} />
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              WALLET
          ══════════════════════════════════════════════ */}
          <section className="fs" style={{ "--c": "#10b981" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon">
                  <Wallet size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="fs-title">Wallet</div>
                  <p className="fs-desc">
                    Your spending balance for lead purchases
                  </p>
                </div>
              </div>
              {/* <Link href="/wallet" className="fs-link-btn">
                  Add funds
                </Link> */}
              <Link href="/wallet" className="fs-card-link">
                <div className="fs-arrow-btn" aria-hidden="true">
                  <ArrowRight size={18} strokeWidth={2} />
                </div>
              </Link>
            </div>
            <div className="fs-body">
              <div className="stat-grid">
                <div className="stat-box">
                  <div className="stat-label">Available balance</div>
                  <div className="stat-value val-accent">
                    {walletBalance !== null ? `$${walletBalance}` : "—"}
                  </div>
                  <div className="stat-sub">Ready to spend on leads</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Auto-reload</div>
                  <div
                    className={`stat-value ${wallet?.auto_reload_enabled ? "val-accent" : "val-muted"}`}
                  >
                    {wallet ? (wallet.auto_reload_enabled ? "On" : "Off") : "—"}
                  </div>
                  <div className="stat-sub">
                    {wallet?.auto_reload_enabled &&
                    wallet.auto_reload_threshold_cents
                      ? `Tops up when below $${(centsToNumber(wallet.auto_reload_threshold_cents) / 100).toFixed(0)}`
                      : "Configure on wallet page"}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Saved card</div>
                  <div
                    className="stat-value"
                    style={{ fontSize: 16, paddingTop: 4 }}
                  >
                    {card
                      ? `${card.brand.charAt(0).toUpperCase() + card.brand.slice(1)} ••${card.last4}`
                      : "None saved"}
                  </div>
                  <div className="stat-sub">
                    {card
                      ? `Expires ${card.exp_month}/${String(card.exp_year).slice(-2)}`
                      : "Add a card on the wallet page"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              BILLING
          ══════════════════════════════════════════════ */}
          <section className="fs" style={{ "--c": "#8b5cf6" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon">
                  <CreditCard size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="fs-title">Billing</div>
                  <p className="fs-desc">
                    Subscription plan and payment method
                  </p>
                </div>
              </div>

              <Link href="/subscriptions" className="fs-card-link">
                <div className="fs-arrow-btn" aria-hidden="true">
                  <ArrowRight size={18} strokeWidth={2} />
                </div>
              </Link>
            </div>
            <div className="fs-body">
              {subLoading ? (
                <div
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Loader2 size={15} className="spin" strokeWidth={2} />{" "}
                  Checking plan…
                </div>
              ) : (
                <div className="plan-card">
                  <div className="plan-top">
                    <div className="plan-name-row">
                      <span className="plan-badge">
                        {isPro ? "Pro Plan" : "Free Plan"}
                      </span>
                      {isPro && (
                        <span className="plan-check">
                          <Check size={12} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                    {isPro && renewalDate && (
                      <span className="plan-renews">Renews {renewalDate}</span>
                    )}
                  </div>

                  {isPro ? (
                    <ul className="plan-bullets">
                      {PRO_BULLETS.map((b) => (
                        <li key={b}>
                          <span className="bicon bicon-yes">
                            <Check size={10} strokeWidth={2.5} />
                          </span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      <ul className="plan-bullets">
                        {FREE_BULLETS.map((b) => (
                          <li key={b}>
                            <span className="bicon bicon-yes">
                              <Check size={10} strokeWidth={2.5} />
                            </span>
                            {b}
                          </li>
                        ))}
                      </ul>
                      <hr className="plan-divider" />
                      <div className="plan-unlock-label">Unlock with Pro</div>
                      <ul className="plan-bullets" style={{ marginBottom: 20 }}>
                        {PRO_BULLETS.map((b) => (
                          <li key={b} className="muted-bullet">
                            <span
                              className="bicon bicon-no"
                              style={{
                                fontSize: 14,
                                color: "rgba(255,255,255,0.15)",
                              }}
                            >
                              —
                            </span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              MARKET ALERTS
          ══════════════════════════════════════════════ */}
          <section className="fs" style={{ "--c": "#f59e0b" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon">
                  <Bell size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="fs-title">Market alerts</div>
                  <p className="fs-desc">
                    Get notified when matching leads become available
                  </p>
                </div>
              </div>

              <Link href="/market-alerts" className="fs-card-link">
                <div className="fs-arrow-btn" aria-hidden="true">
                  <ArrowRight size={18} strokeWidth={2} />
                </div>
              </Link>
            </div>
            <div className="fs-body">
              {alertsLoading ? (
                <div
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Loader2 size={15} className="spin" strokeWidth={2} />{" "}
                  Loading…
                </div>
              ) : activeAlerts.length === 0 ? (
                <div className="alerts-empty">
                  <Bell
                    size={28}
                    strokeWidth={1.4}
                    style={{ color: "rgba(245,158,11,0.35)" }}
                  />
                  <span>
                    No active alerts yet. Set up an alert to get notified when
                    matching leads arrive.
                  </span>
                  <Link href="/market-alerts" className="alerts-empty-link">
                    Create your first alert{" "}
                    <ArrowRight size={13} strokeWidth={2} />
                  </Link>
                </div>
              ) : (
                <div className="stat-grid">
                  <div className="stat-box">
                    <div className="stat-label">Active alerts</div>
                    <div className="stat-value val-accent">
                      {activeAlerts.length}
                    </div>
                    <div className="stat-sub">
                      {activeAlerts.length === 1
                        ? "1 filter set watching"
                        : `${activeAlerts.length} filter sets watching`}
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Email notifications</div>
                    <div
                      className={`stat-value ${hasEmailAlert ? "val-accent" : "val-muted"}`}
                    >
                      {hasEmailAlert ? "Active" : "Off"}
                    </div>
                    <div
                      className="stat-sub"
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Mail
                        size={11}
                        strokeWidth={2}
                        style={{ opacity: 0.5 }}
                      />
                      {hasEmailAlert
                        ? "At least one alert uses email"
                        : "Not configured"}
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">SMS notifications</div>
                    <div
                      className={`stat-value ${hasSmsAlert ? "val-accent" : "val-muted"}`}
                    >
                      {hasSmsAlert ? "Active" : "Off"}
                    </div>
                    <div
                      className="stat-sub"
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <MessageSquare
                        size={11}
                        strokeWidth={2}
                        style={{ opacity: 0.5 }}
                      />
                      {hasSmsAlert
                        ? "At least one alert uses SMS"
                        : "Not configured"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              AUTOMATION / AUTO-BUY
          ══════════════════════════════════════════════ */}

          <section className="fs" style={{ "--c": "#06b6d4" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon">
                  <Zap size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="fs-title">Auto-buy rules</div>
                  <p className="fs-desc">
                    {distLoading
                      ? "Loading…"
                      : autoDeliveryOn
                        ? "Review your current automation setup here, then use full settings to make changes."
                        : "Auto Purchase is paused. Review your current setup here, then open full settings to update it."}
                  </p>
                </div>
              </div>

              <Link href="/distribution" className="fs-card-link">
                <div className="fs-arrow-btn" aria-hidden="true">
                  <ArrowRight size={18} strokeWidth={2} />
                </div>
              </Link>
            </div>

            <div className="fs-body dist-body">
              <div
                className={`dist-status ${autoDeliveryOn ? "running" : "paused"}`}
              >
                <span className="dist-status-dot" />
                {autoDeliveryOn
                  ? "Auto Purchase is live. The snapshot below shows your currently saved rule."
                  : "Auto Purchase is paused. The snapshot below shows your currently saved rule until you update it in full settings."}
              </div>
              <div className="stat-grid">
                {distributionSummaryCards.map((item) => (
                  <div key={item.label} className="stat-box">
                    <div className="stat-label">{item.label}</div>
                    <div
                      className="stat-value val-accent"
                      style={{ fontSize: 18 }}
                    >
                      {item.value}
                    </div>
                    <div className="stat-sub">{item.sub}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  <Settings2 size={15} strokeWidth={2} color="#67e8f9" />
                  Current automation snapshot
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Open full settings to change markets, lead types, purchase
                  type, budget protection, cooldown, or caps. This card now
                  shows your current setup in a cleaner read-only view.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "rgba(6,182,212,0.08)",
                      border: "1px solid rgba(6,182,212,0.18)",
                      color: "#67e8f9",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck size={13} strokeWidth={2} />
                    Wallet reserve {distributionMinWallet}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "rgba(139,92,246,0.08)",
                      border: "1px solid rgba(139,92,246,0.18)",
                      color: "#c4b5fd",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Zap size={13} strokeWidth={2} />
                    {distributionExclusivity?.label ?? "Either"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              CRM INTEGRATION
          ══════════════════════════════════════════════ */}
          <section className="fs" style={{ "--c": "#d8c661" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon">
                  <PlugZap size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="fs-title">CRM integration</div>
                  <p className="fs-desc">
                    Deliver purchased leads automatically to your CRM or webhook
                  </p>
                </div>
              </div>
              <div
                className={`crm-badge ${crmConnected ? "crm-on" : "crm-off"}`}
              >
                <span
                  className={`dot ${crmConnected ? "dot-green" : "dot-amber"}`}
                />
                {hookLoading
                  ? "Checking…"
                  : crmConnected
                    ? "Connected"
                    : "Not connected"}
              </div>
            </div>
            <div className="fs-body" style={{ display: "grid", gap: 18 }}>
              <div>
                <label
                  htmlFor="webhook-url"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.62)",
                    marginBottom: 8,
                  }}
                >
                  Webhook URL
                </label>
                <input
                  id="webhook-url"
                  type="url"
                  className="url-input"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-crm.com/webhook/lead"
                />
                <span className="field-hint">
                  We&apos;ll POST lead data here every time a purchase
                  completes. Compatible with GoHighLevel and any HTTPS endpoint.
                </span>
              </div>
              <div className="btn-row">
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 18px",
                    borderRadius: 10,
                    background: "#d1ba47",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                  type="button"
                  onClick={() => void saveWebhook()}
                  disabled={isSavingWebhook}
                >
                  {isSavingWebhook && (
                    <Loader2 size={14} className="spin" strokeWidth={2} />
                  )}
                  {isSavingWebhook ? "Saving…" : "Save webhook"}
                </button>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => void testWebhook()}
                  disabled={isTestingWebhook || !webhookUrl.trim()}
                >
                  {isTestingWebhook && (
                    <Loader2 size={14} className="spin" strokeWidth={2} />
                  )}
                  {isTestingWebhook ? "Sending…" : "Send test lead"}
                </button>
              </div>
              {hookMsg && (
                <div
                  className={`feedback ${hookMsg.tone === "success" ? "ok" : "err"}`}
                >
                  {hookMsg.tone === "success" ? (
                    <CheckCircle2 size={15} strokeWidth={2} />
                  ) : (
                    <XCircle size={15} strokeWidth={2} />
                  )}
                  <span>{hookMsg.text}</span>
                </div>
              )}
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              PING / POST — REAL-TIME LEAD ACCESS
          ══════════════════════════════════════════════ */}
          <section className="fs" style={{ "--c": "#34d399" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon">
                  <Radio size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="fs-title">
                    Ping / Post — Real-Time Leads
                    {pingPostEnabled && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          verticalAlign: "middle",
                          background: "rgba(16,185,129,0.12)",
                          border: "1px solid rgba(16,185,129,0.25)",
                          color: "#34d399",
                          borderRadius: 20,
                          padding: "2px 8px",
                        }}
                      >
                        Active
                      </span>
                    )}
                    {pingPostReadyToSave && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          verticalAlign: "middle",
                          background: "rgba(245,158,11,0.12)",
                          border: "1px solid rgba(245,158,11,0.25)",
                          color: "#fbbf24",
                          borderRadius: 20,
                          padding: "2px 8px",
                        }}
                      >
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="fs-desc">
                    Get leads the moment they enter Newleey — before they ever
                    reach the marketplace
                  </p>
                </div>
              </div>
              {(pingPostEnabled || pingPostReadyToSave) && (
                <Link href="/distribution" className="fs-card-link">
                  <div className="fs-arrow-btn" aria-hidden="true">
                    <ArrowRight size={18} strokeWidth={2} />
                  </div>
                </Link>
              )}
            </div>

            <div className="fs-body">
              {!pingPostEnabled ? (
                /* Locked / marketing state */
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  <div
                    style={{
                      padding: "16px 18px",
                      borderRadius: 12,
                      background: "rgba(139,92,246,0.06)",
                      border: "1px solid rgba(139,92,246,0.18)",
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                    }}
                  >
                    <Lock
                      size={18}
                      color="#a78bfa"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#e9d5ff",
                          marginBottom: 6,
                        }}
                      >
                        {pingPostReadyToSave
                          ? "Save settings to enable Ping/Post"
                          : "Unlock Real-Time Lead Delivery"}
                      </div>
                      <p
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.55)",
                          lineHeight: 1.65,
                          margin: 0,
                        }}
                      >
                        {pingPostReadyToSave
                          ? "Auto Purchase is on, but Ping/Post stays paused until you save your first settings in Distribution. Once you save a pricing rule, real-time Ping/Post delivery can start."
                          : "Ping/Post gives you access to leads as they come in — live, in real time — before they hit the marketplace. Many ping/post leads are only available for seconds. If Auto Purchase is off, those leads go to other buyers and you&apos;ll never see them."}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {[
                      {
                        icon: <Zap size={16} strokeWidth={2} />,
                        title: "Instant delivery",
                        desc: "Leads arrive in your dashboard the moment they come in",
                      },
                      {
                        icon: <Wallet size={16} strokeWidth={2} />,
                        title: "Wallet deducted",
                        desc: "Each delivered lead deducts from your wallet automatically",
                      },
                      {
                        icon: <Lock size={16} strokeWidth={2} />,
                        title: "Exclusive first",
                        desc: "Real-time leads arrive before they ever hit the marketplace",
                      },
                    ].map(({ icon, title, desc }) => (
                      <div
                        key={title}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div
                          style={{
                            marginBottom: 8,
                            color: "rgba(139,92,246,0.8)",
                          }}
                        >
                          {icon}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#fff",
                            marginBottom: 4,
                          }}
                        >
                          {title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.4)",
                            lineHeight: 1.5,
                          }}
                        >
                          {desc}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Requirements checklist */}
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.4)",
                        marginBottom: 10,
                        textTransform: "",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Requirements to activate
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {[
                        {
                          done: autoDeliveryOn,
                          label: "Auto Purchase turned on",
                          cta: !autoDeliveryOn
                            ? { text: "Enable →", href: "/distribution" }
                            : null,
                        },
                        {
                          done: hasSavedPingPostSettings,
                          label: pricingRulesLoading
                            ? "Checking saved Ping/Post settings…"
                            : "Save settings to enable Ping/Post",
                          cta:
                            !hasSavedPingPostSettings && !pricingRulesLoading
                              ? {
                                  text: "Save settings →",
                                  href: "/distribution",
                                }
                              : null,
                        },
                      ].map(({ done, label, cta }) => (
                        <div
                          key={label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 13,
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                background: done
                                  ? "rgba(16,185,129,0.15)"
                                  : "rgba(255,255,255,0.06)",
                                border: `1px solid ${done ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.1)"}`,
                                fontSize: 10,
                                fontWeight: 700,
                                color: done
                                  ? "#34d399"
                                  : "rgba(255,255,255,0.3)",
                              }}
                            >
                              {done ? "✓" : "○"}
                            </span>
                            <span
                              style={{
                                color: done
                                  ? "rgba(255,255,255,0.8)"
                                  : "rgba(255,255,255,0.45)",
                              }}
                            >
                              {label}
                            </span>
                          </div>
                          {cta && (
                            <Link
                              href={cta.href}
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#a5b4fc",
                                textDecoration: "none",
                                background: "rgba(99,102,241,0.1)",
                                border: "1px solid rgba(99,102,241,0.25)",
                                borderRadius: 8,
                                padding: "3px 10px",
                              }}
                            >
                              {cta.text}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Enabled state — summary + manage link */
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "rgba(16,185,129,0.06)",
                      border: "1px solid rgba(16,185,129,0.18)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(16,185,129,0.15)",
                        border: "1px solid rgba(16,185,129,0.28)",
                        color: "#34d399",
                      }}
                    >
                      <Zap size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#6ee7b7",
                          marginBottom: 3,
                        }}
                      >
                        Ping / Post is active
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.5)",
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        You&apos;re receiving matching leads in real time. Each
                        lead deducts from your wallet automatically. Use the Bid
                        Rules in Distribution Settings to control which markets
                        and lead types you receive and how much you bid.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link
                      href="/distribution"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "9px 18px",
                        borderRadius: 10,
                        background: "#21b780",
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Manage Ping/Post Bid Rules <ArrowRight size={14} />
                    </Link>
                    {/* <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "9px 16px",
                        borderRadius: 10,
                        background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        fontSize: 12,
                        color: "#fbbf24",
                      }}
                    >
                      <AlertTriangle size={13} strokeWidth={2} />
                      Turning off Auto Purchase pauses real-time delivery
                    </div> */}
                  </div>
                </div>
              )}
            </div>
          </section>
          <section className="fs" style={{ "--c": "#6366f1" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon">
                  <BookOpen size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="fs-title">Resources &amp; guides</div>
                  <p className="fs-desc">
                    Browse guides, videos, and FAQs from the Newleey team
                  </p>
                </div>
              </div>
              <Link href="/resources" className="fs-card-link">
                <div className="fs-arrow-btn" aria-hidden="true">
                  <ArrowRight size={18} strokeWidth={2} />
                </div>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
