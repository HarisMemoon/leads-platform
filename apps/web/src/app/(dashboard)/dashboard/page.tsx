"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  Bot,
  Check,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Link2,
  Plug,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { centsToNumber } from "@/lib/wallet-api";
import { patchOnboardingMe } from "@/lib/onboarding-api";
import type { ActivityFeedIconKind } from "@/lib/dashboard-data";
import {
  activityFromTransactions,
  debitSpendThisMonthDollars,
  fetchDashboardSummary,
  last7DayLabels,
  leadPurchaseCountThisMonth,
  weeklyTxCounts,
} from "@/lib/dashboard-data";
import { queryKeys } from "@/lib/query-keys";

/** Lucide stroke icons accept these props */
type IconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean | "true";
}>;

function ActivityFeedIcon({ kind }: { kind: ActivityFeedIconKind }) {
  const p = { size: 14, strokeWidth: 2, "aria-hidden": true as const };
  switch (kind) {
    case "wallet_credit":
      return <CreditCard {...p} />;
    case "lead_purchase":
      return <ClipboardList {...p} />;
    case "auto_buy":
      return <Bot {...p} />;
    case "subscription":
      return <Sparkles {...p} />;
    default:
      return <ArrowDownLeft {...p} />;
  }
}
// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data, days }: { data: number[]; days: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        height: 80,
        padding: "0 4px",
      }}
    >
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${(v / max) * 64}px`,
              background:
                i === 6
                  ? "linear-gradient(to top, #6366f1, #8b5cf6)"
                  : "rgba(255,255,255,0.08)",
              borderRadius: 4,
              transition: "height 0.6s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {i === 6 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(99,102,241,0.8), rgba(139,92,246,0.4))",
                  animation: "shimmer 2s ease-in-out infinite",
                }}
              />
            )}
          </div>
          <span
            style={{
              fontSize: 10,
              color: i === 6 ? "#a5b4fc" : "rgba(255,255,255,0.25)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {days[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Radial Progress ─────────────────────────────────────────────────────────
function RadialProgress({
  value,
  max,
  color,
  size = 80,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
}) {
  const pct = Math.min(value / max, 1);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: fetchDashboardSummary,
  });

  const me = data?.me;
  const wallet = data?.wallet;
  const onboarding = data?.onboarding;
  const txs = data?.txs ?? [];
  const subscription = data?.subscription;
  const recentLeads = data?.recentLeads?.items ?? [];

  const walletBalance = wallet ? centsToNumber(wallet.balance_cents) : 0;
  const leadsThisMonth =
    subscription?.leads_used_this_period ?? leadPurchaseCountThisMonth(txs);
  const leadsLimit = subscription?.monthly_lead_limit ?? 50;
  const spendThisMonthDollars = debitSpendThisMonthDollars(txs);
  const spendLimit = 3000;

  const obData = (onboarding?.data ?? {}) as Record<string, unknown>;
  const autoBuy = Boolean(obData.auto_buy);
  const maxPerDay =
    typeof obData.max_per_day === "number" ? obData.max_per_day : 3;
  const minBalanceDollars =
    typeof obData.min_balance === "number" ? obData.min_balance : 200;

  const weeklyData = weeklyTxCounts(txs);
  const dayLabels = last7DayLabels();
  const activityItems = activityFromTransactions(txs);
  const weeklyTxSum = weeklyData.reduce((a, b) => a + b, 0);

  const toggleAutoBuy = useMutation({
    mutationFn: (next: boolean) =>
      patchOnboardingMe({
        data: { ...obData, auto_buy: next },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.me });
    },
  });

  const avatarLetter = (me?.email?.[0] ?? "U").toUpperCase();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .db-root {
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
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(8,10,15,0.96);
          backdrop-filter: blur(16px);
        }

        .nav-left { display: flex; align-items: center; gap: 28px; }

        .brand {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none;
        }

        .brand-icon {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, #6366f1, #10b981);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 16px; font-weight: 700; color: #fff;
        }

        .nav-links { display: flex; gap: 2px; }

        .nav-link {
          padding: 7px 13px;
          border-radius: 8px;
          font-size: 13px;
          color: rgba(255,255,255,0.42);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
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
          font-size: 13px; color: #6ee7b7; font-weight: 500;
          text-decoration: none;
          transition: background 0.15s;
        }
        .wallet-pill:hover { background: rgba(16,185,129,0.15); }
        .notif-btn {
          width: 34px; height: 34px;
          border-radius: 9px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: rgba(255,255,255,0.45);
          position: relative; transition: background 0.15s;
        }
        .notif-btn:hover { background: rgba(255,255,255,0.09); }

        .notif-dot {
          position: absolute; top: 7px; right: 7px;
          width: 6px; height: 6px;
          background: #ef4444; border-radius: 50%;
          border: 1.5px solid #080a0f;
        }

        .avatar {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; cursor: pointer;
        }

        /* ── BODY ── */
        .db-body {
          flex: 1;
          display: grid;
          grid-template-columns: 220px 1fr 300px;
          min-height: calc(100vh - 64px);
        }

        /* ── SIDEBAR ── */
        .sidebar {
          border-right: 1px solid rgba(255,255,255,0.05);
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          position: sticky;
          top: 88px;
          height: calc(100vh - 88px);
          overflow-y: auto;
        }

        .sidebar-section-label {
          font-size: 10px;
          font-weight: 500;
          color: rgba(255,255,255,0.22);
          letter-spacing: 0.9px;
          text-transform: ;
          padding: 14px 12px 6px;
        }

        .sidebar-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px;
          border-radius: 9px;
          font-size: 13px;
          color: rgba(255,255,255,0.42);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
          border: 1px solid transparent;
        }

        .sidebar-item:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.75); }

        .sidebar-item.active {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.18);
          color: #a5b4fc;
        }

        .sidebar-item svg { flex-shrink: 0; }

        .sidebar-badge {
          margin-left: auto;
          font-size: 10px;
          background: rgba(99,102,241,0.2);
          color: #a5b4fc;
          border-radius: 4px;
          padding: 2px 6px;
          font-weight: 600;
        }

        /* ── MAIN ── */
        .main-content {
          padding: 28px 28px;
          overflow-y: auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 28px;
          animation: fadeUp 0.4s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .greeting { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.8px; color: #fff; }
        .greeting-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }

        .header-actions { display: flex; gap: 10px; }

        .btn-secondary {
          padding: 9px 18px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          color: rgba(255,255,255,0.65);
          font-size: 13px; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
          text-decoration: none;
          display: flex; align-items: center; gap: 6px;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.09); color: #fff; }

        .btn-primary {
          padding: 9px 18px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-size: 13px; font-weight: 600; cursor: pointer;
          font-family: 'Syne', sans-serif;
          transition: opacity 0.15s, transform 0.15s;
          display: flex; align-items: center; gap: 6px;
          text-decoration: none;
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── STAT CARDS ROW ── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: rgba(255,255,255,0.028);
          border: 1px solid rgba(255,255,255,0.065);
          border-radius: 16px;
          padding: 20px;
          transition: border-color 0.2s, transform 0.2s;
          animation: fadeUp 0.4s ease both;
          cursor: default;
          position: relative;
          overflow: hidden;
        }

        .stat-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        }

        .stat-card:hover { border-color: rgba(255,255,255,0.12); transform: translateY(-2px); }

        .stat-icon {
          width: 36px; height: 36px;
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
          color: rgba(255,255,255,0.88);
        }
        .stat-icon svg { flex-shrink: 0; }

        .stat-value {
          font-family: 'Syne', sans-serif;
          font-size: 28px; font-weight: 800;
          letter-spacing: -1px;
          color: #fff;
          line-height: 1;
          margin-bottom: 5px;
        }

        .stat-label { font-size: 12px; color: rgba(255,255,255,0.38); margin-bottom: 8px; }

        .stat-delta {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 500;
          padding: 3px 8px; border-radius: 100px;
        }

        .delta-up   { background: rgba(16,185,129,0.1); color: #6ee7b7; }
        .delta-down { background: rgba(239,68,68,0.1);  color: #fca5a5; }
        .delta-neu  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }

        /* ── MID GRID ── */
        .mid-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 20px;
        }

        .card {
          background: rgba(255,255,255,0.028);
          border: 1px solid rgba(255,255,255,0.065);
          border-radius: 16px;
          padding: 22px;
          animation: fadeUp 0.4s ease both;
        }

        .card-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 18px;
        }

        .card-title {
          font-family: 'Syne', sans-serif;
          font-size: 14px; font-weight: 700;
          color: #fff; letter-spacing: -0.3px;
        }

        .card-action {
          font-size: 12px; color: #6366f1;
          text-decoration: none; cursor: pointer;
          transition: opacity 0.15s;
        }
        .card-action:hover { opacity: 0.75; }

        /* ── AUTO-BUY CARD ── */
        .autobuy-status {
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 12px;
        }

        .autobuy-info {}
        .autobuy-label { font-size: 14px; font-weight: 500; color: #fff; }
        .autobuy-sub { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 2px; }

        .toggle {
          width: 44px; height: 24px;
          background: rgba(255,255,255,0.1);
          border-radius: 12px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
          border: none; outline: none; flex-shrink: 0;
        }
        .toggle.on { background: #6366f1; }
        .toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 18px; height: 18px;
          background: #fff; border-radius: 50%;
          transition: transform 0.2s;
        }
        .toggle.on .toggle-thumb { transform: translateX(20px); }

        .autobuy-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

        .autobuy-stat {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 12px;
          text-align: center;
        }

        .autobuy-stat-val { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #fff; }
        .autobuy-stat-label { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 3px; text-transform: ; letter-spacing: 0.4px; }

        /* ── PROGRESS CARD ── */
        .progress-items { display: flex; flex-direction: column; gap: 14px; }

        .progress-item { display: flex; flex-direction: column; gap: 6px; }

        .progress-row {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 13px;
        }

        .progress-name { color: rgba(255,255,255,0.6); }
        .progress-vals { color: rgba(255,255,255,0.4); font-size: 12px; }
        .progress-vals span { color: #fff; font-weight: 500; }

        .progress-track {
          height: 5px;
          background: rgba(255,255,255,0.07);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 1s ease;
        }

        /* ── WEEKLY CHART CARD ── */
        .chart-card { grid-column: span 2; }

        .chart-meta {
          display: flex; gap: 24px; margin-bottom: 20px;
        }

        .chart-meta-item {}
        .chart-meta-val { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #fff; }
        .chart-meta-label { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px; }

        /* ── INTEGRATIONS ── */
        .integ-list { display: flex; flex-direction: column; gap: 8px; }

        .integ-item {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 11px;
          padding: 12px 14px;
          transition: border-color 0.15s;
        }
        .integ-item:hover { border-color: rgba(255,255,255,0.1); }

        .integ-icon {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: rgba(255,255,255,0.75);
        }
        .integ-icon svg { flex-shrink: 0; }

        .integ-info { flex: 1; }
        .integ-name { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.8); }
        .integ-status { font-size: 11px; margin-top: 2px; }

        .integ-dot { width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; display: inline-block; }

        /* ── LEADS TABLE ── */
        .leads-table-wrap { overflow-x: auto; }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead th {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.3);
          text-transform: ;
          letter-spacing: 0.5px;
          padding: 0 10px 12px;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        tbody tr {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
          cursor: pointer;
        }

        tbody tr:hover { background: rgba(255,255,255,0.03); }
        tbody tr:last-child { border-bottom: none; }

        tbody td {
          padding: 13px 10px;
          font-size: 13px;
          color: rgba(255,255,255,0.65);
          white-space: nowrap;
        }

        .td-title { color: #fff; font-weight: 500; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }

        .badge {
          display: inline-flex; align-items: center;
          font-size: 11px; font-weight: 500;
          padding: 3px 10px; border-radius: 100px;
        }

        .ghl-dot { width: 5px; height: 5px; border-radius: 50%; margin-right: 5px; }

        /* ── RIGHT PANEL ── */
        .right-panel {
          border-left: 1px solid rgba(255,255,255,0.05);
          padding: 24px 18px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: sticky;
          top: 88px;
          height: calc(100vh - 88px);
          overflow-y: auto;
        }

        .panel-section {}

        .panel-title {
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 700;
          color: #fff; margin-bottom: 12px;
          letter-spacing: -0.2px;
        }

        /* wallet mini card */
        .wallet-card {
          background: linear-gradient(135deg, rgba(99,102,241,0.18), rgba(16,185,129,0.1));
          border: 1px solid rgba(99,102,241,0.22);
          border-radius: 14px;
          padding: 18px;
        }

        .wallet-balance-label { font-size: 11px; color: rgba(255,255,255,0.4); text-transform: ; letter-spacing: 0.6px; margin-bottom: 6px; }
        .wallet-balance-val { font-family: 'Syne', sans-serif; font-size: 30px; font-weight: 800; color: #fff; letter-spacing: -1px; }
        .wallet-currency { font-size: 16px; color: rgba(255,255,255,0.55); margin-right: 3px; }

        .wallet-meta { display: flex; gap: 16px; margin-top: 12px; }
        .wallet-meta-item {}
        .wallet-meta-val { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); }
        .wallet-meta-label { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; }

        .add-funds-btn {
          width: 100%;
          margin-top: 14px;
          padding: 11px;
          background: rgba(99,102,241,0.2);
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 10px;
          color: #a5b4fc;
          font-size: 13px; font-weight: 600;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          transition: all 0.15s;
          text-decoration: none;
          display: block; text-align: center;
        }
        .add-funds-btn:hover { background: rgba(99,102,241,0.3); color: #fff; }

        /* activity feed */
        .activity-feed { display: flex; flex-direction: column; gap: 2px; }

        .activity-item {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 10px 10px;
          border-radius: 9px;
          transition: background 0.15s;
        }
        .activity-item:hover { background: rgba(255,255,255,0.03); }

        .activity-icon {
          flex-shrink: 0;
          width: 28px; height: 28px; border-radius: 8px;
          background: rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.55);
          margin-top: 1px;
        }
        .activity-icon svg { flex-shrink: 0; }

        .activity-msg { font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.5; }
        .activity-time { font-size: 11px; color: rgba(255,255,255,0.22); margin-top: 3px; }

        /* subscription pill */
        .sub-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 16px;
        }

        .sub-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
        }

        .sub-plan-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #fff; }
        .sub-plan-badge {
          font-size: 10px; font-weight: 600;
          background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2));
          border: 1px solid rgba(99,102,241,0.3);
          color: #a5b4fc;
          padding: 3px 10px; border-radius: 100px;
        }

        .sub-renews { font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 12px; }

        .sub-progress { margin-bottom: 10px; }
        .sub-progress-row { display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
        .sub-progress-row span:last-child { color: rgba(255,255,255,0.6); }

        .upgrade-btn {
          display: block; width: 100%; text-align: center;
          padding: 9px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 9px;
          color: rgba(255,255,255,0.5);
          font-size: 12px; cursor: pointer;
          text-decoration: none;
          transition: all 0.15s;
        }
        .upgrade-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); }

        @keyframes shimmer {
          0%,100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        @media (max-width: 1200px) {
          .db-body { grid-template-columns: 200px 1fr; }
          .right-panel { display: none; }
        }
        @media (max-width: 900px) {
          .db-body { grid-template-columns: 1fr; }
          .sidebar { display: none; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .mid-grid { grid-template-columns: 1fr; }
          .chart-card { grid-column: span 1; }
        }
      `}</style>

      <div className="db-root">
        {/* ── NAV ── */}
        {/* <nav className="topnav">
          <div className="nav-left">
            <Link href="/" className="brand">
              <div className="brand-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
                </svg>
              </div>
              <span className="brand-name">Newleey</span>
            </Link>
            <div className="nav-links">
              <Link href="/dashboard"   className="nav-link active">Dashboard</Link>
              <Link href="/marketplace" className="nav-link">Marketplace</Link>
              <Link href="/wallet"      className="nav-link">Wallet</Link>
              <Link href="/leads"       className="nav-link">My Leads</Link>
            </div>
          </div>
          <div className="nav-right">
            <Link href="/wallet" className="wallet-pill">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {isLoading ? "—" : `$${(walletBalance / 100).toFixed(0)}`}
            </Link>
            <div className="notif-btn">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="notif-dot" />
            </div>
            <div className="avatar">{avatarLetter}</div>
          </div>
        </nav> */}
        {/* <Navbar /> */}
        <div className="db-body">
          {/* ── SIDEBAR ── */}
          <aside className="sidebar">
            <div className="sidebar-section-label">Overview</div>
            <Link href="/dashboard" className="sidebar-item active">
              <LayoutDashboard size={15} strokeWidth={2} aria-hidden />
              Dashboard
            </Link>
            <Link href="/marketplace" className="sidebar-item">
              <ShoppingBag size={15} strokeWidth={2} aria-hidden />
              Marketplace
              <span className="sidebar-badge">9</span>
            </Link>
            <Link href="/leads" className="sidebar-item">
              <ClipboardList size={15} strokeWidth={2} aria-hidden />
              My Leads
            </Link>

            <div className="sidebar-section-label">Billing</div>
            <Link href="/wallet" className="sidebar-item">
              <Wallet size={15} strokeWidth={2} aria-hidden />
              Wallet
            </Link>
            <Link href="/subscriptions" className="sidebar-item">
              <CircleDollarSign size={15} strokeWidth={2} aria-hidden />
              Subscriptions
            </Link>

            <div className="sidebar-section-label">Tools</div>
            <Link href="/integrations" className="sidebar-item">
              <Plug size={15} strokeWidth={2} aria-hidden />
              Integrations
            </Link>
            <Link href="/settings" className="sidebar-item">
              <Settings size={15} strokeWidth={2} aria-hidden />
              Settings
            </Link>
          </aside>

          {/* ── MAIN ── */}
          <main className="main-content">
            {/* Header */}
            <div className="page-header">
              <div>
                <div className="greeting">
                  Hello{me?.full_name ? `, ${me?.full_name}` : ""} ,
                </div>
                <div className="greeting-sub">
                  {isError
                    ? `Could not load dashboard — ${error instanceof Error ? error.message : "error"}`
                    : isFetching && !isLoading
                      ? "Refreshing…"
                      : "Here's what's happening with your account today."}
                </div>
              </div>
              <div className="header-actions">
                <Link href="/leads" className="btn-secondary">
                  <ClipboardList size={13} strokeWidth={2} aria-hidden />
                  View all leads
                </Link>
                <Link href="/marketplace" className="btn-primary">
                  <Plus size={13} strokeWidth={2} aria-hidden />
                  Buy leads
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              {(
                [
                  {
                    Icon: Wallet,
                    iconBg: "rgba(16,185,129,0.12)",
                    val: isLoading
                      ? "—"
                      : `$${(walletBalance / 100).toFixed(0)}`,
                    label: "Wallet balance",
                    delta: "Live from wallet API",
                    type: "neu",
                  },
                  {
                    Icon: ClipboardList,
                    iconBg: "rgba(99,102,241,0.12)",
                    val: isLoading ? "—" : leadsThisMonth,
                    label: "Lead purchases (month)",
                    delta: "reference_type lead_purchase",
                    type: "neu",
                  },
                  {
                    Icon: Receipt,
                    iconBg: "rgba(245,158,11,0.12)",
                    val: isLoading
                      ? "—"
                      : `$${spendThisMonthDollars.toFixed(0)}`,
                    label: "Spent this month",
                    delta:
                      spendLimit > 0
                        ? `${Math.min(100, Math.round((spendThisMonthDollars / spendLimit) * 100))}% of demo cap ($${spendLimit})`
                        : "Wallet debits (month)",
                    type: "neu",
                  },
                  {
                    Icon: Bot,
                    iconBg: "rgba(236,72,153,0.1)",
                    val: isLoading ? "—" : autoBuy ? "Active" : "Paused",
                    label: "Auto-buy status",
                    delta: onboarding ? "From onboarding" : "Not saved yet",
                    type: autoBuy ? "up" : "down",
                  },
                ] satisfies ReadonlyArray<{
                  Icon: IconComponent;
                  iconBg: string;
                  val: string | number;
                  label: string;
                  delta: string;
                  type: string;
                }>
              ).map((s, i) => {
                const StatIcon = s.Icon;
                return (
                  <div
                    className="stat-card"
                    key={i}
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    <div className="stat-icon" style={{ background: s.iconBg }}>
                      <StatIcon size={18} strokeWidth={2} aria-hidden />
                    </div>
                    <div className="stat-value">{s.val}</div>
                    <div className="stat-label">{s.label}</div>
                    <div
                      className={`stat-delta ${s.type === "up" ? "delta-up" : s.type === "down" ? "delta-down" : "delta-neu"}`}
                    >
                      {s.delta}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mid grid */}
            <div className="mid-grid">
              {/* Weekly chart */}
              <div
                className="card chart-card"
                style={{ animationDelay: "0.1s" }}
              >
                <div className="card-header">
                  <div className="card-title">
                    Wallet activity — last 7 days
                  </div>
                  <button
                    type="button"
                    className="card-action"
                    style={{
                      background: "none",
                      border: "none",
                      font: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => void refetch()}
                  >
                    <RefreshCw size={13} strokeWidth={2} aria-hidden />
                    Refresh
                  </button>
                </div>
                <div className="chart-meta">
                  <div className="chart-meta-item">
                    <div className="chart-meta-val">
                      {isLoading ? "—" : weeklyTxSum}
                    </div>
                    <div className="chart-meta-label">Wallet txs (7d)</div>
                  </div>
                  <div className="chart-meta-item">
                    <div className="chart-meta-val">
                      {isLoading ? "—" : leadsThisMonth}
                    </div>
                    <div className="chart-meta-label">Lead purchases (mo)</div>
                  </div>
                  <div className="chart-meta-item">
                    <div
                      className="chart-meta-val"
                      style={{ color: "#10b981" }}
                    >
                      {isLoading ? "—" : `$${spendThisMonthDollars.toFixed(0)}`}
                    </div>
                    <div className="chart-meta-label">Spent (month)</div>
                  </div>
                </div>
                <MiniBarChart data={weeklyData} days={dayLabels} />
              </div>

              {/* Auto-buy */}
              <div className="card" style={{ animationDelay: "0.15s" }}>
                <div className="card-header">
                  <div className="card-title">Auto-Buy</div>
                  <Link href="/settings" className="card-action">
                    Configure →
                  </Link>
                </div>
                <div className="autobuy-status">
                  <div className="autobuy-info">
                    <div className="autobuy-label">Distribution engine</div>
                    <div className="autobuy-sub">
                      {autoBuy
                        ? "Actively buying matching leads"
                        : "Paused — no leads will be auto-purchased"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle ${autoBuy ? "on" : ""}`}
                    disabled={
                      toggleAutoBuy.isPending || isLoading || !onboarding
                    }
                    onClick={() => toggleAutoBuy.mutate(!autoBuy)}
                    title={
                      !onboarding ? "Complete onboarding first" : undefined
                    }
                  >
                    <div className="toggle-thumb" />
                  </button>
                </div>
                <div className="autobuy-stats">
                  {[
                    { val: String(maxPerDay), label: "Max/day" },
                    { val: String(maxPerDay * 7), label: "Max/week (est.)" },
                    { val: `$${minBalanceDollars}`, label: "Min balance" },
                  ].map((s) => (
                    <div key={s.label} className="autobuy-stat">
                      <div className="autobuy-stat-val">{s.val}</div>
                      <div className="autobuy-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Usage progress */}
              <div className="card" style={{ animationDelay: "0.18s" }}>
                <div className="card-header">
                  <div className="card-title">Monthly usage</div>
                  <Link href="/subscriptions" className="card-action">
                    Upgrade →
                  </Link>
                </div>
                <div className="progress-items">
                  {[
                    {
                      name: "Leads purchased",
                      used: leadsThisMonth,
                      max: leadsLimit,
                      color: "#6366f1",
                    },
                    {
                      name: "Wallet spend",
                      used: spendThisMonthDollars,
                      max: spendLimit,
                      color: "#10b981",
                    },
                    {
                      name: "Auto-buy (demo cap)",
                      used: Math.min(spendThisMonthDollars, 1000),
                      max: 1000,
                      color: "#f59e0b",
                    },
                  ].map((p) => (
                    <div key={p.name} className="progress-item">
                      <div className="progress-row">
                        <span className="progress-name">{p.name}</span>
                        <span className="progress-vals">
                          <span>{p.used}</span> / {p.max}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min((p.used / p.max) * 100, 100)}%`,
                            background: p.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrations */}
              <div className="card" style={{ animationDelay: "0.22s" }}>
                <div className="card-header">
                  <div className="card-title">Integrations</div>
                  <Link href="/integrations" className="card-action">
                    Manage →
                  </Link>
                </div>
                <div className="integ-list">
                  {(() => {
                    const crm =
                      typeof obData.crm === "string" && obData.crm
                        ? obData.crm
                        : null;
                    const items = crm
                      ? [
                          {
                            Icon: Zap,
                            name: crm,
                            status: "Onboarding",
                            color: "#6366f1",
                            bg: "rgba(99,102,241,0.1)",
                          },
                        ]
                      : [
                          {
                            Icon: Link2,
                            name: "CRM integrations",
                            status: "Coming soon",
                            color: "rgba(255,255,255,0.35)",
                            bg: "rgba(255,255,255,0.05)",
                          },
                        ];
                    return items.map((itg) => {
                      const IntegIcon = itg.Icon;
                      return (
                        <div key={itg.name} className="integ-item">
                          <div
                            className="integ-icon"
                            style={{ background: itg.bg }}
                          >
                            <IntegIcon size={16} strokeWidth={2} aria-hidden />
                          </div>
                          <div className="integ-info">
                            <div className="integ-name">{itg.name}</div>
                            <div
                              className="integ-status"
                              style={{ color: itg.color }}
                            >
                              <span
                                className="integ-dot"
                                style={{ background: itg.color }}
                              />
                              {itg.status}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Recent leads table */}
            <div className="card" style={{ animationDelay: "0.25s" }}>
              <div className="card-header">
                <div className="card-title">Recent leads</div>
                <Link href="/leads" className="card-action">
                  View all →
                </Link>
              </div>
              <div className="leads-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Type</th>
                      <th>Exclusivity</th>
                      <th>Status</th>
                      <th>GHL</th>
                      <th>Price</th>
                      <th>Acquired</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            padding: "28px 10px",
                            textAlign: "center",
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 13,
                          }}
                        >
                          No purchased leads yet. Browse the{" "}
                          <Link
                            href="/marketplace"
                            style={{ color: "#a5b4fc" }}
                          >
                            marketplace
                          </Link>{" "}
                          or top up your{" "}
                          <Link href="/wallet" style={{ color: "#a5b4fc" }}>
                            wallet
                          </Link>
                          .
                        </td>
                      </tr>
                    ) : (
                      recentLeads.map((row) => (
                        <tr
                          key={row.assignment_id}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <td style={{ padding: "12px 10px", fontSize: 13 }}>
                            <Link
                              href={`/leads?focus=${row.lead_id}`}
                              style={{
                                color: "#e0e7ff",
                                textDecoration: "none",
                              }}
                            >
                              {row.market}
                            </Link>
                          </td>
                          <td
                            style={{
                              padding: "12px 10px",
                              fontSize: 13,
                              color: "rgba(255,255,255,0.65)",
                            }}
                          >
                            {row.type}
                          </td>
                          <td
                            style={{
                              padding: "12px 10px",
                              fontSize: 12,
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            {row.exclusivity}
                          </td>
                          <td style={{ padding: "12px 10px", fontSize: 12 }}>
                            {row.status}
                          </td>
                          <td style={{ padding: "12px 10px", fontSize: 12 }}>
                            {row.ghl_sync_status}
                          </td>
                          <td style={{ padding: "12px 10px", fontSize: 13 }}>
                            ${(Number(row.charged_amount) / 100).toFixed(0)}
                          </td>
                          <td
                            style={{
                              padding: "12px 10px",
                              fontSize: 12,
                              color: "rgba(255,255,255,0.45)",
                            }}
                          >
                            {new Date(row.assigned_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>

          {/* ── RIGHT PANEL ── */}
          <aside className="right-panel">
            {/* Wallet mini */}
            <div className="panel-section">
              <div className="panel-title">Wallet</div>
              <div className="wallet-card">
                <div className="wallet-balance-label">Available balance</div>
                <div className="wallet-balance-val">
                  <span className="wallet-currency">$</span>
                  {isLoading ? "—" : (walletBalance / 100).toFixed(0)}
                </div>
                <div className="wallet-meta">
                  <div className="wallet-meta-item">
                    <div className="wallet-meta-val">
                      ${isLoading ? "—" : spendThisMonthDollars.toFixed(0)}
                    </div>
                    <div className="wallet-meta-label">Spent this month</div>
                  </div>
                  <div className="wallet-meta-item">
                    <div
                      className="wallet-meta-val"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {wallet?.auto_reload_enabled ? (
                        <>
                          Auto
                          <Check
                            size={15}
                            strokeWidth={2.5}
                            style={{ color: "#10b981" }}
                            aria-label="On"
                          />
                        </>
                      ) : (
                        "Auto off"
                      )}
                    </div>
                    <div className="wallet-meta-label">
                      {wallet?.auto_reload_threshold_cents != null
                        ? `Reload ≤ $${(centsToNumber(wallet.auto_reload_threshold_cents) / 100).toFixed(0)}`
                        : "Auto-reload"}
                    </div>
                  </div>
                </div>
                <Link href="/wallet" className="add-funds-btn">
                  + Add funds
                </Link>
              </div>
            </div>

            {/* Subscription */}
            <div className="panel-section">
              <div className="panel-title">Subscription</div>
              <div className="sub-card">
                <div className="sub-row">
                  <div className="sub-plan-name">
                    {subscription
                      ? `${subscription.plan_type.replace(/_/g, " ")} plan`
                      : "No active plan"}
                  </div>
                  <div className="sub-plan-badge">
                    {subscription?.status
                      ? subscription.status.toUpperCase()
                      : "—"}
                  </div>
                </div>
                <div className="sub-renews">
                  {subscription
                    ? `Current period ends ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : "Choose a plan to participate in auto-distribution."}
                </div>
                <div className="sub-progress">
                  <div className="sub-progress-row">
                    <span>Leads this period</span>
                    <span>
                      {leadsThisMonth}
                      {subscription?.monthly_lead_limit != null
                        ? ` / ${subscription.monthly_lead_limit}`
                        : leadsLimit
                          ? ` / ${leadsLimit}`
                          : ""}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(
                          (leadsThisMonth /
                            Math.max(
                              subscription?.monthly_lead_limit ?? leadsLimit,
                              1,
                            )) *
                            100,
                          100,
                        )}%`,
                        background: "#6366f1",
                      }}
                    />
                  </div>
                </div>
                <Link href="/subscriptions" className="upgrade-btn">
                  Manage subscription →
                </Link>
              </div>
            </div>

            {/* Activity */}
            <div className="panel-section">
              <div className="panel-title">Recent activity</div>
              <div className="activity-feed">
                {activityItems.length === 0 && !isLoading ? (
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.35)",
                      padding: "8px 0",
                    }}
                  >
                    No wallet activity yet.
                  </div>
                ) : (
                  activityItems.map((a) => (
                    <div key={a.id} className="activity-item">
                      <div className="activity-icon">
                        <ActivityFeedIcon kind={a.activityIcon} />
                      </div>
                      <div>
                        <div className="activity-msg">{a.msg}</div>
                        <div className="activity-time">{a.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
