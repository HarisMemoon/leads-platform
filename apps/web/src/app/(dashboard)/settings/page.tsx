"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  MessageSquare,
  PlugZap,
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
import { getMySubscription } from "@/lib/subscriptions-api";
import {
  getDistributionMe,
  patchDistributionMe,
  type ExclusivityPreference,
} from "@/lib/distribution-api";
import {
  getWalletMe,
  getPaymentMethodPreview,
  centsToNumber,
} from "@/lib/wallet-api";
import { getMarketAlertsMe } from "@/lib/market-alerts-api";

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

const EXCLUSIVITY_OPTIONS: { value: ExclusivityPreference; label: string; desc: string }[] = [
  { value: "exclusive", label: "Exclusive", desc: "Sole buyer on each lead" },
  { value: "non_exclusive", label: "Non Exclusive", desc: "Up to 3 buyers at lower price" },
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
  const [hookMsg, setHookMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // ── auto-distribution state ──────────────────────────────────────
  const [distEnabled, setDistEnabled] = useState(false);
  const [distMarkets, setDistMarkets] = useState<string[]>([]);
  const [distLeadTypes, setDistLeadTypes] = useState<string[]>([]);
  const [distMinWallet, setDistMinWallet] = useState("");
  const [distMaxPrice, setDistMaxPrice] = useState("");
  const [distExclusivity, setDistExclusivity] = useState<ExclusivityPreference>("both");
  const [distMsg, setDistMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // ── queries ──────────────────────────────────────────────────────
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
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["market-alerts", "me"],
    queryFn: getMarketAlertsMe,
  });

  // ── mutation ─────────────────────────────────────────────────────
  const distMutation = useMutation({
    mutationFn: patchDistributionMe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.distribution.me });
      setDistMsg({ tone: "success", text: "Saved." });
    },
    onError: (e: unknown) => {
      setDistMsg({ tone: "error", text: e instanceof Error ? e.message : "Save failed" });
    },
  });

  // ── effects ──────────────────────────────────────────────────────
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

  // ── handlers ─────────────────────────────────────────────────────
  function toggleMarket(m: string) {
    setDistMarkets(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);
  }
  function toggleLeadType(t: string) {
    setDistLeadTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  }
  function saveDistribution() {
    setDistMsg(null);
    distMutation.mutate({
      is_active: distEnabled,
      market_filters: distMarkets,
      lead_type_filters: distLeadTypes,
      min_wallet_balance_cents: distMinWallet ? Math.round(parseFloat(distMinWallet) * 100) : 0,
      max_lead_price_cents: distMaxPrice ? Math.round(parseFloat(distMaxPrice) * 100) : null,
      exclusivity_preference: distExclusivity,
    });
  }
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
      setHookMsg({ tone: "success", text: `Test sent — HTTP ${result.status}` });
    } catch (e: unknown) {
      setHookMsg({ tone: "error", text: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setIsTestingWebhook(false);
    }
  }

  // ── derived values ────────────────────────────────────────────────
  const walletBalance = wallet
    ? (centsToNumber(wallet.balance_cents) / 100).toFixed(2)
    : null;
  const isPro = sub?.status === "active";
  const crmConnected = Boolean(hook?.webhook_url);
  const card = paymentMethod?.paymentMethod ?? null;
  const activeAlerts = alerts?.filter(a => a.is_active) ?? [];
  const hasEmailAlert = activeAlerts.some(a => a.delivery_channels.includes("email"));
  const hasSmsAlert = activeAlerts.some(a => a.delivery_channels.includes("sms"));
  const renewalDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
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

        /* ── Page header ── */
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 36px;
        }
        .page-header h1 {
          font-family: "Manrope", sans-serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.6px;
          margin: 0 0 5px;
          line-height: 1.1;
        }
        .page-header-sub {
          color: rgba(255,255,255,0.42);
          font-size: 14px;
          margin: 0;
        }
        .header-chips {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          padding-top: 3px;
        }
        .chip-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .chip-pro   { background: rgba(16,185,129,0.1);  border: 1px solid rgba(16,185,129,0.22);  color: #6ee7b7; }
        .chip-free  { background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.22);  color: #fcd34d; }
        .chip-money { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); color: rgba(255,255,255,0.6); }

        /* ── Upgrade banner ── */
        .upgrade-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 20px;
          border-radius: 14px;
          border: 1px solid rgba(139,92,246,0.2);
          background: rgba(139,92,246,0.07);
          color: rgba(255,255,255,0.62);
          font-size: 13.5px;
          line-height: 1.55;
          margin-bottom: 30px;
        }
        .upgrade-banner strong { color: #e9d5ff; }
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
        .upgrade-link:hover { color: #a78bfa; }

        /* ── Feature section (shared) ── */
        .fs {
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.072);
          background: rgba(255,255,255,0.025);
          overflow: hidden;
          margin-bottom: 20px;
          position: relative;
        }
        .fs::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, color-mix(in srgb, var(--c) 70%, transparent), transparent 60%);
        }
        .fs-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 26px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
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
          border: 1px solid color-mix(in srgb, var(--c) 28%, rgba(255,255,255,0.06));
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
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          margin: 0;
          line-height: 1.4;
        }
        .fs-body { padding: 24px 26px; }

        /* ── Link / action button ── */
        .fs-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 10px;
          font-family: "Inter", sans-serif;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          background: color-mix(in srgb, var(--c) 12%, rgba(255,255,255,0.04));
          border: 1px solid color-mix(in srgb, var(--c) 26%, rgba(255,255,255,0.08));
          color: color-mix(in srgb, var(--c) 80%, white);
          transition: all 0.15s;
        }
        .fs-link-btn:hover {
          background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,0.06));
          transform: translateY(-1px);
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
          background: color-mix(in srgb, var(--c) 5%, rgba(255,255,255,0.02));
          border: 1px solid color-mix(in srgb, var(--c) 14%, rgba(255,255,255,0.06));
        }
        .stat-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.38);
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
        .stat-value.val-accent { color: color-mix(in srgb, var(--c) 78%, white); }
        .stat-value.val-muted  { color: rgba(255,255,255,0.3); font-size: 18px; }
        .stat-sub {
          font-size: 11.5px;
          color: rgba(255,255,255,0.3);
          line-height: 1.4;
        }

        /* ── Billing plan card ── */
        .plan-card {
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--c) 18%, rgba(255,255,255,0.07));
          background: color-mix(in srgb, var(--c) 5%, rgba(255,255,255,0.02));
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
          background: rgba(16,185,129,0.14);
          border: 1px solid rgba(16,185,129,0.3);
          color: #6ee7b7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .plan-renews {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
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
          color: rgba(255,255,255,0.72);
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
        .bicon-yes { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.24); color: #6ee7b7; }
        .bicon-no  { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); color: rgba(255,255,255,0.2); }
        .plan-bullets li.muted-bullet { color: rgba(255,255,255,0.35); }
        .plan-divider {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin: 14px 0;
        }
        .plan-unlock-label {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.3);
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
          box-shadow: 0 6px 20px rgba(139,92,246,0.28);
          transition: opacity 0.14s, transform 0.14s;
        }
        .upgrade-plan-btn:hover { transform: translateY(-1px); opacity: 0.92; }

        /* ── Alerts section specifics ── */
        .alerts-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 32px 20px;
          text-align: center;
          color: rgba(255,255,255,0.38);
          font-size: 14px;
        }
        .alerts-empty-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 10px;
          border: 1px solid rgba(245,158,11,0.24);
          background: rgba(245,158,11,0.08);
          color: #fcd34d;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.14s;
        }
        .alerts-empty-link:hover { background: rgba(245,158,11,0.14); }


        /* ── CRM status badge ── */
        .crm-badge { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; }
        .crm-on  { color: #6ee7b7; }
        .crm-off { color: rgba(255,255,255,0.4); }

        /* ── Dot indicators ── */
        .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dot-green  { background: #10b981; box-shadow: 0 0 0 2px rgba(16,185,129,0.2); }
        .dot-amber  { background: #f59e0b; box-shadow: 0 0 0 2px rgba(245,158,11,0.2); }
        .dot-muted  { background: rgba(255,255,255,0.18); }

        /* ── Field groups (auto-buy form) ── */
        .field-label { display: block; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.82); margin-bottom: 4px; }
        .field-desc  { color: rgba(255,255,255,0.36); font-size: 12.5px; margin: 0 0 13px; line-height: 1.55; }

        /* ── Chips ── */
        .chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 13px;
          border-radius: 999px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.034);
          color: rgba(255,255,255,0.52);
          transition: all 0.12s;
          user-select: none;
        }
        .chip.on { border-color: rgba(6,182,212,0.36); background: rgba(6,182,212,0.1); color: #67e8f9; }
        .chip:hover:not(:disabled) { border-color: rgba(255,255,255,0.16); color: rgba(255,255,255,0.82); }
        .chip:disabled { cursor: default; }

        /* ── Two-col ── */
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        /* ── Inputs ── */
        .input-field label { display: block; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.62); margin-bottom: 8px; }
        .prefixed {
          display: flex; align-items: center;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; background: rgba(0,0,0,0.22); overflow: hidden;
          transition: border-color 0.15s, background 0.15s;
        }
        .prefixed:focus-within { border-color: rgba(6,182,212,0.36); background: rgba(6,182,212,0.04); }
        .pfx { padding: 0 4px 0 14px; color: rgba(255,255,255,0.3); font-size: 14px; font-weight: 600; flex-shrink: 0; }
        .prefixed input {
          flex: 1; padding: 12px 14px; background: none; border: none; outline: none;
          color: #fff; font-family: "Inter", sans-serif; font-size: 14px;
        }
        .url-input {
          width: 100%; box-sizing: border-box; padding: 12px 15px;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
          background: rgba(0,0,0,0.22); color: #fff;
          font-family: "Inter", sans-serif; font-size: 14px; outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .url-input:focus { border-color: rgba(99,102,241,0.36); background: rgba(99,102,241,0.04); }
        .field-hint { display: block; color: rgba(255,255,255,0.28); font-size: 11.5px; margin-top: 6px; line-height: 1.4; }

        /* ── Exclusivity picker ── */
        .excl-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
        .excl-btn {
          display: flex; align-items: flex-start; gap: 11px; padding: 14px 15px;
          border-radius: 14px; border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.022); cursor: pointer; text-align: left;
          color: #fff; transition: all 0.14s; width: 100%;
        }
        .excl-btn.sel { border-color: rgba(6,182,212,0.32); background: rgba(6,182,212,0.09); }
        .excl-btn:hover:not(:disabled):not(.sel) { border-color: rgba(255,255,255,0.13); background: rgba(255,255,255,0.038); }
        .excl-btn:disabled { cursor: default; }
        .excl-circle {
          width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px; transition: all 0.13s;
        }
        .excl-btn.sel .excl-circle { border-color: #06b6d4; background: rgba(6,182,212,0.18); color: #67e8f9; }
        .excl-l { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.82); margin-bottom: 3px; }
        .excl-btn.sel .excl-l { color: #67e8f9; }
        .excl-d { font-size: 11px; color: rgba(255,255,255,0.34); line-height: 1.4; }

        /* ── Section footer ── */
        .sec-foot {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
          padding: 15px 26px;
          border-top: 1px solid rgba(255,255,255,0.05);
          background: rgba(0,0,0,0.07);
        }
        .foot-hint { font-size: 12px; color: rgba(255,255,255,0.3); }
        .foot-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        /* ── Buttons ── */
        .primary-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          padding: 10px 22px; border-radius: 11px; border: none;
          font-family: "Inter", sans-serif; font-size: 13px; font-weight: 700; cursor: pointer;
          background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
          box-shadow: 0 6px 18px rgba(99,102,241,0.2);
          transition: opacity 0.13s, transform 0.13s;
        }
        .primary-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.9; }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ghost-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          padding: 10px 22px; border-radius: 11px;
          border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
          font-family: "Inter", sans-serif; font-size: 13px; font-weight: 600; cursor: pointer;
          color: rgba(255,255,255,0.68); transition: all 0.13s;
        }
        .ghost-btn:hover:not(:disabled) { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.08); color: #fff; transform: translateY(-1px); }
        .ghost-btn:disabled { opacity: 0.42; cursor: not-allowed; }
        .btn-row { display: flex; gap: 10px; flex-wrap: wrap; }

        /* ── Save messages ── */
        .save-msg {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; padding: 7px 12px; border-radius: 9px;
        }
        .save-ok  { background: rgba(16,185,129,0.09); border: 1px solid rgba(16,185,129,0.2); color: #6ee7b7; }
        .save-err { background: rgba(239,68,68,0.09);  border: 1px solid rgba(239,68,68,0.2);  color: #fca5a5; }
        .feedback {
          display: flex; align-items: flex-start; gap: 9px; margin-top: 14px;
          padding: 12px 14px; border-radius: 12px; font-size: 13px; font-weight: 500; line-height: 1.45;
        }
        .feedback.ok  { background: rgba(16,185,129,0.09); border: 1px solid rgba(16,185,129,0.2); color: #6ee7b7; }
        .feedback.err { background: rgba(239,68,68,0.09);  border: 1px solid rgba(239,68,68,0.2);  color: #fca5a5; }

        /* ── Body grid for auto-buy ── */
        .dist-body { display: grid; gap: 26px; }

        /* ── Auto-buy status banner ── */
        .dist-status {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: 12px;
          font-size: 13px; font-weight: 500; line-height: 1.45;
        }
        .dist-status.paused {
          background: rgba(245,158,11,0.07); border: 1px solid rgba(245,158,11,0.18);
          color: rgba(255,255,255,0.55);
        }
        .dist-status.running {
          background: rgba(6,182,212,0.07); border: 1px solid rgba(6,182,212,0.2);
          color: rgba(255,255,255,0.6);
        }
        .dist-status-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .dist-status.running .dist-status-dot { background: #06b6d4; box-shadow: 0 0 0 3px rgba(6,182,212,0.18); }
        .dist-status.paused  .dist-status-dot { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }

        /* ── Toggle switch ── */
        .toggle-switch {
          position: relative; display: inline-flex; align-items: center;
          gap: 10px; cursor: pointer; user-select: none;
          font-size: 13px; font-weight: 600;
        }
        .toggle-track {
          width: 44px; height: 24px; border-radius: 999px; flex-shrink: 0;
          border: 1.5px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.06);
          transition: background 0.2s, border-color 0.2s;
          position: relative;
        }
        .toggle-track.on { background: rgba(6,182,212,0.25); border-color: rgba(6,182,212,0.4); }
        .toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 16px; height: 16px; border-radius: 50%;
          background: rgba(255,255,255,0.35);
          transition: transform 0.2s, background 0.2s;
        }
        .toggle-track.on .toggle-thumb { transform: translateX(20px); background: #67e8f9; }
        .toggle-label-off { color: rgba(255,255,255,0.38); }
        .toggle-label-on  { color: #67e8f9; }

        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Responsive ── */
        @media (max-width: 720px) {
          .shell  { padding: 26px 16px 80px; }
          .page-header { flex-direction: column; gap: 12px; }
          .page-header h1 { font-size: 24px; }
          .stat-grid   { grid-template-columns: 1fr; }
          .two-col     { grid-template-columns: 1fr; }
          .excl-grid   { grid-template-columns: 1fr; }
          .fs-head     { flex-direction: column; align-items: flex-start; gap: 12px; }
          .sec-foot    { flex-direction: column; align-items: flex-start; }
          .upgrade-banner { flex-direction: column; align-items: flex-start; gap: 10px; }
        }
      `}</style>

      <div className="page">
        <div className="shell">

          {/* ── Page header ── */}
          <header className="page-header">
            <div>
              <h1>Account settings</h1>
              <p className="page-header-sub">Your wallet, plan, automation rules, and integrations.</p>
            </div>
            <div className="header-chips">
              {!subLoading && (
                <span className={isPro ? "chip-badge chip-pro" : "chip-badge chip-free"}>
                  {isPro && <Check size={12} strokeWidth={2.5} />}
                  {isPro ? "Pro Plan" : "Free Plan"}
                </span>
              )}
              <span className="chip-badge chip-money">
                <Wallet size={12} strokeWidth={2} />
                {walletBalance !== null ? `$${walletBalance}` : "—"}
              </span>
            </div>
          </header>

          {/* ── Upgrade nudge (free only) ── */}
          {!subLoading && !isPro && (
            <div className="upgrade-banner">
              <span>
                <strong>Subscribe for $99/month</strong> — unlock shared lead pricing ($30 inbound / $20 outbound),
                early access to new leads, and auto-buy distribution.
              </span>
              <Link href="/subscriptions" className="upgrade-link">
                See plans <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              WALLET
          ══════════════════════════════════════════════ */}
          <section className="fs" style={{ "--c": "#10b981" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon"><Wallet size={18} strokeWidth={1.8} /></div>
                <div>
                  <div className="fs-title">Wallet</div>
                  <p className="fs-desc">Your spending balance for lead purchases</p>
                </div>
              </div>
              <Link href="/wallet" className="fs-link-btn">
                Add funds <ArrowRight size={14} strokeWidth={2} />
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
                  <div className={`stat-value ${wallet?.auto_reload_enabled ? "val-accent" : "val-muted"}`}>
                    {wallet ? (wallet.auto_reload_enabled ? "On" : "Off") : "—"}
                  </div>
                  <div className="stat-sub">
                    {wallet?.auto_reload_enabled && wallet.auto_reload_threshold_cents
                      ? `Tops up when below $${(centsToNumber(wallet.auto_reload_threshold_cents) / 100).toFixed(0)}`
                      : "Configure on wallet page"}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Saved card</div>
                  <div className="stat-value" style={{ fontSize: 16, paddingTop: 4 }}>
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
                <div className="fs-icon"><CreditCard size={18} strokeWidth={1.8} /></div>
                <div>
                  <div className="fs-title">Billing</div>
                  <p className="fs-desc">Subscription plan and payment method</p>
                </div>
              </div>
              <Link href="/subscriptions" className="fs-link-btn">
                {isPro ? "Manage billing" : "View plans"}
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
            <div className="fs-body">
              {subLoading ? (
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <Loader2 size={15} className="spin" strokeWidth={2} /> Checking plan…
                </div>
              ) : (
                <div className="plan-card">
                  <div className="plan-top">
                    <div className="plan-name-row">
                      <span className="plan-badge">{isPro ? "Pro Plan" : "Free Plan"}</span>
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
                      {PRO_BULLETS.map(b => (
                        <li key={b}>
                          <span className="bicon bicon-yes"><Check size={10} strokeWidth={2.5} /></span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      <ul className="plan-bullets">
                        {FREE_BULLETS.map(b => (
                          <li key={b}>
                            <span className="bicon bicon-yes"><Check size={10} strokeWidth={2.5} /></span>
                            {b}
                          </li>
                        ))}
                      </ul>
                      <hr className="plan-divider" />
                      <div className="plan-unlock-label">Unlock with Pro</div>
                      <ul className="plan-bullets" style={{ marginBottom: 20 }}>
                        {PRO_BULLETS.map(b => (
                          <li key={b} className="muted-bullet">
                            <span className="bicon bicon-no" style={{ fontSize: 14, color: "rgba(255,255,255,0.15)" }}>—</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                      <Link href="/subscriptions" className="upgrade-plan-btn">
                        Subscribe — $99/month
                        <ArrowRight size={14} strokeWidth={2} />
                      </Link>
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
                <div className="fs-icon"><Bell size={18} strokeWidth={1.8} /></div>
                <div>
                  <div className="fs-title">Market alerts</div>
                  <p className="fs-desc">Get notified when matching leads become available</p>
                </div>
              </div>
              <Link href="/market-alerts" className="fs-link-btn">
                Manage alerts <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
            <div className="fs-body">
              {alertsLoading ? (
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <Loader2 size={15} className="spin" strokeWidth={2} /> Loading…
                </div>
              ) : activeAlerts.length === 0 ? (
                <div className="alerts-empty">
                  <Bell size={28} strokeWidth={1.4} style={{ color: "rgba(245,158,11,0.35)" }} />
                  <span>No active alerts yet. Set up an alert to get notified when matching leads arrive.</span>
                  <Link href="/market-alerts" className="alerts-empty-link">
                    Create your first alert <ArrowRight size={13} strokeWidth={2} />
                  </Link>
                </div>
              ) : (
                <div className="stat-grid">
                  <div className="stat-box">
                    <div className="stat-label">Active alerts</div>
                    <div className="stat-value val-accent">{activeAlerts.length}</div>
                    <div className="stat-sub">
                      {activeAlerts.length === 1 ? "1 filter set watching" : `${activeAlerts.length} filter sets watching`}
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Email notifications</div>
                    <div className={`stat-value ${hasEmailAlert ? "val-accent" : "val-muted"}`}>
                      {hasEmailAlert ? "Active" : "Off"}
                    </div>
                    <div className="stat-sub" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Mail size={11} strokeWidth={2} style={{ opacity: 0.5 }} />
                      {hasEmailAlert ? "At least one alert uses email" : "Not configured"}
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">SMS notifications</div>
                    <div className={`stat-value ${hasSmsAlert ? "val-accent" : "val-muted"}`}>
                      {hasSmsAlert ? "Active" : "Off"}
                    </div>
                    <div className="stat-sub" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <MessageSquare size={11} strokeWidth={2} style={{ opacity: 0.5 }} />
                      {hasSmsAlert ? "At least one alert uses SMS" : "Not configured"}
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
                <div className="fs-icon"><Zap size={18} strokeWidth={1.8} /></div>
                <div>
                  <div className="fs-title">Auto-buy rules</div>
                  <p className="fs-desc">
                    {distLoading
                      ? "Loading…"
                      : distEnabled
                        ? `Active · ${distMarkets.length > 0 ? `${distMarkets.length} market${distMarkets.length > 1 ? "s" : ""}` : "all markets"} · ${distLeadTypes.length > 0 ? `${distLeadTypes.length} type${distLeadTypes.length > 1 ? "s" : ""}` : "all types"}${distMaxPrice ? ` · max $${distMaxPrice}` : ""}`
                        : "Configure your rules, then enable to start auto-buying leads automatically"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <Link href="/distribution" className="fs-link-btn">
                  Full settings <ArrowRight size={14} strokeWidth={2} />
                </Link>
                {distLoading ? (
                  <Loader2 size={15} className="spin" strokeWidth={2} style={{ color: "rgba(255,255,255,0.3)" }} />
                ) : (
                  <button
                    type="button"
                    className="toggle-switch"
                    onClick={() => setDistEnabled(v => !v)}
                    aria-label={distEnabled ? "Disable auto-buy" : "Enable auto-buy"}
                  >
                    <div className={`toggle-track${distEnabled ? " on" : ""}`}>
                      <div className="toggle-thumb" />
                    </div>
                    <span className={distEnabled ? "toggle-label-on" : "toggle-label-off"}>
                      {distEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="fs-body dist-body">
              {/* Status banner */}
              <div className={`dist-status ${distEnabled ? "running" : "paused"}`}>
                <span className="dist-status-dot" />
                {distEnabled
                  ? "Auto-buy is active — matching leads will be purchased automatically when your wallet balance is sufficient."
                  : "Auto-buy is paused — configure your rules below, then enable to activate. Your settings are saved even while paused."}
              </div>

              <div>
                <label className="field-label">Markets to watch</label>
                <p className="field-desc">Select the markets you want auto-buy to monitor. Leave empty to match all markets.</p>
                <div className="chips">
                  {MARKET_OPTIONS.map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`chip${distMarkets.includes(m) ? " on" : ""}`}
                      onClick={() => toggleMarket(m)}
                    >
                      {distMarkets.includes(m) && <Check size={11} strokeWidth={2.5} />}
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label">Lead types</label>
                <p className="field-desc">Only auto-buy leads matching these types. Leave empty to match all types.</p>
                <div className="chips">
                  {LEAD_TYPE_OPTIONS.map(lt => (
                    <button
                      key={lt.value}
                      type="button"
                      className={`chip${distLeadTypes.includes(lt.value) ? " on" : ""}`}
                      onClick={() => toggleLeadType(lt.value)}
                    >
                      {distLeadTypes.includes(lt.value) && <Check size={11} strokeWidth={2.5} />}
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="two-col">
                <div className="input-field">
                  <label htmlFor="dist-min-wallet">Minimum wallet balance</label>
                  <div className="prefixed">
                    <span className="pfx">$</span>
                    <input
                      id="dist-min-wallet"
                      type="number" min="0" step="1"
                      value={distMinWallet}
                      onChange={e => setDistMinWallet(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <span className="field-hint">Auto-buy pauses if wallet drops below this amount</span>
                </div>
                <div className="input-field">
                  <label htmlFor="dist-max-price">Max price per lead</label>
                  <div className="prefixed">
                    <span className="pfx">$</span>
                    <input
                      id="dist-max-price"
                      type="number" min="0" step="1"
                      value={distMaxPrice}
                      onChange={e => setDistMaxPrice(e.target.value)}
                      placeholder="No limit"
                    />
                  </div>
                  <span className="field-hint">Leads above this price are skipped</span>
                </div>
              </div>

              <div>
                <label className="field-label">Purchase type preference</label>
                <p className="field-desc">
                  Exclusive leads have one buyer. Non Exclusive allows up to 3 buyers at a lower per-buyer price.
                </p>
                <div className="excl-grid">
                  {EXCLUSIVITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`excl-btn${distExclusivity === opt.value ? " sel" : ""}`}
                      onClick={() => setDistExclusivity(opt.value)}
                    >
                      <div className="excl-circle">
                        {distExclusivity === opt.value && <Check size={11} strokeWidth={2.5} />}
                      </div>
                      <div>
                        <div className="excl-l">{opt.label}</div>
                        <div className="excl-d">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sec-foot">
              <span className="foot-hint">
                {walletBalance !== null
                  ? <>Wallet: <strong style={{ color: "rgba(255,255,255,0.7)" }}>${walletBalance}</strong>{" · "}Changes take effect immediately on save</>
                  : "Loading wallet…"}
              </span>
              <div className="foot-right">
                {distMsg && (
                  <span className={`save-msg ${distMsg.tone === "success" ? "save-ok" : "save-err"}`}>
                    {distMsg.tone === "success"
                      ? <CheckCircle2 size={13} strokeWidth={2} />
                      : <XCircle size={13} strokeWidth={2} />}
                    {distMsg.text}
                  </span>
                )}
                <button
                  type="button"
                  className="primary-btn"
                  onClick={saveDistribution}
                  disabled={distMutation.isPending}
                >
                  {distMutation.isPending && <Loader2 size={14} className="spin" strokeWidth={2} />}
                  {distMutation.isPending ? "Saving…" : "Save rules"}
                </button>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════
              CRM INTEGRATION
          ══════════════════════════════════════════════ */}
          <section className="fs" style={{ "--c": "#6366f1" } as CSSProperties}>
            <div className="fs-head">
              <div className="fs-head-left">
                <div className="fs-icon"><PlugZap size={18} strokeWidth={1.8} /></div>
                <div>
                  <div className="fs-title">CRM integration</div>
                  <p className="fs-desc">Deliver purchased leads automatically to your CRM or webhook</p>
                </div>
              </div>
              <div className={`crm-badge ${crmConnected ? "crm-on" : "crm-off"}`}>
                <span className={`dot ${crmConnected ? "dot-green" : "dot-amber"}`} />
                {hookLoading ? "Checking…" : crmConnected ? "Connected" : "Not connected"}
              </div>
            </div>
            <div className="fs-body" style={{ display: "grid", gap: 18 }}>
              <div>
                <label htmlFor="webhook-url" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.62)", marginBottom: 8 }}>
                  Webhook URL
                </label>
                <input
                  id="webhook-url"
                  type="url"
                  className="url-input"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://your-crm.com/webhook/lead"
                />
                <span className="field-hint">
                  We&apos;ll POST lead data here every time a purchase completes. Compatible with GoHighLevel and any HTTPS endpoint.
                </span>
              </div>
              <div className="btn-row">
                <button className="primary-btn" type="button" onClick={() => void saveWebhook()} disabled={isSavingWebhook}>
                  {isSavingWebhook && <Loader2 size={14} className="spin" strokeWidth={2} />}
                  {isSavingWebhook ? "Saving…" : "Save webhook"}
                </button>
                <button className="ghost-btn" type="button" onClick={() => void testWebhook()} disabled={isTestingWebhook || !webhookUrl.trim()}>
                  {isTestingWebhook && <Loader2 size={14} className="spin" strokeWidth={2} />}
                  {isTestingWebhook ? "Sending…" : "Send test lead"}
                </button>
              </div>
              {hookMsg && (
                <div className={`feedback ${hookMsg.tone === "success" ? "ok" : "err"}`}>
                  {hookMsg.tone === "success"
                    ? <CheckCircle2 size={15} strokeWidth={2} />
                    : <XCircle size={15} strokeWidth={2} />}
                  <span>{hookMsg.text}</span>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
