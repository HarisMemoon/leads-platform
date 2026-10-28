"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Gift,
  Landmark,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  type WalletAccountDto,
  type WalletTransactionDto,
  getWalletMe,
  getWalletTransactions,
  getWalletTransactionTotals,
  getPaymentMethodPreview,
  confirmStripeWalletTopUp,
  createStripePaymentIntent,
  patchWalletAutoReload,
  centsToNumber,
  dollarsInputToCents,
} from "@/lib/wallet-api";
import { queryKeys } from "@/lib/query-keys";
import { getMySubscription } from "@/lib/subscriptions-api";
import { getPricingConfig, type PricingConfigEntry } from "@/lib/leads-api";

const TOP_UP_AMOUNTS = [50, 100, 250, 500, 1000, 2500];
const TX_PAGE_SIZE = 10;
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

function formatCardBrand(brand: string) {
  const b = brand.toLowerCase();
  if (b === "amex") return "American Express";
  if (b === "diners") return "Diners Club";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function WalletTopupForm({
  finalAmount,
  saveCardForAutoReload,
  onSuccess,
  onError,
}: {
  finalAmount: number;
  saveCardForAutoReload: boolean;
  onSuccess: (
    amountCents: number,
    paymentIntentId: string,
    opts?: { saveCardForAutoReload?: boolean },
  ) => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isPaying, setIsPaying] = useState(false);

  async function handleSubmit() {
    if (!finalAmount || finalAmount < 10) return;
    if (!stripe || !elements) {
      onError("Stripe is not initialized.");
      return;
    }

    setIsPaying(true);
    onError(null);
    try {
      const amountCents = dollarsInputToCents(finalAmount);
      const { clientSecret } = await createStripePaymentIntent(
        amountCents,
        saveCardForAutoReload,
      );
      const card = elements.getElement(CardElement);
      if (!card) {
        throw new Error("Card input is not ready.");
      }

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (result.error) {
        throw new Error(result.error.message || "Payment failed");
      }

      const pi = result.paymentIntent;
      if (!pi?.id) {
        throw new Error("Missing payment intent from Stripe.");
      }

      await onSuccess(amountCents, pi.id, {
        saveCardForAutoReload,
      });
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Top-up failed");
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div className="stripe-input-wrapper">
          <CardElement
            options={{
              style: {
                base: {
                  color: "#ffffff",
                  fontSize: "14px",
                  fontFamily: '"Inter", sans-serif',
                  fontSmoothing: "antialiased",
                  "::placeholder": { color: "rgba(255,255,255,0.35)" },
                },
                invalid: { color: "#fca5a5" },
              },
            }}
          />
        </div>
      </div>

      <button
        className="topup-btn"
        disabled={!finalAmount || finalAmount < 10 || isPaying}
        onClick={handleSubmit}
      >
        {isPaying ? (
          <>
            <div className="spinner" /> Processing…
          </>
        ) : (
          <>
            <Plus size={16} strokeWidth={2} aria-hidden />
            {finalAmount > 0
              ? `Add $${finalAmount.toFixed(2)} to wallet`
              : "Select an amount"}
          </>
        )}
      </button>
    </>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function RefTypeIcon({ referenceType }: { referenceType: string }) {
  const p = { size: 18, strokeWidth: 2, "aria-hidden": true as const };
  switch (referenceType) {
    case "lead_purchase":
      return <ClipboardList {...p} />;
    case "stripe_topup":
    case "dev_topup":
      return <CreditCard {...p} />;
    case "onboarding_initial":
      return <Sparkles {...p} />;
    case "subscription":
      return <Star {...p} />;
    case "auto_buy":
      return <Bot {...p} />;
    case "admin_credit":
      return <Gift {...p} />;
    case "refund":
      return <RotateCcw {...p} />;
    default:
      return <Wallet {...p} />;
  }
}

function refLabel(type: string) {
  return (
    {
      lead_purchase: "Lead purchase",
      stripe_topup: "Wallet top-up",
      dev_topup: "Wallet top-up",
      onboarding_initial: "Onboarding credit",
      subscription: "Subscription",
      auto_buy: "Auto-buy",
      admin_credit: "Credit",
      refund: "Refund",
    }[type] || type.replace(/_/g, " ")
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const vals = values.length < 2 ? [values[0] ?? 0, values[0] ?? 0] : values;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 120;
  const h = 40;
  const points = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
  const lastPt = points.split(" ").pop()!;
  const [lcx, lcy] = lastPt.split(",");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lcx} cy={lcy} r={3} fill={color} />
    </svg>
  );
}

function sparklineFromTransactions(
  txs: WalletTransactionDto[],
  balanceCents: string,
): number[] {
  const bal = centsToNumber(balanceCents);
  if (txs.length === 0) {
    return [bal, bal, bal, bal, bal, bal, bal];
  }
  const chronological = [...txs].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const points = chronological.map((t) => centsToNumber(t.balance_after_cents));
  if (points.length < 7) {
    const pad = bal;
    while (points.length < 7) points.unshift(pad);
  }
  return points.slice(-12);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");
  const [txPage, setTxPage] = useState(1);

  const txQueryOpts = {
    limit: TX_PAGE_SIZE,
    offset: (txPage - 1) * TX_PAGE_SIZE,
    type: filter === "all" ? undefined : filter,
  } as const;

  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletIsError,
    error: walletError,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: queryKeys.wallet.me,
    queryFn: getWalletMe,
    refetchInterval: (q) =>
      (q.state.data as WalletAccountDto | undefined)?.auto_reload_enabled
        ? 30_000
        : false,
    refetchOnWindowFocus: true,
  });

  const {
    data: txPageData,
    isLoading: txsLoading,
    isError: txsIsError,
    error: txsError,
    refetch: refetchTxs,
  } = useQuery({
    queryKey: queryKeys.wallet.transactions(txQueryOpts),
    queryFn: () => getWalletTransactions(txQueryOpts),
    refetchInterval: wallet?.auto_reload_enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

  const { data: txTotals } = useQuery({
    queryKey: queryKeys.wallet.transactionTotals,
    queryFn: getWalletTransactionTotals,
    refetchInterval: wallet?.auto_reload_enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

  const { data: pmPreview, isLoading: pmPreviewLoading } = useQuery({
    queryKey: queryKeys.stripe.paymentMethodPreview,
    queryFn: getPaymentMethodPreview,
    enabled: !!wallet?.stripe_payment_method_id,
  });

  const { data: subscription } = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: getMySubscription,
  });

  const { data: pricingConfigs } = useQuery({
    queryKey: ["pricing-config"],
    queryFn: getPricingConfig,
    staleTime: 5 * 60 * 1000,
  });

  const isPro =
    subscription != null &&
    ["active", "past_due"].includes(subscription.status ?? "");

  const loading = walletLoading || txsLoading;
  const loadError =
    walletIsError || txsIsError
      ? (walletError ?? txsError) instanceof Error
        ? (walletError ?? txsError)!.message
        : "Failed to load wallet"
      : null;

  const [topupError, setTopupError] = useState<string | null>(null);

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [success, setSuccess] = useState(false);
  const [autoReload, setAutoReload] = useState(false);
  const [reloadThreshold, setReloadThreshold] = useState(100);
  const [reloadAmount, setReloadAmount] = useState(500);
  const [saveCardForAutoReload, setSaveCardForAutoReload] = useState(false);
  const [autoReloadSaveError, setAutoReloadSaveError] = useState<string | null>(
    null,
  );

  const balanceCents = wallet?.balance_cents ?? "0";
  const balanceNum = centsToNumber(balanceCents);

  const inboundConfig = pricingConfigs?.find((c) => c.lead_type === "inbound");
  const sharedPriceCents =
    inboundConfig?.shared_price_cents != null
      ? Number(inboundConfig.shared_price_cents)
      : 2500;
  const exclusivePriceCents =
    inboundConfig?.new_lead_price_cents != null
      ? Number(inboundConfig.new_lead_price_cents)
      : 15000;

  const effectiveLeadPriceCents = isPro
    ? sharedPriceCents
    : exclusivePriceCents;
  const leadsCanAfford = Math.floor(balanceNum / effectiveLeadPriceCents);
  const isWalletLow =
    balanceNum <= effectiveLeadPriceCents * 2 &&
    balanceNum >= effectiveLeadPriceCents;
  const isDeliveryPaused = balanceNum < effectiveLeadPriceCents;

  const autoReloadOptIn = Boolean(wallet?.auto_reload_opt_in);
  const hasSavedCard = Boolean(wallet?.stripe_payment_method_id);

  const finalAmount = selectedAmount ?? (customAmount ? +customAmount : 0);

  const txs = txPageData?.items ?? [];
  const txTotalCount = txPageData?.total ?? 0;
  const txTotalPages = Math.max(1, Math.ceil(txTotalCount / TX_PAGE_SIZE));

  const totalIn = txTotals ? centsToNumber(txTotals.total_credits_cents) : 0;
  const totalOut = txTotals ? centsToNumber(txTotals.total_debits_cents) : 0;

  const sparkValues = useMemo(
    () => sparklineFromTransactions(txs, balanceCents),
    [txs, balanceCents],
  );

  const txRangeLabel = useMemo(() => {
    if (txTotalCount === 0) return "0";
    const start = (txPage - 1) * TX_PAGE_SIZE + 1;
    const end = Math.min(txPage * TX_PAGE_SIZE, txTotalCount);
    return `${start}–${end}`;
  }, [txPage, txTotalCount]);

  useEffect(() => {
    if (!wallet) return;
    if (!wallet.auto_reload_opt_in) {
      setAutoReload(false);
    } else {
      setAutoReload(wallet.auto_reload_enabled);
    }
    if (wallet.auto_reload_threshold_cents != null) {
      setReloadThreshold(
        Math.max(
          50,
          Math.round(centsToNumber(wallet.auto_reload_threshold_cents) / 100),
        ),
      );
    }
    if (wallet.auto_reload_amount_cents != null) {
      setReloadAmount(
        Math.max(
          100,
          Math.round(centsToNumber(wallet.auto_reload_amount_cents) / 100),
        ),
      );
    }
  }, [wallet]);

  useEffect(() => {
    setTxPage(1);
  }, [filter]);

  useEffect(() => {
    if (txTotalCount === 0) return;
    const maxPage = Math.ceil(txTotalCount / TX_PAGE_SIZE);
    if (txPage > maxPage) setTxPage(Math.max(1, maxPage));
  }, [txTotalCount, txPage]);

  const autoReloadMutation = useMutation({
    mutationFn: patchWalletAutoReload,
    onSuccess: async () => {
      setAutoReloadSaveError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary,
      });
      await queryClient.invalidateQueries({
        queryKey: ["wallet", "transactions"],
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.wallet.transactionTotals,
      });
    },
    onError: (e: unknown) => {
      setAutoReloadSaveError(
        e instanceof Error ? e.message : "Could not save auto-reload settings",
      );
    },
  });

  async function handleSaveAutoReload() {
    setAutoReloadSaveError(null);
    if (!autoReloadOptIn) return;
    if (autoReload) {
      await autoReloadMutation.mutateAsync({
        auto_reload_enabled: true,
        auto_reload_threshold_cents: dollarsInputToCents(reloadThreshold),
        auto_reload_amount_cents: dollarsInputToCents(reloadAmount),
      });
    } else {
      await autoReloadMutation.mutateAsync({ auto_reload_enabled: false });
    }
  }

  async function handleTopupSuccess(
    _amountCents: number,
    paymentIntentId: string,
    opts?: { saveCardForAutoReload?: boolean },
  ) {
    await confirmStripeWalletTopUp(paymentIntentId, {
      savePaymentMethodForAutoReload: opts?.saveCardForAutoReload === true,
    });

    await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
    await queryClient.invalidateQueries({
      queryKey: ["wallet", "transactions"],
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.wallet.transactionTotals,
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.stripe.paymentMethodPreview,
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.summary,
    });

    setSuccess(true);
    setSelectedAmount(null);
    setCustomAmount("");
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
        
        .wl-root {
          min-height: 100vh;
          background: #080a0f;
          color: #fff;
          font-family: 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ── PAGE HEADER ── */
        .page-header {
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 40px 24px 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .page-header h1 {
          font-family: 'Manrope', sans-serif;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0;
          background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .page-header p {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          font-weight: 500;
        }

        /* ── LAYOUT ── */
        .wl-body {
          display: grid;
          grid-template-columns: 1fr 380px;
          grid-template-areas: "main side";
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 32px 24px 64px;
          gap: 28px;
          align-items: start;
        }

        .wl-left { grid-area: main; display: flex; flex-direction: column; gap: 24px; min-width: 0; }
        .wl-right { grid-area: side; display: flex; flex-direction: column; gap: 24px; position: sticky; top: 32px; min-width: 0; }

        /* ── BALANCE HERO ── */
        .balance-hero {
          background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(16,185,129,0.05) 100%), rgba(255,255,255,0.02);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 24px;
          padding: 36px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 16px 40px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .balance-hero::before {
          content: ''; position: absolute; top: -80px; right: -80px;
          width: 250px; height: 250px;
          background: radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%);
          border-radius: 50%; filter: blur(20px);
        }

        .balance-hero::after {
          content: ''; position: absolute; bottom: -60px; left: -60px;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%);
          border-radius: 50%; filter: blur(20px);
        }

        .hero-inner { position: relative; z-index: 1; }

        .hero-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }

        .balance-label {
          font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5);
          text-transform: ; letter-spacing: 0.08em; margin-bottom: 8px;
        }

        .balance-amount {
          font-family: 'Syne', sans-serif; font-size: 64px; font-weight: 800;
          letter-spacing: -0.04em; color: #fff; line-height: 1;
        }

        .balance-currency { font-size: 32px; color: rgba(255,255,255,0.4); margin-right: 4px; vertical-align: text-top; }
        .balance-cents { font-size: 32px; color: rgba(255,255,255,0.4); }

        .sparkline-wrap { margin-top: 12px; opacity: 0.8; }

        .hero-stats {
          display: flex; flex-wrap: wrap; gap: 24px 40px;
          margin-top: 28px; padding-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .hero-stat { min-width: 120px; }
        .hero-stat-val { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
        .hero-stat-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); margin-top: 4px; text-transform: ; letter-spacing: 0.04em; }

        .hero-badge {
          display: flex; align-items: center; gap: 6px;
          background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25);
          border-radius: 100px; padding: 6px 14px;
          font-size: 12px; font-weight: 600; color: #6ee7b7; white-space: nowrap;
          box-shadow: 0 0 12px rgba(16,185,129,0.15);
        }

        /* ── CARD ── */
        .card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.02);
          animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
        .card-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
        .card-sub { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.4); margin-top: 4px; }

        /* ── WARNING BANNERS ── */
        .warning-banner {
          padding: 16px 20px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid;
        }
        .warning-banner-content {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 0;
        }
        .warning-banner-text {
          flex: 1;
          min-width: 0;
        }
        .warning-btn {
          padding: 10px 18px;
          border-radius: 10px;
          border: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── STRIPE & INPUTS ── */
        .stripe-input-wrapper,
        .custom-input-wrap {
          position: relative;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 14px 16px;
          transition: all 0.2s ease;
        }
        
        .custom-input-wrap { padding: 0; display: flex; align-items: center; margin-bottom: 16px; overflow: hidden; }
        
        .stripe-input-wrapper:focus-within,
        .custom-input-wrap:focus-within {
          border-color: rgba(99,102,241,0.45);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
          background: rgba(99,102,241,0.04);
        }

        .custom-input-prefix {
          padding-left: 16px; font-size: 15px; color: rgba(255,255,255,0.4); font-weight: 600; font-family: 'DM Mono', monospace;
        }

        .custom-input {
          flex: 1; background: transparent; border: none; padding: 14px 16px 14px 8px; min-width: 0;
          font-size: 15px; font-weight: 500; color: #fff; outline: none; font-family: 'DM Mono', monospace;
          -moz-appearance: textfield; appearance: textfield;
        }
        .custom-input::-webkit-outer-spin-button, .custom-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .custom-input::placeholder { color: rgba(255,255,255,0.3); font-family: 'Inter', sans-serif; font-weight: 400; }

        .topup-amounts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }

        .amount-btn {
          padding: 12px 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.6);
          cursor: pointer; transition: all 0.15s ease; font-family: 'DM Mono', monospace; text-align: center;
        }
        .amount-btn:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.3); color: #a5b4fc; }
        .amount-btn.selected { background: rgba(99,102,241,0.15); border-color: #6366f1; color: #c4b5fd; box-shadow: 0 0 12px rgba(99,102,241,0.25); }

        .topup-btn {
          width: 100%; padding: 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none; border-radius: 12px; font-size: 14px; font-weight: 700; color: #fff;
          cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px rgba(99,102,241,0.25);
        }
        .topup-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.35); }
        .topup-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; filter: grayscale(50%); }

        .save-card-row {
          display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px;
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.2s; margin-bottom: 16px;
        }
        .save-card-row:hover { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.05); }
        .save-card-row input { position: absolute; opacity: 0; width: 0; height: 0; }
        
        .save-card-check {
          flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
          border: 2px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;
          margin-top: 2px; transition: all 0.2s;
        }
        .save-card-row:has(:checked) .save-card-check { background: #6366f1; border-color: #6366f1; box-shadow: 0 0 12px rgba(99,102,241,0.4); }
        .save-card-copy { flex: 1; min-width: 0; }
        .save-card-title { font-size: 13px; font-weight: 600; color: #fff; }
        .save-card-desc { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; line-height: 1.4; }

        /* ── RANGE SLIDERS ── */
        .range-field { margin-bottom: 16px; }
        .range-label-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 500; margin-bottom: 10px; }
        .range-label-row span:first-child { color: rgba(255,255,255,0.5); }
        .range-label-row span:last-child { color: #fff; font-weight: 700; font-family: 'DM Mono', monospace; font-size: 13px; }

        input[type=range] { width: 100%; -webkit-appearance: none; background: transparent; margin: 8px 0; outline: none; }
        input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #818cf8; cursor: pointer; margin-top: -7px; box-shadow: 0 0 10px rgba(129,140,248,0.4); border: 2px solid #fff; transition: transform 0.1s; }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.1); }
        input[type=range]::-moz-range-track { width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; }
        input[type=range]::-moz-range-thumb { height: 20px; width: 20px; border-radius: 50%; background: #818cf8; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 10px rgba(129,140,248,0.4); }

        /* ── TOGGLE ── */
        .toggle { width: 44px; height: 24px; background: rgba(255,255,255,0.1); border-radius: 12px; position: relative; cursor: pointer; transition: background 0.25s ease; border: none; outline: none; flex-shrink: 0; box-shadow: inset 0 1px 3px rgba(0,0,0,0.2); }
        .toggle.on { background: #6366f1; }
        .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .toggle.on .toggle-thumb { transform: translateX(20px); }

        /* ── TX LIST ── */
        .filter-tabs { display: inline-flex; flex-wrap: wrap; gap: 4px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 4px; }
        .filter-tab { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; border: none; background: transparent; font-family: 'Inter', sans-serif; }
        .filter-tab:hover { color: rgba(255,255,255,0.8); }
        .filter-tab.active { background: rgba(255,255,255,0.1); color: #fff; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        .tx-list { display: flex; flex-direction: column; margin-top: 8px; }
        .tx-item { display: flex; align-items: center; gap: 16px; padding: 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); transition: all 0.2s ease; border-radius: 12px; }
        .tx-item:hover { background: rgba(255,255,255,0.02); padding-left: 16px; padding-right: 8px; border-bottom-color: transparent; }
        .tx-item:last-child { border-bottom: none; }

        .tx-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .tx-icon.credit { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.15); color: #34d399; }
        .tx-icon.debit  { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }

        .tx-info { flex: 1; min-width: 0; }
        .tx-desc { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
        .tx-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
        .tx-type-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.02em; text-transform: ; white-space: nowrap; }
        .tx-time { font-size: 12px; color: rgba(255,255,255,0.35); white-space: nowrap; }

        .tx-amount-group { text-align: right; flex-shrink: 0; }
        .tx-amount { font-family: 'DM Mono', monospace; font-size: 15px; font-weight: 600; margin-bottom: 4px; }
        .tx-amount.credit { color: #34d399; }
        .tx-amount.debit  { color: rgba(255,255,255,0.7); }
        .tx-balance-after { font-size: 11px; color: rgba(255,255,255,0.35); font-family: 'DM Mono', monospace; }

        /* ── PM CARD ── */
        .pm-card { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.02); }
        .pm-card-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; color: #a5b4fc; flex-shrink: 0; }
        .pm-card-brand { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
        .pm-card-number { font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6); margin-top: 4px; letter-spacing: 0.05em; }
        .pm-card-exp { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.35); margin-top: 6px; text-transform: ; letter-spacing: 0.05em; }

        /* ── UTILS ── */
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.25); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .empty-tx { text-align: center; padding: 48px 20px; color: rgba(255,255,255,0.4); font-size: 14px; font-weight: 500; }
        
        .tx-pager { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .tx-pager-info { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.4); }
        .tx-pager-btns { display: flex; gap: 8px; }
        .tx-pager-btn { display: inline-flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.8); cursor: pointer; transition: all 0.2s ease; }
        .tx-pager-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
        .tx-pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .topup-summary { background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 12px; padding: 16px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .summary-label { color: rgba(255,255,255,0.5); font-weight: 500; }
        .summary-val { color: #fff; font-family: 'DM Mono', monospace; font-weight: 500; }
        .summary-val.highlight { color: #a5b4fc; font-size: 15px; font-weight: 600; }
        
        .success-banner { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 12px; padding: 14px 16px; font-size: 13px; font-weight: 500; color: #34d399; display: flex; align-items: center; gap: 10px; margin-bottom: 16px; animation: fadeUp 0.3s ease; }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .wl-body { grid-template-columns: 1fr; grid-template-areas: "side" "main"; padding: 24px 16px 48px; gap: 24px; }
          .wl-right { position: static; top: auto; }
        }

        @media (max-width: 550px) {
          .page-header { padding: 24px 16px 0; }
          .wl-body { padding: 16px 16px 48px; gap: 16px; }

          .balance-hero { padding: 20px; border-radius: 20px; }
          .hero-top { flex-direction: column; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
          .balance-amount { font-size: 38px; }
          .balance-currency, .balance-cents { font-size: 20px; }
          .hero-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding-top: 20px; margin-top: 20px; }
          .hero-stat { min-width: 0; }

          .card { padding: 16px; border-radius: 16px; }
          .card-header { flex-direction: column; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
          
          .filter-tabs { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
          .filter-tab { width: 100%; text-align: center; padding: 8px 4px; font-size: 11px; display: flex; justify-content: center; }

          .tx-item { padding: 12px 0; gap: 12px; }
          .tx-icon { width: 36px; height: 36px; border-radius: 10px; }
          .tx-desc { font-size: 13px; }
          .tx-amount { font-size: 14px; }

          .topup-amounts { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .amount-btn { padding: 10px 4px; font-size: 13px; }

          .pm-card { flex-direction: column; align-items: flex-start; padding: 16px; gap: 12px; }

          .save-card-row { flex-direction: column; align-items: flex-start; gap: 12px; padding: 14px; }
          .save-card-copy { width: 100%; }

          .warning-banner { flex-direction: column; align-items: flex-start; padding: 16px; gap: 16px; }
          .warning-btn { width: 100%; }
        }
      `,
        }}
      />

      <div className="wl-root">
        {loading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "50vh",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            <div className="spinner" style={{ marginRight: 12 }} /> Loading
            wallet…
          </div>
        ) : loadError ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              minHeight: "50vh",
              padding: 24,
              color: "#fca5a5",
              fontSize: 14,
            }}
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => {
                void refetchWallet();
                void refetchTxs();
              }}
              style={{
                padding: "10px 20px",
                background: "rgba(99,102,241,0.2)",
                border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: 10,
                color: "#a5b4fc",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <header className="page-header">
              <h1>Wallet & Billing</h1>
              <p>
                Manage your funds, view transactions, and configure auto-reload.
              </p>
            </header>

            <div className="wl-body">
              {/* ── LEFT ── */}
              <div className="wl-left">
                {/* Balance hero */}
                <div className="balance-hero">
                  <div className="hero-inner">
                    <div className="hero-top">
                      <div>
                        <div className="balance-label">Available balance</div>
                        <div className="balance-amount">
                          <span className="balance-currency">$</span>
                          {Math.floor(balanceNum / 100).toLocaleString()}
                          <span className="balance-cents">
                            .{String(balanceNum % 100).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="sparkline-wrap">
                          <Sparkline
                            values={sparkValues}
                            color="rgba(99,102,241,0.6)"
                          />
                        </div>
                      </div>
                      <div className="hero-badge">
                        <CheckCircle2 size={14} strokeWidth={2.5} aria-hidden />
                        {wallet?.auto_reload_enabled
                          ? "Auto-reload on"
                          : "Auto-reload off"}
                      </div>
                    </div>
                    <div className="hero-stats">
                      <div className="hero-stat">
                        <div
                          className="hero-stat-val"
                          style={{ color: "#34d399" }}
                        >
                          +${(totalIn / 100).toLocaleString()}
                        </div>
                        <div className="hero-stat-label">Total funded</div>
                      </div>
                      <div className="hero-stat">
                        <div
                          className="hero-stat-val"
                          style={{ color: "rgba(255,255,255,0.7)" }}
                        >
                          ${(totalOut / 100).toLocaleString()}
                        </div>
                        <div className="hero-stat-label">Total spent</div>
                      </div>
                      <div className="hero-stat">
                        <div
                          className="hero-stat-val"
                          style={{
                            color: isDeliveryPaused
                              ? "#ef4444"
                              : isWalletLow
                                ? "#f59e0b"
                                : undefined,
                          }}
                        >
                          {leadsCanAfford}
                        </div>
                        <div className="hero-stat-label">
                          Leads you can afford
                        </div>
                      </div>
                      <div className="hero-stat">
                        <div className="hero-stat-val">
                          ${(effectiveLeadPriceCents / 100).toFixed(0)}
                        </div>
                        <div className="hero-stat-label">
                          {isPro ? "Shared lead price" : "Exclusive lead price"}
                        </div>
                      </div>
                      <div className="hero-stat">
                        <div className="hero-stat-val">
                          {wallet?.auto_reload_threshold_cents != null
                            ? `$${(centsToNumber(wallet.auto_reload_threshold_cents) / 100).toFixed(0)}`
                            : "—"}
                        </div>
                        <div className="hero-stat-label">Reload threshold</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Low wallet warning banner */}
                {isDeliveryPaused && (
                  <div
                    className="warning-banner"
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      borderColor: "rgba(239,68,68,0.25)",
                    }}
                  >
                    <div className="warning-banner-content">
                      <span style={{ fontSize: 22 }}>🚫</span>
                      <div className="warning-banner-text">
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#fca5a5",
                          }}
                        >
                          Lead delivery paused
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.6)",
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          Your balance is below the $
                          {(effectiveLeadPriceCents / 100).toFixed(0)}{" "}
                          {isPro ? "shared" : "exclusive"} lead price. Add funds
                          to restart delivery.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAmount(100)}
                      className="warning-btn"
                      style={{ background: "#ef4444", color: "#fff" }}
                    >
                      Add Funds
                    </button>
                  </div>
                )}
                {isWalletLow && !isDeliveryPaused && (
                  <div
                    className="warning-banner"
                    style={{
                      background: "rgba(245,158,11,0.1)",
                      borderColor: "rgba(245,158,11,0.25)",
                    }}
                  >
                    <div className="warning-banner-content">
                      <span style={{ fontSize: 22 }}>⚠️</span>
                      <div className="warning-banner-text">
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#fcd34d",
                          }}
                        >
                          Wallet running low
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.6)",
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          You can afford about {leadsCanAfford} more{" "}
                          {leadsCanAfford === 1 ? "lead" : "leads"}. Add funds
                          to avoid delivery pausing.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAmount(100)}
                      className="warning-btn"
                      style={{ background: "#f59e0b", color: "#000" }}
                    >
                      Add Funds
                    </button>
                  </div>
                )}

                {/* Cancelled subscription — exclusive-only notice */}
                {subscription?.status === "cancelled" && balanceNum > 0 && (
                  <div
                    className="warning-banner"
                    style={{
                      background: "rgba(99,102,241,0.08)",
                      borderColor: "rgba(99,102,241,0.25)",
                    }}
                  >
                    <div className="warning-banner-content">
                      <span style={{ fontSize: 22 }}>💡</span>
                      <div className="warning-banner-text">
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#a5b4fc",
                            marginBottom: 4,
                          }}
                        >
                          Your wallet balance is still usable
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.6)",
                            lineHeight: 1.5,
                          }}
                        >
                          Your Pro subscription has expired, but your remaining
                          ${(balanceNum / 100).toFixed(2)} can still be used to
                          purchase{" "}
                          <strong style={{ color: "#fff" }}>
                            exclusive leads
                          </strong>{" "}
                          from the marketplace. Shared (non-exclusive) lead
                          purchases require an active subscription.
                          <a
                            href="/subscriptions"
                            style={{
                              color: "#a5b4fc",
                              marginLeft: 6,
                              textDecoration: "underline",
                            }}
                          >
                            Reactivate to unlock shared leads →
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction history */}
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">Transaction history</div>
                      <div className="card-sub">
                        {txTotalCount} total{" "}
                        {txTotalCount > 0 ? ` · rows ${txRangeLabel}` : ""}
                      </div>
                    </div>
                    <div className="filter-tabs">
                      {(["all", "credit", "debit"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`filter-tab ${filter === f ? "active" : ""}`}
                          onClick={() => setFilter(f)}
                        >
                          {f === "all"
                            ? "All"
                            : f === "credit"
                              ? "Credits"
                              : "Debits"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="tx-list">
                    {txs.length === 0 ? (
                      <div className="empty-tx">
                        No transactions found matching this filter.
                      </div>
                    ) : (
                      txs.map((tx) => (
                        <div key={tx.id} className="tx-item">
                          <div className={`tx-icon ${tx.type}`}>
                            <RefTypeIcon referenceType={tx.reference_type} />
                          </div>
                          <div className="tx-info">
                            <div className="tx-desc">{tx.description}</div>
                            <div className="tx-meta">
                              <span
                                className="tx-type-badge"
                                style={{
                                  background:
                                    tx.type === "credit"
                                      ? "rgba(16,185,129,0.1)"
                                      : "rgba(255,255,255,0.06)",
                                  color:
                                    tx.type === "credit"
                                      ? "#34d399"
                                      : "rgba(255,255,255,0.5)",
                                }}
                              >
                                {refLabel(tx.reference_type)}
                              </span>
                              <span className="tx-time">
                                {timeAgo(tx.created_at)}
                              </span>
                            </div>
                          </div>
                          <div className="tx-amount-group">
                            <div className={`tx-amount ${tx.type}`}>
                              {tx.type === "credit" ? "+" : "−"}$
                              {(centsToNumber(tx.amount_cents) / 100).toFixed(
                                2,
                              )}
                            </div>
                            <div className="tx-balance-after">
                              bal. $
                              {(
                                centsToNumber(tx.balance_after_cents) / 100
                              ).toFixed(0)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {txTotalCount > 0 ? (
                    <div className="tx-pager">
                      <span className="tx-pager-info">
                        Page {txPage} of {txTotalPages}
                      </span>
                      <div className="tx-pager-btns">
                        <button
                          type="button"
                          className="tx-pager-btn"
                          disabled={txPage <= 1}
                          onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                          Prev
                        </button>
                        <button
                          type="button"
                          className="tx-pager-btn"
                          disabled={txPage >= txTotalPages}
                          onClick={() =>
                            setTxPage((p) => Math.min(txTotalPages, p + 1))
                          }
                        >
                          Next
                          <ChevronRight size={16} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ── RIGHT ── */}
              <div className="wl-right">
                {/* Add funds */}
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">Add funds</div>
                      <div className="card-sub">Stripe card payment</div>
                    </div>
                    <Landmark
                      size={22}
                      strokeWidth={1.5}
                      style={{ color: "rgba(255,255,255,0.2)" }}
                      aria-hidden
                    />
                  </div>

                  {topupError && (
                    <div
                      className="success-banner"
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        borderColor: "rgba(239,68,68,0.3)",
                        color: "#fca5a5",
                      }}
                    >
                      {topupError}
                    </div>
                  )}
                  {success && (
                    <div className="success-banner">
                      <Check size={18} strokeWidth={2.5} aria-hidden />
                      Wallet funded successfully!
                    </div>
                  )}

                  <div className="topup-amounts">
                    {TOP_UP_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        className={`amount-btn ${selectedAmount === a ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedAmount(a);
                          setCustomAmount("");
                        }}
                      >
                        ${a}
                      </button>
                    ))}
                  </div>

                  <div className="custom-input-wrap">
                    <span className="custom-input-prefix">$</span>
                    <input
                      className="custom-input"
                      type="number"
                      placeholder="Custom amount"
                      value={customAmount}
                      min={10}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setSelectedAmount(null);
                      }}
                    />
                  </div>

                  <label className="save-card-row">
                    <input
                      type="checkbox"
                      checked={saveCardForAutoReload}
                      onChange={(e) =>
                        setSaveCardForAutoReload(e.target.checked)
                      }
                      aria-label="Save this card for auto-reload"
                    />
                    <span className="save-card-check" aria-hidden>
                      {saveCardForAutoReload ? (
                        <Check size={14} strokeWidth={3} color="#ffffff" />
                      ) : null}
                    </span>
                    <div className="save-card-copy">
                      <div className="save-card-title">
                        Save card for auto-reload
                      </div>
                      <div className="save-card-desc">
                        Securely stores this card with Stripe for instant
                        refills and automatic wallet top-ups.
                      </div>
                    </div>
                  </label>

                  <Elements stripe={stripePromise}>
                    <WalletTopupForm
                      finalAmount={finalAmount}
                      saveCardForAutoReload={saveCardForAutoReload}
                      onSuccess={handleTopupSuccess}
                      onError={setTopupError}
                    />
                  </Elements>

                  {finalAmount > 0 && (
                    <div className="topup-summary">
                      <div className="summary-row">
                        <span className="summary-label">Amount to add</span>
                        <span className="summary-val">
                          ${finalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="summary-label">Current balance</span>
                        <span className="summary-val">
                          ${(balanceNum / 100).toFixed(2)}
                        </span>
                      </div>
                      <div
                        className="summary-row"
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          paddingTop: 10,
                          marginTop: 4,
                        }}
                      >
                        <span className="summary-label">New balance</span>
                        <span className="summary-val highlight">
                          ${(balanceNum / 100 + finalAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.3)",
                      textAlign: "center",
                      marginTop: 16,
                      lineHeight: 1.5,
                    }}
                  >
                    Your card is charged securely with Stripe.
                  </p>
                </div>

                {/* Auto-reload */}
                <div className="card" style={{ animationDelay: "0.1s" }}>
                  <div className="card-header" style={{ marginBottom: 16 }}>
                    <div>
                      <div className="card-title">Auto-reload</div>
                      <div className="card-sub">
                        Automatically refill your wallet
                      </div>
                    </div>
                    {autoReloadOptIn ? (
                      <button
                        type="button"
                        className={`toggle ${autoReload ? "on" : ""}`}
                        onClick={() => setAutoReload(!autoReload)}
                        aria-label={
                          autoReload
                            ? "Turn off auto-reload"
                            : "Turn on auto-reload"
                        }
                      >
                        <div className="toggle-thumb" />
                      </button>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          textTransform: "",
                          color: "rgba(255,255,255,0.3)",
                        }}
                      >
                        {hasSavedCard ? "Locked" : "Save card first"}
                      </span>
                    )}
                  </div>

                  {!autoReloadOptIn ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.5)",
                        lineHeight: 1.5,
                      }}
                    >
                      {hasSavedCard ? (
                        <>
                          Your card is saved, but auto-reload unlocks only after
                          you complete a wallet top-up and check{" "}
                          <strong style={{ color: "#fff" }}>
                            Save this card for auto-reload
                          </strong>
                          .
                        </>
                      ) : (
                        <>
                          To use auto-reload, add funds above and check{" "}
                          <strong style={{ color: "#fff" }}>
                            Save this card for auto-reload
                          </strong>{" "}
                          before completing payment.
                        </>
                      )}
                    </p>
                  ) : null}

                  {autoReloadOptIn && autoReload && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        paddingTop: 20,
                      }}
                    >
                      <div className="range-field">
                        <div className="range-label-row">
                          <span>Reload when balance drops below</span>
                          <span>${reloadThreshold}</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={500}
                          step={50}
                          value={reloadThreshold}
                          onChange={(e) => setReloadThreshold(+e.target.value)}
                        />
                      </div>
                      <div className="range-field">
                        <div className="range-label-row">
                          <span>Auto-reload amount</span>
                          <span>${reloadAmount}</span>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={2000}
                          step={100}
                          value={reloadAmount}
                          onChange={(e) => setReloadAmount(+e.target.value)}
                        />
                      </div>

                      <div
                        style={{
                          background: "rgba(99,102,241,0.08)",
                          border: "1px solid rgba(99,102,241,0.2)",
                          borderRadius: 12,
                          padding: "14px 16px",
                          fontSize: 13,
                          color: "rgba(255,255,255,0.6)",
                          lineHeight: 1.5,
                        }}
                      >
                        When your balance falls below{" "}
                        <strong style={{ color: "#a5b4fc" }}>
                          ${reloadThreshold}
                        </strong>
                        , we'll automatically charge your saved card and add{" "}
                        <strong style={{ color: "#a5b4fc" }}>
                          ${reloadAmount}
                        </strong>{" "}
                        to your wallet.
                      </div>

                      {autoReloadSaveError && (
                        <p style={{ fontSize: 13, color: "#fca5a5" }}>
                          {autoReloadSaveError}
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={autoReloadMutation.isPending}
                        onClick={() => void handleSaveAutoReload()}
                        style={{
                          width: "100%",
                          padding: "12px",
                          background: "rgba(99,102,241,0.15)",
                          border: "1px solid rgba(99,102,241,0.3)",
                          borderRadius: 10,
                          color: "#a5b4fc",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background =
                            "rgba(99,102,241,0.25)";
                          e.currentTarget.style.color = "#fff";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background =
                            "rgba(99,102,241,0.15)";
                          e.currentTarget.style.color = "#a5b4fc";
                        }}
                      >
                        {autoReloadMutation.isPending
                          ? "Saving…"
                          : "Save auto-reload settings"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Payment method */}
                <div className="card" style={{ animationDelay: "0.2s" }}>
                  <div className="card-header">
                    <div className="card-title">Payment method</div>
                  </div>
                  {wallet?.stripe_payment_method_id ? (
                    pmPreviewLoading ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.4)",
                          padding: "10px 0",
                        }}
                      >
                        Loading card…
                      </div>
                    ) : pmPreview?.paymentMethod ? (
                      <div className="pm-card">
                        <div className="pm-card-icon">
                          <CreditCard size={24} strokeWidth={1.5} aria-hidden />
                        </div>
                        <div>
                          <div className="pm-card-brand">
                            {formatCardBrand(pmPreview.paymentMethod.brand)}
                          </div>
                          <div className="pm-card-number">
                            •••• •••• •••• {pmPreview.paymentMethod.last4}
                          </div>
                          <div className="pm-card-exp">
                            Expires{" "}
                            {String(pmPreview.paymentMethod.exp_month).padStart(
                              2,
                              "0",
                            )}
                            /
                            {String(pmPreview.paymentMethod.exp_year).slice(-2)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.5)",
                          lineHeight: 1.5,
                        }}
                      >
                        Card on file — masked details unavailable right now.
                        Saved payments still work.
                      </div>
                    )
                  ) : (
                    <div
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.5)",
                        lineHeight: 1.5,
                      }}
                    >
                      No card on file. Add funds and enable “Save card for
                      auto-reload” to store a card.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
