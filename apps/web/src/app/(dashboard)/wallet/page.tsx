"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type WalletTransactionDto,
  getWalletMe,
  getWalletTransactions,
  postWalletTopup,
  centsToNumber,
  dollarsInputToCents,
} from "@/lib/wallet-api";
import { queryKeys } from "@/lib/query-keys";
import Navbar from "@/components/Navbar";

const TOP_UP_AMOUNTS = [50, 100, 250, 500, 1000, 2500];

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

function refIcon(type: string) {
  const icons: Record<string, string> = {
    lead_purchase: "📋",
    stripe_topup: "💳",
    dev_topup: "💳",
    onboarding_initial: "🎉",
    subscription: "⭐",
    auto_buy: "🤖",
    admin_credit: "🎁",
    refund: "↩️",
  };
  return icons[type] || "💫";
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
  const txQueryOpts = { limit: 50, offset: 0 } as const;

  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletIsError,
    error: walletError,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: queryKeys.wallet.me,
    queryFn: getWalletMe,
  });

  const {
    data: txs = [],
    isLoading: txsLoading,
    isError: txsIsError,
    error: txsError,
    refetch: refetchTxs,
  } = useQuery({
    queryKey: queryKeys.wallet.transactions(txQueryOpts),
    queryFn: () => getWalletTransactions(txQueryOpts),
  });

  const loading = walletLoading || txsLoading;
  const loadError =
    walletIsError || txsIsError
      ? (walletError ?? txsError) instanceof Error
        ? (walletError ?? txsError)!.message
        : "Failed to load wallet"
      : null;

  const topupMutation = useMutation({
    mutationFn: postWalletTopup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.wallet.transactions(txQueryOpts),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });

  const [topupError, setTopupError] = useState<string | null>(null);

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [success, setSuccess] = useState(false);
  const [autoReload, setAutoReload] = useState(false);
  const [reloadThreshold, setReloadThreshold] = useState(100);
  const [reloadAmount, setReloadAmount] = useState(500);
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");

  const balanceCents = wallet?.balance_cents ?? "0";
  const balanceNum = centsToNumber(balanceCents);

  const finalAmount = selectedAmount ?? (customAmount ? +customAmount : 0);

  const filteredTxs = txs.filter((t) => filter === "all" || t.type === filter);

  const totalIn = txs
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + centsToNumber(t.amount_cents), 0);
  const totalOut = txs
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + centsToNumber(t.amount_cents), 0);

  const sparkValues = useMemo(
    () => sparklineFromTransactions(txs, balanceCents),
    [txs, balanceCents],
  );

  useEffect(() => {
    if (!wallet) return;
    setAutoReload(wallet.auto_reload_enabled);
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

  async function handleTopUp() {
    if (!finalAmount || finalAmount < 10) return;
    setTopupError(null);
    try {
      await topupMutation.mutateAsync({
        amount_cents: dollarsInputToCents(finalAmount),
        description: "Wallet top-up (demo)",
      });
      setSuccess(true);
      setSelectedAmount(null);
      setCustomAmount("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setTopupError(e instanceof Error ? e.message : "Top-up failed");
    }
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
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 380px;
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 32px 24px;
          gap: 24px;
          align-items: start;
        }

        .wl-left { display: flex; flex-direction: column; gap: 20px; }
        .wl-right { display: flex; flex-direction: column; gap: 20px; position: sticky; top: 88px; }

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
          gap: 32px;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .hero-stat {}
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
          font-size: 18px; flex-shrink: 0;
        }

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
::-webkit-scrollbar {
  width: 6px; /* Slim width */
}

::-webkit-scrollbar-track {
  background: #080a0f; /* Match your background */
}

::-webkit-scrollbar-thumb {
  background: #1a1d26; /* Dark grey/black thumb */
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #252936; /* Slightly lighter on hover */
}

/* For Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #1a1d26 #080a0f;
}
        /* ── EMPTY STATE ── */
        .empty-tx {
          text-align: center; padding: 40px 20px;
          color: rgba(255,255,255,0.25);
        }

        @media (max-width: 900px) {
          .wl-body { grid-template-columns: 1fr; padding: 20px 16px; }
          .wl-right { position: static; }
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
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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
                    <div className="hero-stat-val">{txs.length}</div>
                    <div className="hero-stat-label">Transactions</div>
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

            {/* Transaction history */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Transaction history</div>
                  <div className="card-sub">{filteredTxs.length} transactions</div>
                </div>
                <div className="filter-tabs">
                  {(["all", "credit", "debit"] as const).map((f) => (
                    <button key={f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                      {f === "all" ? "All" : f === "credit" ? "Credits" : "Debits"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tx-list">
                {filteredTxs.length === 0 ? (
                  <div className="empty-tx">No transactions found.</div>
                ) : (
                  filteredTxs.map((tx) => (
                    <div key={tx.id} className="tx-item">
                      <div className={`tx-icon ${tx.type}`}>
                        {refIcon(tx.reference_type)}
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
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="wl-right">
            {/* Add funds */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Add funds</div>
                  <div className="card-sub">Dev top-up (demo) · Stripe checkout coming soon</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M20 12V22H4V12" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 7H2V12H22V7Z" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 22V7" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 7H7.5C6.83696 7 6.20107 6.73661 5.73223 6.26777C5.26339 5.79893 5 5.16304 5 4.5C5 3.83696 5.26339 3.20107 5.73223 2.73223C6.20107 2.26339 6.83696 2 7.5 2C11 2 12 7 12 7Z" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 7H16.5C17.163 7 17.7989 6.73661 18.2678 6.26777C18.7366 5.79893 19 5.16304 19 4.5C19 3.83696 18.7366 3.20107 18.2678 2.73223C17.7989 2.26339 17.163 2 16.5 2C13 2 12 7 12 7Z" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {topupError && (
                <div className="success-banner" style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)", color: "#fca5a5" }}>
                  {topupError}
                </div>
              )}
              {success && (
                <div className="success-banner">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
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

              <button
                className="topup-btn"
                disabled={!finalAmount || finalAmount < 10 || topupMutation.isPending}
                onClick={handleTopUp}
              >
                {topupMutation.isPending ? (
                  <><div className="spinner" /> Processing…</>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {finalAmount > 0 ? `Add $${finalAmount} to wallet` : "Select an amount"}
                  </>
                )}
              </button>

              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                Dev top-up credits your wallet immediately. Stripe payment UI will replace this flow later.
              </p>
            </div>

            {/* Auto-reload */}
            <div className="autoreload-card">
              <div className="reload-toggle-row">
                <div className="reload-title-group">
                  <div className="reload-title">Auto-reload</div>
                  <div className="reload-sub">Automatically refill your wallet</div>
                </div>
                <button className={`toggle ${autoReload ? "on" : ""}`} onClick={() => setAutoReload(!autoReload)}>
                  <div className="toggle-thumb" />
                </button>
              </div>

              {autoReload && (
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
                    Preview only — saving auto-reload requires a Stripe-backed API (not wired yet). Values above reflect your account when loaded from the server.
                  </p>
                  <button type="button" className="save-reload-btn" disabled style={{ opacity: 0.45, cursor: "not-allowed" }}>
                    Save auto-reload settings
                  </button>
                </div>
              )}
            </div>

            {/* Saved card — Stripe not wired; show server state only */}
            <div className="card" style={{ animationDelay: "0.12s" }}>
              <div className="card-header">
                <div className="card-title">Payment method</div>
                <button type="button" disabled style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 12, cursor: "not-allowed", fontFamily: "'DM Sans', sans-serif" }}>
                  Change
                </button>
              </div>
              {wallet?.stripe_payment_method_id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}>
                    Saved method ID: {wallet.stripe_payment_method_id.slice(0, 12)}…
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "8px 0", lineHeight: 1.5 }}>
                  No card on file. Add a payment method when Stripe checkout is connected.
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