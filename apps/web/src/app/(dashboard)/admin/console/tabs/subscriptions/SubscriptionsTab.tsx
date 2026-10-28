"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminExtendedMetrics,
  getAdminMetricsBreakdown,
  getAdminSubscriptionPlans,
  patchAdminSubscriptionPlan,
  type AdminSubscriptionPlan,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Stat } from "../../components/Stat";
import { Empty } from "../../components/Empty";

function fmtCents(v: string | number | undefined | null): string {
  const n = Number(v ?? 0);
  return `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Sub-component: Plan Editor ---
function PlanEditorCard({ plan }: { plan: AdminSubscriptionPlan }) {
  const qc = useQueryClient();
  const [priceStr, setPriceStr] = useState(
    String(Math.round(Number(plan.monthly_price_cents) / 100)),
  );

  useEffect(() => {
    setPriceStr(String(Math.round(Number(plan.monthly_price_cents) / 100)));
  }, [plan.updated_at, plan.plan_type]);

  const patch = useMutation({
    mutationFn: () =>
      patchAdminSubscriptionPlan(plan.plan_type, {
        monthly_price_cents: Math.round((parseFloat(priceStr) || 0) * 100),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.plans });
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptions.plans });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metricsBreakdown });
    },
  });

  return (
    <div
      style={{
        background:
          "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "32px",
        maxWidth: 600,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "",
              color: "#c4b5fd",
              marginBottom: 8,
            }}
          >
            Current Plan: {plan.plan_type}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              fontFamily: "Manrope, sans-serif",
            }}
          >
            Edit Pro Pricing
          </h3>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 24,
        }}
      >
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.6)",
            textTransform: "",
          }}
        >
          Monthly Subscription Price
        </label>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 16,
              color: "rgba(255,255,255,0.5)",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            $
          </span>
          <input
            type="number"
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "14px 16px 14px 36px",
              borderRadius: 12,
              fontSize: 16,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
            placeholder="49"
            onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
            onBlur={(e) =>
              (e.target.style.borderColor = "rgba(255,255,255,0.1)")
            }
          />
        </div>
        <span
          style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}
        >
          Note: Feature bullets are managed in the codebase. Only the base price
          is configured here.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <button
          disabled={patch.isPending}
          onClick={() => patch.mutate()}
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: "0 4px 14px rgba(99,102,241,0.25)",
          }}
        >
          {patch.isPending ? "Updating Price..." : "Save New Price"}
        </button>
        {patch.isSuccess && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "#34d399" }}>
            ✓ Price Updated Globally
          </span>
        )}
        {patch.isError && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f87171" }}>
            {(patch.error as Error).message}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Main Tab ---
export default function SubscriptionsTab() {
  const metrics = useQuery({
    queryKey: queryKeys.admin.metrics,
    queryFn: getAdminExtendedMetrics,
  });
  const breakdown = useQuery({
    queryKey: queryKeys.admin.metricsBreakdown,
    queryFn: getAdminMetricsBreakdown,
  });
  const plans = useQuery({
    queryKey: queryKeys.admin.plans,
    queryFn: getAdminSubscriptionPlans,
  });

  const churnPct = breakdown.data
    ? `${(breakdown.data.subscriptionChurn30d.churnRate * 100).toFixed(1)}%`
    : "—";
  const subPlan = plans.data?.find((p) => p.plan_type === "pro");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <SectionTitle
          title="Subscriptions"
          sub="Active subscriber health and plan configuration."
        />
        <a
          href="https://dashboard.stripe.com/subscriptions"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "background 0.2s",
          }}
        >
          Open Stripe Dashboard{" "}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </a>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <Stat
          label="Active Subscribers"
          value={String(metrics.data?.activeSubscriptions ?? "—")}
          accent="linear-gradient(135deg, #6366f1, #8b5cf6)"
        />
        <Stat
          label="MRR Estimate"
          value={
            breakdown.data ? fmtCents(breakdown.data.mrrEstimateCents) : "—"
          }
          accent="linear-gradient(135deg, #10b981, #34d399)"
        />
        <Stat
          label="30-Day Churn"
          value={churnPct}
          accent={
            breakdown.data &&
            breakdown.data.subscriptionChurn30d.churnRate > 0.1
              ? "linear-gradient(135deg, #ef4444, #f97316)"
              : "linear-gradient(135deg, #f59e0b, #fbbf24)"
          }
        />
      </div>

      {plans.isLoading && <Empty title="Loading subscription data..." />}
      {plans.data && !subPlan && (
        <Empty
          title="Pro Plan Not Found"
          body="Run migrations to seed the primary subscription plan record."
        />
      )}

      {subPlan && <PlanEditorCard plan={subPlan} />}
    </div>
  );
}
