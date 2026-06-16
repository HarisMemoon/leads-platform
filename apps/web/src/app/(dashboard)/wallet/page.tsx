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
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
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
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

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
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 11,
            padding: "13px 14px",
          }}
        >
          <CardElement
            options={{
              style: {
                base: {
                  color: "#ffffff",
                  fontSize: "15px",
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
          <><div className="spinner" /> Processing…</>
        ) : (
          <>
            <Plus size={16} strokeWidth={2} aria-hidden />
            {finalAmount > 0 ? `Add $${finalAmount} to wallet` : "Select an amount"}
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
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
  return {
    lead_purchase: "Lead purchase",
    stripe_topup: "Wallet top-up",
    dev_topup: "Wallet top-up",
    onboarding_initial: "Onboarding credit",
    subscription: "Subscription",
    auto_buy: "Auto-buy",
    admin_credit: "Credit",
    refund: "Refund",
  }[type] || type.replace(/_/g, " ");
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const vals = values.length < 2 ? [values[0] ?? 0, values[0] ?? 0] : values;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 120; const h = 40;
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  const lastPt = points.split(" ").pop()!;
  const [lcx, lcy] = lastPt.split(",");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
    // Auto-reload runs server-side; poll so balance/txs update without a full navigation.
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

  const isPro = subscription != null && ["active", "past_due"].includes(subscription.status ?? "");

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
  const [autoReloadSaveError, setAutoReloadSaveError] = useState<string | null>(null);

  const balanceCents = wallet?.balance_cents ?? "0";
  const balanceNum = centsToNumber(balanceCents);

  // Dynamic pricing from config — fall back to defaults if not yet loaded
  const inboundConfig = pricingConfigs?.find((c) => c.lead_type === "inbound");
  const sharedPriceCents = inboundConfig?.shared_price_cents != null
    ? Number(inboundConfig.shared_price_cents) : 2500;
  const exclusivePriceCents = inboundConfig?.new_lead_price_cents != null
    ? Number(inboundConfig.new_lead_price_cents) : 15000;

  // Non-subscribers can only buy exclusive leads — use exclusive price for capacity
  const effectiveLeadPriceCents = isPro ? sharedPriceCents : exclusivePriceCents;
  const leadsCanAfford = Math.floor(balanceNum / effectiveLeadPriceCents);
  const isWalletLow = balanceNum <= effectiveLeadPriceCents * 2 && balanceNum >= effectiveLeadPriceCents;
  const isDeliveryPaused = balanceNum < effectiveLeadPriceCents;

  /** Server sets this only after "Save this card for auto-reload" on a completed top-up */
  const autoReloadOptIn = Boolean(wallet?.auto_reload_opt_in);
  const hasSavedCard = Boolean(wallet?.stripe_payment_method_id);

  const finalAmount = selectedAmount ?? (customAmount ? +customAmount : 0);

  const txs = txPageData?.items ?? [];
  const txTotalCount = txPageData?.total ?? 0;
  const txTotalPages = Math.max(1, Math.ceil(txTotalCount / TX_PAGE_SIZE));

  const totalIn = txTotals ? centsToNumber(txTotals.total_credits_cents) : 0;
  const totalOut = txTotals ? centsToNumber(txTotals.total_debits_cents) : 0;
  const lifetimeTxCount = txTotals?.transaction_count ?? 0;

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
        Math.max(50, Math.round(centsToNumber(wallet.auto_reload_threshold_cents) / 100)),
      );
    }
    if (wallet.auto_reload_amount_cents != null) {
      setReloadAmount(
        Math.max(100, Math.round(centsToNumber(wallet.auto_reload_amount_cents) / 100)),
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
      await queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactionTotals });
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
    await queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactionTotals });
    await queryClient.invalidateQueries({ queryKey: queryKeys.stripe.paymentMethodPreview });
    await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });

    setSuccess(true);
    setSelectedAmount(null);
    setCustomAmount("");
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .wl-root {
          min-height: 100vh;
          background: #080a0f;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ── NAV ── */
        .topnav {
          height: 64px;
          border-bottom: 1px solid rgba(255,255,255,0.055);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          position: sticky; top: 0; z-index: 50;
          background: rgba(8,10,15,0.96);
          backdrop-filter: blur(16px);
        }

        .nav-left { display: flex; align-items: center; gap: 28px; }

        .brand {
          display: flex; align-items: center; gap: 10px; text-decoration: none;
        }

        .brand-icon {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, #6366f1, #10b981);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
        }

        .brand-name { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: #fff; }

        .nav-links { display: flex; gap: 2px; }

        .nav-link {
          padding: 7px 13px; border-radius: 8px;
          font-size: 13px; color: rgba(255,255,255,0.42);
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }

        .nav-link:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.05); }
        .nav-link.active { color: #fff; background: rgba(255,255,255,0.08); }

        .nav-right { display: flex; align-items: center; gap: 14px; }

        .wallet-pill {
          display: flex; align-items: center; gap: 7px;
          background: rgba(16,185,129,0.09);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 100px;
          padding: 6px 14px;
          font-size: 13px; color: #6ee7b7; font-weight: 500; text-decoration: none;
        }

        .avatar {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; cursor: pointer;
        }

        /* ── LAYOUT ── */
        .wl-body {
          display: grid;
          grid-template-columns: 1fr 380px;
          grid-template-areas: "main side";
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 32px 24px 48px;
          gap: 24px;
          align-items: start;
        }

        .wl-left {
          grid-area: main;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .wl-right {
          grid-area: side;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: sticky;
          top: 88px;
          align-self: start;
        }

        .save-card-row {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: linear-gradient(145deg, rgba(99,102,241,0.06), rgba(255,255,255,0.02));
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          margin-bottom: 14px;
        }
        .save-card-row:hover {
          border-color: rgba(99,102,241,0.35);
          background: rgba(99,102,241,0.08);
        }
        .save-card-row input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }
        .save-card-check {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border-radius: 7px;
          border: 2px solid rgba(255,255,255,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
        }
        .save-card-row:has(:checked) .save-card-check {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-color: rgba(255,255,255,0.15);
          box-shadow: 0 4px 14px rgba(99,102,241,0.35);
        }
        .save-card-copy {
          flex: 1;
          min-width: 0;
        }
        .save-card-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.92);
          letter-spacing: -0.2px;
        }
        .save-card-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.38);
          margin-top: 4px;
          line-height: 1.45;
        }

        .pm-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 18px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          background: linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,27,75,0.35));
          box-shadow: 0 12px 40px rgba(0,0,0,0.35);
        }
        .pm-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a5b4fc;
        }
        .pm-card-lines {
          flex: 1;
          min-width: 0;
        }
        .pm-card-brand {
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.3px;
        }
        .pm-card-number {
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          color: rgba(255,255,255,0.75);
          margin-top: 6px;
          letter-spacing: 0.08em;
        }
        .pm-card-exp {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          margin-top: 6px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .tx-pager {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .tx-pager-info {
          font-size: 12px;
          color: rgba(255,255,255,0.38);
        }
        .tx-pager-btns {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tx-pager-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.85);
          cursor: pointer;
          transition: all 0.15s;
        }
        .tx-pager-btn:hover:not(:disabled) {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.35);
          color: #fff;
        }
        .tx-pager-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* ── BALANCE HERO ── */
        .balance-hero {
          background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(16,185,129,0.08) 100%);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 22px;
          padding: 32px;
          position: relative;
          overflow: hidden;
          animation: fadeUp 0.4s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .balance-hero::before {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%);
          border-radius: 50%;
        }

        .balance-hero::after {
          content: '';
          position: absolute;
          bottom: -40px; left: -40px;
          width: 160px; height: 160px;
          background: radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%);
          border-radius: 50%;
        }

        .hero-inner { position: relative; z-index: 1; }

        .hero-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .balance-label {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 10px;
        }

        .balance-amount {
          font-family: 'Syne', sans-serif;
          font-size: 56px;
          font-weight: 800;
          letter-spacing: -3px;
          color: #fff;
          line-height: 1;
        }

        .balance-currency { font-size: 28px; color: rgba(255,255,255,0.5); letter-spacing: -1px; margin-right: 4px; }

        .balance-cents { font-size: 28px; color: rgba(255,255,255,0.4); }

        .sparkline-wrap { margin-top: 8px; }

        .hero-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 20px 32px;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .hero-stat {
          min-width: 120px;
        }
        .hero-stat-val { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #fff; }
        .hero-stat-label { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.4px; }

        .hero-badge {
          display: flex; align-items: center; gap: 6px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 100px;
          padding: 6px 14px;
          font-size: 12px; font-weight: 500; color: #6ee7b7;
          white-space: nowrap;
        }

        /* ── CARD ── */
        .card {
          background: rgba(255,255,255,0.028);
          border: 1px solid rgba(255,255,255,0.065);
          border-radius: 18px;
          padding: 24px;
          animation: fadeUp 0.4s ease both;
        }

        .card-header {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .card-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700;
          color: #fff; letter-spacing: -0.3px;
        }

        .card-sub { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 3px; }

        /* ── FILTERS ── */
        .filter-tabs {
          display: flex; gap: 6px;
          flex-wrap: wrap;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 4px;
        }

        .filter-tab {
          padding: 6px 14px;
          border-radius: 7px;
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          transition: all 0.15s;
          border: none; background: none;
          font-family: 'DM Sans', sans-serif;
        }

        .filter-tab.active {
          background: rgba(255,255,255,0.08);
          color: #fff;
          font-weight: 500;
        }

        /* ── TX LIST ── */
        .tx-list { display: flex; flex-direction: column; }

        .tx-date-group { margin-bottom: 4px; }

        .tx-date-label {
          font-size: 11px;
          color: rgba(255,255,255,0.25);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 12px 0 6px;
          font-weight: 500;
        }

        .tx-item {
          display: flex; align-items: center; gap: 14px;
          padding: 13px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
          border-radius: 8px;
          cursor: pointer;
        }

        .tx-item:hover { background: rgba(255,255,255,0.025); padding-left: 8px; padding-right: 8px; }
        .tx-item:last-child { border-bottom: none; }

        .tx-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: rgba(255,255,255,0.75);
        }
        .tx-icon svg { flex-shrink: 0; }

        .tx-icon.credit { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.15); }
        .tx-icon.debit  { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); }

        .tx-info { flex: 1; min-width: 0; }

        .tx-desc {
          font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.85);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .tx-meta {
          display: flex; gap: 10px; margin-top: 3px;
        }

        .tx-type-badge {
          font-size: 10px;
          padding: 2px 7px; border-radius: 4px;
          font-weight: 500;
        }

        .tx-time { font-size: 11px; color: rgba(255,255,255,0.25); }

        .tx-amount {
          font-family: 'DM Mono', monospace;
          font-size: 14px; font-weight: 500;
          text-align: right; flex-shrink: 0;
        }

        .tx-amount.credit { color: #6ee7b7; }
        .tx-amount.debit  { color: rgba(255,255,255,0.65); }

        .tx-balance-after {
          font-size: 11px; color: rgba(255,255,255,0.25);
          font-family: 'DM Mono', monospace;
          margin-top: 2px; text-align: right;
        }

        /* ── TOP-UP PANEL ── */
        .topup-amounts {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 8px; margin-bottom: 16px;
        }

        .amount-btn {
          padding: 12px 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 11px;
          font-size: 15px; font-weight: 600;
          color: rgba(255,255,255,0.65);
          cursor: pointer; transition: all 0.15s;
          font-family: 'Syne', sans-serif;
          text-align: center;
        }

        .amount-btn:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); color: #a5b4fc; }
        .amount-btn.selected { background: rgba(99,102,241,0.15); border-color: #6366f1; color: #a5b4fc; }

        .custom-input-wrap {
          position: relative;
          margin-bottom: 14px;
          border-radius: 11px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .custom-input-prefix {
          position: absolute; left: 14px; top: 50%;
          transform: translateY(-50%);
          font-size: 16px; color: rgba(255,255,255,0.4);
          font-family: 'Syne', sans-serif; font-weight: 700;
        }

        .custom-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 11px;
          padding: 13px 16px 13px 32px;
          font-size: 16px; font-weight: 600;
          color: #fff; outline: none;
          font-family: 'DM Mono', monospace;
          transition: border-color 0.2s;
          overflow: hidden;
          -moz-appearance: textfield;
          appearance: textfield;
        }

        .custom-input::-webkit-outer-spin-button,
        .custom-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .custom-input:focus { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.04); }
        .custom-input::placeholder { color: rgba(255,255,255,0.15); font-weight: 400; }

        .topup-summary {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 11px;
          padding: 14px 16px;
          margin-bottom: 14px;
          display: flex; flex-direction: column; gap: 8px;
        }

        .summary-row {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 13px;
        }

        .summary-label { color: rgba(255,255,255,0.4); }
        .summary-val { color: #fff; font-weight: 500; }
        .summary-val.highlight { color: #6ee7b7; font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; }

        .topup-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none; border-radius: 12px;
          font-size: 15px; font-weight: 700;
          color: #fff; cursor: pointer;
          font-family: 'Syne', sans-serif;
          transition: opacity 0.15s, transform 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }

        .topup-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .topup-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

        .success-banner {
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px; font-weight: 500; color: #6ee7b7;
          display: flex; align-items: center; gap: 8px;
          animation: fadeUp 0.3s ease;
          margin-bottom: 14px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        /* ── AUTO-RELOAD ── */
        .autoreload-card {
          background: rgba(255,255,255,0.028);
          border: 1px solid rgba(255,255,255,0.065);
          border-radius: 18px;
          padding: 22px;
          animation: fadeUp 0.4s ease both;
          animation-delay: 0.08s;
        }

        .reload-toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px;
        }

        .reload-title-group {}
        .reload-title { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: #fff; }
        .reload-sub { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 3px; }

        .toggle {
          width: 44px; height: 24px;
          background: rgba(255,255,255,0.1);
          border-radius: 12px;
          position: relative; cursor: pointer;
          transition: background 0.2s;
          border: none; outline: none; flex-shrink: 0;
        }
        .toggle.on { background: #6366f1; }
        .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
        .toggle.on .toggle-thumb { transform: translateX(20px); }

        .reload-settings {
          display: flex; flex-direction: column; gap: 14px;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 16px;
        }

        .range-field {}
        .range-label-row {
          display: flex; justify-content: space-between;
          font-size: 13px; margin-bottom: 8px;
        }
        .range-label-row span:first-child { color: rgba(255,255,255,0.5); }
        .range-label-row span:last-child { color: #fff; font-weight: 600; font-family: 'Syne', sans-serif; }

        input[type=range] {
          width: 100%; -webkit-appearance: none;
          height: 4px; background: rgba(255,255,255,0.1);
          border-radius: 2px; outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: #6366f1; cursor: pointer;
        }

        .reload-summary {
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.15);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.6;
        }

        .reload-summary strong { color: #a5b4fc; font-weight: 500; }

        .save-reload-btn {
          width: 100%; padding: 11px;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 10px;
          color: #a5b4fc; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'Syne', sans-serif;
          transition: all 0.15s;
        }
        .save-reload-btn:hover { background: rgba(99,102,241,0.25); color: #fff; }
        /* ── EMPTY STATE ── */
        .empty-tx {
          text-align: center; padding: 40px 20px;
          color: rgba(255,255,255,0.25);
        }

        @media (max-width: 900px) {
          .wl-body {
            grid-template-columns: 1fr;
            grid-template-areas: "side" "main";
            padding: 20px 16px;
          }
          .wl-right {
            position: static;
            top: auto;
          }
          .hero-stats {
            gap: 16px;
          }
          .topup-amounts { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      <div className="wl-root">
        {/* ── NAV ── */}
        {/* <Navbar /> */}

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh", color: "rgba(255,255,255,0.45)" }}>
            Loading wallet…
          </div>
        ) : loadError ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, minHeight: "50vh", padding: 24, color: "#fca5a5", fontSize: 14 }}>
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
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Retry
            </button>
          </div>
        ) : (
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
                      <span className="balance-cents">.{String(balanceNum % 100).padStart(2, "0")}</span>
                    </div>
                    <div className="sparkline-wrap">
                      <Sparkline values={sparkValues} color="rgba(99,102,241,0.6)" />
                    </div>
                  </div>
                  <div className="hero-badge">
                    <CheckCircle2 size={12} strokeWidth={2} aria-hidden />
                    {wallet?.auto_reload_enabled ? "Auto-reload on" : "Auto-reload off"}
                  </div>
                </div>
                <div className="hero-stats">
                  <div className="hero-stat">
                    <div className="hero-stat-val" style={{ color: "#6ee7b7" }}>+${(totalIn / 100).toLocaleString()}</div>
                    <div className="hero-stat-label">Total funded</div>
                  </div>
                  <div className="hero-stat">
                    <div className="hero-stat-val" style={{ color: "rgba(255,255,255,0.7)" }}>${(totalOut / 100).toLocaleString()}</div>
                    <div className="hero-stat-label">Total spent</div>
                  </div>
                  <div className="hero-stat">
                    <div className="hero-stat-val" style={{ color: isDeliveryPaused ? "#ef4444" : isWalletLow ? "#f59e0b" : undefined }}>
                      {leadsCanAfford}
                    </div>
                    <div className="hero-stat-label">Leads you can afford</div>
                  </div>
                  <div className="hero-stat">
                    <div className="hero-stat-val">${(effectiveLeadPriceCents / 100).toFixed(0)}</div>
                    <div className="hero-stat-label">{isPro ? "Shared lead price" : "Exclusive lead price"}</div>
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
              <div style={{
                padding: "14px 18px", borderRadius: 12,
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🚫</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>Lead delivery paused</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      Your balance is below the ${(effectiveLeadPriceCents / 100).toFixed(0)} {isPro ? "shared" : "exclusive"} lead price. Add funds to restart delivery.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-add-funds"
                  onClick={() => setSelectedAmount(100)}
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#ef4444", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Add Funds
                </button>
              </div>
            )}
            {isWalletLow && !isDeliveryPaused && (
              <div style={{
                padding: "14px 18px", borderRadius: 12,
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fde68a" }}>Wallet running low</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      You can afford about {leadsCanAfford} more {leadsCanAfford === 1 ? "lead" : "leads"}. Add funds to avoid delivery pausing.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAmount(100)}
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#f59e0b", color: "#000", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Add Funds
                </button>
              </div>
            )}

            {/* Cancelled subscription — exclusive-only notice */}
            {subscription?.status === "cancelled" && balanceNum > 0 && (
              <div style={{
                padding: "14px 18px", borderRadius: 12,
                background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.28)",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc", marginBottom: 4 }}>
                    Your wallet balance is still usable
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>
                    Your Pro subscription has expired, but your remaining ${(balanceNum / 100).toFixed(2)} can still be used
                    to purchase <strong style={{ color: "#fff" }}>exclusive leads</strong> from the marketplace.
                    Shared (non-exclusive) lead purchases require an active subscription.
                    <a href="/subscriptions" style={{ color: "#a5b4fc", marginLeft: 6, textDecoration: "underline" }}>
                      Reactivate to unlock shared leads →
                    </a>
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
                    {txTotalCount} total
                    {txTotalCount > 0
                      ? ` · rows ${txRangeLabel}`
                      : ""}
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
                      {f === "all" ? "All" : f === "credit" ? "Credits" : "Debits"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tx-list">
                {txs.length === 0 ? (
                  <div className="empty-tx">No transactions found.</div>
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
                              background: tx.type === "credit" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                              color: tx.type === "credit" ? "#6ee7b7" : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {refLabel(tx.reference_type)}
                          </span>
                          <span className="tx-time">{timeAgo(tx.created_at)}</span>
                        </div>
                      </div>
                      <div>
                        <div className={`tx-amount ${tx.type}`}>
                          {tx.type === "credit" ? "+" : "−"}${(centsToNumber(tx.amount_cents) / 100).toFixed(2)}
                        </div>
                        <div className="tx-balance-after">
                          bal. ${(centsToNumber(tx.balance_after_cents) / 100).toFixed(0)}
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
                      onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
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
                <Landmark size={20} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.22)" }} aria-hidden />
              </div>

              {topupError && (
                <div className="success-banner" style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)", color: "#fca5a5" }}>
                  {topupError}
                </div>
              )}
              {success && (
                <div className="success-banner">
                  <Check size={16} strokeWidth={2.5} aria-hidden />
                  Wallet funded successfully!
                </div>
              )}

              <div className="topup-amounts">
                {TOP_UP_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    className={`amount-btn ${selectedAmount === a ? "selected" : ""}`}
                    onClick={() => { setSelectedAmount(a); setCustomAmount(""); }}
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
                  onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                />
              </div>

              <label className="save-card-row">
                <input
                  type="checkbox"
                  checked={saveCardForAutoReload}
                  onChange={(e) => setSaveCardForAutoReload(e.target.checked)}
                  aria-label="Save this card for auto-reload"
                />
                <span className="save-card-check" aria-hidden>
                  {saveCardForAutoReload ? (
                    <Check size={14} strokeWidth={3} color="#ffffff" />
                  ) : null}
                </span>
                <div className="save-card-copy">
                  <div className="save-card-title">Save card for auto-reload</div>
                  <div className="save-card-desc">
                    Securely stores this card with Stripe for instant refills and automatic wallet top-ups.
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
                    <span className="summary-val">${finalAmount.toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Current balance</span>
                    <span className="summary-val">${(balanceNum / 100).toFixed(2)}</span>
                  </div>
                  <div className="summary-row" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 4 }}>
                    <span className="summary-label">New balance</span>
                    <span className="summary-val highlight">${((balanceNum / 100) + finalAmount).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                Your card is charged with Stripe; your wallet updates as soon as payment succeeds (webhooks stay in sync).
              </p>
            </div>

            {/* Auto-reload — unlocks only after saving a card via the top-up checkbox */}
            <div className="autoreload-card">
              <div className="reload-toggle-row">
                <div className="reload-title-group">
                  <div className="reload-title">Auto-reload</div>
                  <div className="reload-sub">Automatically refill your wallet</div>
                </div>
                {autoReloadOptIn ? (
                  <button
                    type="button"
                    className={`toggle ${autoReload ? "on" : ""}`}
                    onClick={() => setAutoReload(!autoReload)}
                    aria-label={autoReload ? "Turn off auto-reload" : "Turn on auto-reload"}
                  >
                    <div className="toggle-thumb" />
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.28)",
                    }}
                  >
                    {hasSavedCard
                      ? "Card saved (unlock with checkbox)"
                      : "Save card first"}
                  </span>
                )}
              </div>

              {!autoReloadOptIn ? (
                <p
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.48)",
                    lineHeight: 1.6,
                    marginTop: 4,
                  }}
                >
                  {hasSavedCard ? (
                    <>
                      Your card is saved, but auto-reload unlocks only after you
                      complete a wallet top-up and check{" "}
                      <strong style={{ color: "rgba(255,255,255,0.78)" }}>
                        Save this card for auto-reload
                      </strong>
                      .
                    </>
                  ) : (
                    <>
                      To use auto-reload, add funds above and check{" "}
                      <strong style={{ color: "rgba(255,255,255,0.78)" }}>
                        Save this card for auto-reload
                      </strong>{" "}
                      before completing payment. That stores your card for automatic refills and unlocks these settings.
                    </>
                  )}
                </p>
              ) : null}

              {autoReloadOptIn && autoReload && (
                <div className="reload-settings">
                  <div className="range-field">
                    <div className="range-label-row">
                      <span>Reload when balance drops below</span>
                      <span>${reloadThreshold}</span>
                    </div>
                    <input
                      type="range" min={50} max={500} step={50}
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
                      type="range" min={100} max={2000} step={100}
                      value={reloadAmount}
                      onChange={(e) => setReloadAmount(+e.target.value)}
                    />
                  </div>
                  <div className="reload-summary">
                    When your balance falls below <strong>${reloadThreshold}</strong>, we'll automatically charge your saved card and add <strong>${reloadAmount}</strong> to your wallet.
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                    The server checks every few minutes when your balance is low.
                  </p>
                  {autoReloadSaveError ? (
                    <p style={{ fontSize: 12, color: "#fca5a5", marginBottom: 8, lineHeight: 1.45 }}>
                      {autoReloadSaveError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="save-reload-btn"
                    disabled={autoReloadMutation.isPending}
                    onClick={() => void handleSaveAutoReload()}
                  >
                    {autoReloadMutation.isPending ? "Saving…" : "Save auto-reload settings"}
                  </button>
                </div>
              )}
            </div>

            <div className="card" style={{ animationDelay: "0.12s" }}>
              <div className="card-header">
                <div className="card-title">Payment method</div>
              </div>
              {wallet?.stripe_payment_method_id ? (
                pmPreviewLoading ? (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "10px 0" }}>
                    Loading card…
                  </div>
                ) : pmPreview?.paymentMethod ? (
                  <div className="pm-card">
                    <div className="pm-card-icon">
                      <CreditCard size={22} strokeWidth={1.75} aria-hidden />
                    </div>
                    <div className="pm-card-lines">
                      <div className="pm-card-brand">
                        {formatCardBrand(pmPreview.paymentMethod.brand)}
                      </div>
                      <div className="pm-card-number">
                        •••• •••• •••• {pmPreview.paymentMethod.last4}
                      </div>
                      <div className="pm-card-exp">
                        Expires{" "}
                        {String(pmPreview.paymentMethod.exp_month).padStart(2, "0")}/
                        {String(pmPreview.paymentMethod.exp_year).slice(-2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", padding: "8px 0", lineHeight: 1.5 }}>
                    Card on file — masked details unavailable right now. Saved payments still work.
                  </div>
                )
              ) : (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0", lineHeight: 1.5 }}>
                  No card on file. Add funds and enable “Save card for auto-reload” to store a card.
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </>
  );
}