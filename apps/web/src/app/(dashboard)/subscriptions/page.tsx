"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Loader2,
  MapPin,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  cancelSubscription,
  checkoutSubscription,
  createCustomerPortal,
  getMySubscription,
  getSubscriptionPlans,
  syncSubscriptionCheckout,
  type SubscriptionDto,
  type SubscriptionPlanCatalogItem,
} from "@/lib/subscriptions-api";
import { queryKeys } from "@/lib/query-keys";

const ACTIVE_LIKE_STATUSES = ["active", "past_due", "paused"] as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function titleCaseStatus(status: SubscriptionDto["status"]) {
  if (status === "past_due") return "Past Due";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function badgeStyle(status: SubscriptionDto["status"]): CSSProperties {
  if (status === "active") {
    return {
      background: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.25)",
      color: "#86efac",
    };
  }
  if (status === "paused") {
    return {
      background: "rgba(250,204,21,0.1)",
      border: "1px solid rgba(250,204,21,0.2)",
      color: "#fde047",
    };
  }
  if (status === "past_due") {
    return {
      background: "rgba(239,68,68,0.1)",
      border: "1px solid rgba(239,68,68,0.25)",
      color: "#fca5a5",
    };
  }
  return {
    background: "rgba(148,163,184,0.1)",
    border: "1px solid rgba(148,163,184,0.2)",
    color: "#cbd5e1",
  };
}

function stripePriceEnvKey(planType: SubscriptionPlanCatalogItem["planType"]): string {
  const m: Record<SubscriptionPlanCatalogItem["planType"], string> = {
    basic: "STRIPE_PRICE_ID_BASIC",
    pro: "STRIPE_PRICE_ID_PRO",
    market_specific: "STRIPE_PRICE_ID_MARKET_SPECIFIC",
    premium: "STRIPE_PRICE_ID_PREMIUM",
  };
  return m[planType];
}

function planAccent(planType: SubscriptionPlanCatalogItem["planType"]): {
  border: string;
  glow: string;
  iconBg: string;
  iconColor: string;
} {
  switch (planType) {
    case "basic":
      return {
        border: "rgba(148,163,184,0.2)",
        glow: "rgba(99,102,241,0.12)",
        iconBg: "rgba(99,102,241,0.15)",
        iconColor: "#a5b4fc",
      };
    case "pro":
      return {
        border: "rgba(139,92,246,0.35)",
        glow: "rgba(139,92,246,0.18)",
        iconBg: "rgba(139,92,246,0.2)",
        iconColor: "#c4b5fd",
      };
    case "market_specific":
      return {
        border: "rgba(6,182,212,0.35)",
        glow: "rgba(6,182,212,0.15)",
        iconBg: "rgba(6,182,212,0.18)",
        iconColor: "#67e8f9",
      };
    case "premium":
      return {
        border: "rgba(245,158,11,0.4)",
        glow: "rgba(245,158,11,0.2)",
        iconBg: "rgba(245,158,11,0.2)",
        iconColor: "#fcd34d",
      };
    default:
      return {
        border: "rgba(255,255,255,0.1)",
        glow: "rgba(255,255,255,0.05)",
        iconBg: "rgba(255,255,255,0.08)",
        iconColor: "#fff",
      };
  }
}

function FilterPill({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        background: on ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${on ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
        color: on ? "#86efac" : "rgba(255,255,255,0.32)",
      }}
    >
      {on ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={2} />}
      {label}
    </div>
  );
}

function PriorityLadder({ rank }: { rank: number }) {
  const labels = ["Basic", "Pro", "Market", "Premium"];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%", minWidth: 0 }}>
      {labels.map((lb, i) => {
        const tier = i + 1;
        const active = tier === rank;
        return (
          <div
            key={lb}
            style={{
              flex: "1 1 60px",
              minWidth: 56,
              textAlign: "center",
              padding: "8px 6px",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.04)",
              border: active ? "none" : "1px solid rgba(255,255,255,0.08)",
              color: active ? "#fff" : "rgba(255,255,255,0.35)",
              boxShadow: active ? "0 4px 16px rgba(99,102,241,0.35)" : "none",
            }}
          >
            {lb}
          </div>
        );
      })}
    </div>
  );
}

function PlanDetailModal({
  plan,
  onClose,
  onSubscribe,
  checkoutPending,
  checkoutError,
}: {
  plan: SubscriptionPlanCatalogItem;
  onClose: () => void;
  onSubscribe: () => void;
  checkoutPending: boolean;
  checkoutError: string | null;
}) {
  const accent = planAccent(plan.planType);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, calc(100vw - 40px))",
          maxHeight: "min(90vh, 720px)",
          borderRadius: 20,
          border: `1px solid ${accent.border}`,
          background: "linear-gradient(165deg, rgba(18,20,32,0.98) 0%, #0a0c12 100%)",
          boxShadow: `0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)`,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 10,
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(10,12,18,0.92)",
            backdropFilter: "blur(8px)",
            color: "rgba(255,255,255,0.55)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={16} />
        </button>

        <div
          className="subs-plan-modal-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            padding: "20px 20px 22px",
            paddingRight: 18,
            paddingTop: 18,
            position: "relative",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16, paddingRight: 44, minWidth: 0 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: accent.iconBg,
                border: `1px solid ${accent.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {plan.planType === "premium" ? (
                <Crown size={22} color={accent.iconColor} aria-hidden />
              ) : plan.planType === "market_specific" ? (
                <MapPin size={22} color={accent.iconColor} aria-hidden />
              ) : (
                <Zap size={22} color={accent.iconColor} aria-hidden />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                id="plan-modal-title"
                style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "#fff" }}
              >
                {plan.name}
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{plan.tagline}</p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 20,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <span style={{ fontFamily: "Syne, sans-serif", fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>
              {plan.displayPrice}
            </span>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{plan.billingPeriodLabel}</span>
          </div>

          {!plan.stripeConfigured && (
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(250,204,21,0.08)",
                border: "1px solid rgba(250,204,21,0.22)",
                color: "#fde68a",
                fontSize: 13,
                lineHeight: 1.5,
                marginBottom: 16,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                <strong>Checkout not wired yet.</strong> Set{" "}
                <code style={{ fontSize: 11, opacity: 0.9, wordBreak: "break-all" }}>{stripePriceEnvKey(plan.planType)}</code> in the API environment (see{" "}
                <code style={{ fontSize: 11, wordBreak: "break-all" }}>apps/api/.env.example</code>) with your Stripe Price ID so checkout can open.
              </div>
            </div>
          )}

          <div style={{ marginBottom: 18, width: "100%", minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Merry-go-round priority (tier {plan.priorityRank} of 4)
            </div>
            <PriorityLadder rank={plan.priorityRank} />
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{plan.priorityLabel}</p>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Geographic &amp; lead filters
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <FilterPill label="State" on={plan.filterScope.state} />
              <FilterPill label="County" on={plan.filterScope.county} />
              <FilterPill label="ZIP" on={plan.filterScope.zip} />
              <FilterPill label="Lead type" on={plan.filterScope.leadType} />
            </div>
          </div>

          <div
            style={{
              marginBottom: 18,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <CreditCard size={15} color="#a5b4fc" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd" }}>Recurring billing via Stripe</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.55 }}>
              Secure checkout opens on Stripe. After subscribing, manage payment methods and invoices from the billing portal on this page.
            </p>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Lead allocation
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#fff", fontWeight: 600 }}>{plan.leadLimitSummary}</p>
            {plan.includedLeadCreditsSummary && (
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{plan.includedLeadCreditsSummary}</p>
            )}
          </div>

          <ul style={{ margin: "0 0 20px", paddingLeft: 18, color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.65 }}>
            {plan.featureBullets.map((line) => (
              <li key={line} style={{ marginBottom: 6 }}>
                {line}
              </li>
            ))}
          </ul>

          {checkoutError && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.22)",
                color: "#fca5a5",
                fontSize: 13,
              }}
            >
              {checkoutError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: "rgba(255,255,255,0.75)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              type="button"
              disabled={!plan.stripeConfigured || checkoutPending}
              onClick={onSubscribe}
              style={{
                flex: "1 1 200px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 20px",
                borderRadius: 12,
                border: "none",
                background: plan.stripeConfigured ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.1)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: !plan.stripeConfigured || checkoutPending ? "not-allowed" : "pointer",
                opacity: !plan.stripeConfigured || checkoutPending ? 0.55 : 1,
                fontFamily: "Syne, sans-serif",
                boxShadow: plan.stripeConfigured ? "0 8px 28px rgba(99,102,241,0.35)" : "none",
              }}
            >
              {checkoutPending ? (
                <>
                  <Loader2 size={16} style={{ animation: "spin 0.9s linear infinite" }} />
                  Redirecting to Stripe…
                </>
              ) : (
                <>
                  <Sparkles size={16} aria-hidden />
                  Subscribe with Stripe
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscriptionsPageInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [detailPlan, setDetailPlan] = useState<SubscriptionPlanCatalogItem | null>(null);
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);
  const [pendingCheckoutPlan, setPendingCheckoutPlan] = useState<SubscriptionPlanCatalogItem["planType"] | null>(null);

  const checkoutSuccess = searchParams.get("checkout") === "success";
  const checkoutCancelled = searchParams.get("checkout") === "cancelled";
  const checkoutSessionId = searchParams.get("session_id");

  const { data, isLoading: subscriptionLoading, error } = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: getMySubscription,
  });

  const {
    data: plans = [],
    isLoading: plansLoading,
    isError: plansIsError,
    error: plansError,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: queryKeys.subscriptions.plans,
    queryFn: getSubscriptionPlans,
    retry: 1,
  });

  const hasActiveLikeSubscription = !!data && (ACTIVE_LIKE_STATUSES as readonly string[]).includes(data.status);
  const currentPlanMeta = useMemo(() => plans.find((p) => p.planType === data?.plan_type) ?? null, [plans, data]);
  const availablePlans = useMemo(
    () => plans.filter((plan) => plan.planType === "basic" || plan.planType === "pro"),
    [plans],
  );
  const basicPlan = availablePlans.find((plan) => plan.planType === "basic");
  const proPlan = availablePlans.find((plan) => plan.planType === "pro");

  const checkout = useMutation({
    mutationFn: checkoutSubscription,
    onMutate: (planType) => {
      setCheckoutErr(null);
      setPendingCheckoutPlan(planType);
    },
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (e) => {
      setCheckoutErr(e instanceof Error ? e.message : "Could not start checkout");
    },
    onSettled: () => {
      setPendingCheckoutPlan(null);
    },
  });

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: async () => {
      setShowCancelConfirm(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.me });
    },
  });

  const portal = useMutation({
    mutationFn: createCustomerPortal,
    onSuccess: (result) => {
      window.location.href = result.url;
    },
  });

  const syncCheckout = useMutation({
    mutationFn: syncSubscriptionCheckout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.me });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
  const syncCheckoutMutate = syncCheckout.mutate;
  const checkoutSyncing =
    checkoutSuccess && checkoutSessionId && !syncCheckout.isError && (syncCheckout.isPending || !data);

  useEffect(() => {
    if (
      !checkoutSuccess ||
      !checkoutSessionId ||
      syncCheckout.isPending ||
      syncCheckout.isSuccess ||
      syncCheckout.isError
    ) {
      return;
    }
    syncCheckoutMutate(checkoutSessionId);
  }, [
    checkoutSessionId,
    checkoutSuccess,
    syncCheckout.isError,
    syncCheckout.isPending,
    syncCheckout.isSuccess,
    syncCheckoutMutate,
  ]);

  const progressPercent =
    data?.monthly_lead_limit && data.monthly_lead_limit > 0
      ? Math.min(100, Math.round((data.leads_used_this_period / data.monthly_lead_limit) * 100))
      : 100;

  const plansErrMessage =
    plansError instanceof Error ? plansError.message : plansError ? String(plansError) : "Could not load plans";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .subs-offer-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
          gap: 18px;
          margin-bottom: 24px;
          animation: fadeUp 0.4s ease both;
        }
        .subs-hero-main {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid rgba(99,102,241,0.22);
          background:
            radial-gradient(circle at 86% 8%, rgba(139,92,246,0.2), transparent 34%),
            radial-gradient(circle at 5% 105%, rgba(16,185,129,0.14), transparent 34%),
            linear-gradient(135deg, rgba(99,102,241,0.13), rgba(255,255,255,0.028));
          padding: 30px;
          min-height: 320px;
        }
        .subs-hero-side {
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          padding: 22px;
        }
        .subs-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.24);
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
        .subs-hero-title {
          font-family: "Syne", sans-serif;
          font-size: clamp(34px, 4vw, 54px);
          line-height: 0.98;
          letter-spacing: -2px;
          margin: 0;
          max-width: 720px;
        }
        .subs-hero-copy {
          margin: 18px 0 0;
          max-width: 620px;
          color: rgba(255,255,255,0.62);
          font-size: 15px;
          line-height: 1.7;
        }
        .subs-hero-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 26px;
        }
        .subs-hero-stat {
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(8,10,15,0.48);
          padding: 15px;
        }
        .subs-hero-stat-value {
          font-family: "Syne", sans-serif;
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
        }
        .subs-hero-stat-label {
          margin-top: 5px;
          color: rgba(255,255,255,0.42);
          font-size: 11px;
          line-height: 1.35;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .subs-mini-plan {
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.075);
          background: rgba(255,255,255,0.028);
          padding: 15px;
        }
        .subs-plan-card { transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
        .subs-plan-card:hover { transform: translateY(-3px); }
        .subs-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        @media (max-width: 980px) {
          .subs-offer-hero { grid-template-columns: 1fr; }
          .subs-hero-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 700px) {
          .subs-grid,
          .subs-hero-stats { grid-template-columns: 1fr; }
          .subs-hero-main { padding: 24px; min-height: auto; }
        }

        /* Plan detail modal: single slim vertical scrollbar, dark theme */
        .subs-plan-modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: #2a2d36 #0a0c12;
        }
        .subs-plan-modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .subs-plan-modal-scroll::-webkit-scrollbar-track {
          background: #0a0c12;
          border-radius: 8px;
        }
        .subs-plan-modal-scroll::-webkit-scrollbar-thumb {
          background: #2a2d36;
          border-radius: 8px;
        }
        .subs-plan-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: #3d4250;
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#080a0f", color: "#fff", fontFamily: "DM Sans, sans-serif" }}>
        <div style={{ maxWidth: 1220, margin: "0 auto", padding: "36px 24px 80px" }}>
          {!subscriptionLoading && !hasActiveLikeSubscription && (
            <section className="subs-offer-hero">
              <div className="subs-hero-main">
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div className="subs-hero-eyebrow">
                    <Sparkles size={13} strokeWidth={2.4} aria-hidden />
                    Premium Lead Subscription
                  </div>
                  <h1 className="subs-hero-title">
                    Get monthly premium leads plus wallet credits for faster buying.
                  </h1>
                  <p className="subs-hero-copy">
                    Choose Basic or Pro based on your monthly lead volume. Both plans unlock recurring premium lead
                    credits, automated distribution eligibility, and monthly wallet allowance through Stripe billing.
                  </p>

                  <div className="subs-hero-stats">
                    <div className="subs-hero-stat">
                      <div className="subs-hero-stat-value">
                        {basicPlan?.monthlyLeadLimit ?? 25}
                      </div>
                      <div className="subs-hero-stat-label">Basic premium leads / month</div>
                    </div>
                    <div className="subs-hero-stat">
                      <div className="subs-hero-stat-value">
                        {proPlan?.monthlyLeadLimit ?? 40}
                      </div>
                      <div className="subs-hero-stat-label">Pro premium leads / month</div>
                    </div>
                    <div className="subs-hero-stat">
                      <div className="subs-hero-stat-value">$50+</div>
                      <div className="subs-hero-stat-label">Monthly wallet allowance</div>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="subs-hero-side">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: "rgba(99,102,241,0.14)",
                      border: "1px solid rgba(99,102,241,0.24)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Crown size={18} color="#c4b5fd" aria-hidden />
                  </div>
                  <div>
                    <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 800 }}>
                      Which plan fits?
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, marginTop: 3 }}>
                      Start with Basic, scale with Pro.
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {[basicPlan, proPlan].filter(Boolean).map((plan) => (
                    <div key={plan!.planType} className="subs-mini-plan">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, color: "#fff" }}>{plan!.name}</div>
                        <div style={{ color: "#c4b5fd", fontWeight: 800 }}>{plan!.displayPrice}</div>
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.5 }}>
                        {plan!.leadLimitSummary}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
                        {plan!.includedLeadCreditsSummary}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </section>
          )}

          {checkoutSuccess && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
                padding: "14px 18px",
                borderRadius: 14,
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.22)",
                color: "#86efac",
                animation: "fadeUp 0.35s ease both",
              }}
            >
              {checkoutSyncing ? <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <CheckCircle2 size={18} />}
              <strong>{checkoutSyncing ? "Finalizing subscription..." : data ? "Subscription active!" : "Checkout complete"}</strong>
              <span style={{ opacity: 0.85, fontSize: 14 }}>
                {checkoutSyncing
                  ? "Confirming your Stripe checkout with Newleey."
                  : data
                    ? "You're all set — your plan limits and priority apply on the next distribution cycle."
                    : "Refresh in a moment if your plan does not appear yet."}
              </span>
            </div>
          )}

          {syncCheckout.isError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
                padding: "14px 18px",
                borderRadius: 14,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.24)",
                color: "#fca5a5",
                fontSize: 14,
              }}
            >
              <AlertTriangle size={18} />
              {(syncCheckout.error as Error).message || "Could not finalize checkout. Please refresh or contact support."}
            </div>
          )}

          {checkoutCancelled && !checkoutSuccess && (
            <div
              style={{
                marginBottom: 18,
                padding: "14px 18px",
                borderRadius: 14,
                background: "rgba(250,204,21,0.08)",
                border: "1px solid rgba(250,204,21,0.18)",
                color: "#fde68a",
                fontSize: 14,
              }}
            >
              Checkout was cancelled before payment completed. Choose a plan when you&apos;re ready.
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 18, color: "#fca5a5", fontSize: 14 }}>
              {error instanceof Error ? error.message : "Failed to load subscription"}
            </div>
          )}

          {cancel.isError && (
            <div style={{ marginBottom: 18, color: "#fca5a5", fontSize: 14 }}>
              {cancel.error instanceof Error ? cancel.error.message : "Failed to cancel subscription"}
            </div>
          )}

          {portal.isError && (
            <div style={{ marginBottom: 18, color: "#fca5a5", fontSize: 14 }}>
              {portal.error instanceof Error ? portal.error.message : "Failed to open billing portal"}
            </div>
          )}

          {checkoutErr && !detailPlan && (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#fca5a5",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span>{checkoutErr}</span>
              <button
                type="button"
                onClick={() => setCheckoutErr(null)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {subscriptionLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "64px 0" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Loader2 size={24} color="#a5b4fc" style={{ animation: "spin 0.9s linear infinite" }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", margin: 0 }}>Loading subscription…</p>
            </div>
          ) : hasActiveLikeSubscription && data ? (
            <>
              {data.status === "past_due" && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 20,
                    padding: "18px 20px",
                    borderRadius: 16,
                    background: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)",
                    border: "1px solid rgba(239,68,68,0.22)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fca5a5" }}>
                    <AlertTriangle size={20} />
                    <div>
                      <div style={{ fontWeight: 700 }}>Payment failed — update your payment method</div>
                      <div style={{ fontSize: 13, opacity: 0.85 }}>Open the Stripe billing portal to fix your card or billing details.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => portal.mutate()}
                    disabled={portal.isPending}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      border: "1px solid rgba(239,68,68,0.28)",
                      background: "rgba(239,68,68,0.14)",
                      color: "#fecaca",
                      fontWeight: 600,
                      cursor: portal.isPending ? "wait" : "pointer",
                      opacity: portal.isPending ? 0.7 : 1,
                    }}
                  >
                    {portal.isPending ? "Opening…" : "Update payment method"}
                  </button>
                </div>
              )}

              <div
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "linear-gradient(165deg, rgba(99,102,241,0.08) 0%, rgba(255,255,255,0.02) 40%)",
                  padding: 28,
                  position: "relative",
                  overflow: "hidden",
                  animation: "fadeUp 0.4s ease both",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -50,
                    right: -50,
                    width: 200,
                    height: 200,
                    background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
                    borderRadius: "50%",
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 22, position: "relative" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                      <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 800, margin: 0 }}>
                        {currentPlanMeta?.name ?? data.plan_type.replace(/_/g, " ")}
                      </h2>
                      <span
                        style={{
                          ...badgeStyle(data.status),
                          borderRadius: 999,
                          padding: "4px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {titleCaseStatus(data.status)}
                      </span>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>Renews on {fmtDate(data.current_period_end)}</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 6 }}>
                      Period: {fmtDate(data.current_period_start)} — {fmtDate(data.current_period_end)}
                    </div>
                    {currentPlanMeta && (
                      <p style={{ margin: "14px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)", maxWidth: 420, lineHeight: 1.55 }}>
                        {currentPlanMeta.distributionSummary}
                      </p>
                    )}
                  </div>

                  <div style={{ minWidth: 280, flex: 1, maxWidth: 440 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Leads this period</span>
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                        {data.leads_used_this_period} / {data.monthly_lead_limit ?? "∞"}
                      </span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${progressPercent}%`,
                          borderRadius: 999,
                          background:
                            data.monthly_lead_limit == null
                              ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                              : "linear-gradient(135deg,#22c55e,#14b8a6)",
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 10 }}>
                      Priority weight: <span style={{ color: "#c4b5fd" }}>{data.priority_weight}</span> · Managed with Stripe billing
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap", position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => portal.mutate()}
                    disabled={portal.isPending}
                    style={{
                      padding: "12px 20px",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: portal.isPending ? "wait" : "pointer",
                      opacity: portal.isPending ? 0.7 : 1,
                      fontFamily: "Syne, sans-serif",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
                    }}
                  >
                    <CreditCard size={16} />
                    {portal.isPending ? "Opening…" : "Billing portal"}
                    <ArrowUpRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={cancel.isPending}
                    style={{
                      padding: "12px 18px",
                      borderRadius: 12,
                      border: "1px solid rgba(239,68,68,0.28)",
                      background: "rgba(239,68,68,0.08)",
                      color: "#fca5a5",
                      fontWeight: 700,
                      cursor: cancel.isPending ? "wait" : "pointer",
                      opacity: cancel.isPending ? 0.7 : 1,
                    }}
                  >
                    {cancel.isPending ? "Cancelling…" : "Cancel subscription"}
                  </button>
                </div>
              </div>
            </>
          ) : plansLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "64px 0" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Loader2 size={24} color="#a5b4fc" style={{ animation: "spin 0.9s linear infinite" }} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", margin: 0 }}>Loading plans…</p>
            </div>
          ) : plansIsError ? (
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 16,
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.06)",
                maxWidth: 560,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, color: "#fca5a5" }}>
                <AlertTriangle size={20} />
                <strong style={{ fontFamily: "Syne, sans-serif", fontSize: 16 }}>Could not load subscription plans</strong>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>{plansErrMessage}</p>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
                Check that the API is running (default <code style={{ fontSize: 12 }}>http://localhost:5000</code>),{" "}
                <code style={{ fontSize: 12 }}>NEXT_PUBLIC_API_URL</code> in <code style={{ fontSize: 12 }}>apps/web/.env</code> matches it, then restart{" "}
                <code style={{ fontSize: 12 }}>next dev</code> so rewrites apply.
              </p>
              <button
                type="button"
                onClick={() => void refetchPlans()}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.35)",
                  background: "rgba(239,68,68,0.12)",
                  color: "#fecaca",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="subs-grid" style={{ animation: "fadeUp 0.45s ease 0.05s both" }}>
              {availablePlans.map((plan) => {
                const accent = planAccent(plan.planType);
                const isPro = plan.planType === "pro";
                const isPremium = plan.planType === "premium";
                const isCheckingOut = pendingCheckoutPlan === plan.planType && checkout.isPending;

                return (
                  <div
                    key={plan.planType}
                    className="subs-plan-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 18,
                      border: `1px solid ${isPremium ? "rgba(245,158,11,0.35)" : accent.border}`,
                      background: isPremium
                        ? "linear-gradient(165deg, rgba(245,158,11,0.08) 0%, rgba(255,255,255,0.02) 100%)"
                        : "rgba(255,255,255,0.025)",
                      padding: 22,
                      minHeight: 320,
                      position: "relative",
                      overflow: "hidden",
                      boxShadow: isPremium ? "0 12px 40px rgba(245,158,11,0.08)" : "none",
                    }}
                  >
                    {isPro && (
                      <div
                        style={{
                          position: "absolute",
                          top: 14,
                          right: 14,
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                          color: "#fff",
                        }}
                      >
                        Popular
                      </div>
                    )}
                    {isPremium && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 2,
                          background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.7), transparent)",
                        }}
                      />
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: accent.iconBg,
                          border: `1px solid ${accent.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isPremium ? (
                          <Crown size={17} color={accent.iconColor} aria-hidden />
                        ) : plan.planType === "market_specific" ? (
                          <MapPin size={17} color={accent.iconColor} aria-hidden />
                        ) : (
                          <Zap size={17} color={accent.iconColor} aria-hidden />
                        )}
                      </div>
                      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 19, fontWeight: 800 }}>{plan.name}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontFamily: "Syne, sans-serif", fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{plan.displayPrice}</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>{plan.billingPeriodLabel}</span>
                    </div>

                    {!plan.stripeConfigured && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#fde68a",
                          marginBottom: 10,
                          padding: "6px 10px",
                          borderRadius: 8,
                          background: "rgba(250,204,21,0.08)",
                          border: "1px solid rgba(250,204,21,0.15)",
                        }}
                      >
                        Stripe price ID not configured
                      </div>
                    )}

                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.55, margin: "0 0 14px", flex: 1 }}>{plan.tagline}</p>

                    <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none" }}>
                      {plan.cardHighlights.map((h) => (
                        <li
                          key={h}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.55)",
                            marginBottom: 6,
                          }}
                        >
                          <Check size={14} color="#6ee7b7" strokeWidth={2.5} />
                          {h}
                        </li>
                      ))}
                    </ul>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutErr(null);
                          setDetailPlan(plan);
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: 11,
                          border: "1px solid rgba(255,255,255,0.1)",
                          background: "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.85)",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        disabled={!plan.stripeConfigured || checkout.isPending}
                        onClick={() => checkout.mutate(plan.planType)}
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: 11,
                          border: "none",
                          background: plan.stripeConfigured ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.08)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: !plan.stripeConfigured || checkout.isPending ? "not-allowed" : "pointer",
                          opacity: !plan.stripeConfigured || checkout.isPending ? 0.55 : 1,
                          fontFamily: "Syne, sans-serif",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          boxShadow: plan.stripeConfigured ? "0 6px 20px rgba(99,102,241,0.3)" : "none",
                        }}
                      >
                        {isCheckingOut ? (
                          <>
                            <Loader2 size={16} style={{ animation: "spin 0.9s linear infinite" }} />
                            Redirecting…
                          </>
                        ) : (
                          <>
                            <Sparkles size={15} aria-hidden />
                            Subscribe
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {detailPlan && (
          <PlanDetailModal
            plan={detailPlan}
            onClose={() => {
              setDetailPlan(null);
              setCheckoutErr(null);
            }}
            onSubscribe={() => checkout.mutate(detailPlan.planType)}
            checkoutPending={pendingCheckoutPlan === detailPlan.planType && checkout.isPending}
            checkoutError={checkoutErr}
          />
        )}

        {showCancelConfirm && data && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setShowCancelConfirm(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 100,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(460px, 100%)",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#0d1018",
                padding: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <CreditCard size={18} color="#fca5a5" />
                <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, margin: 0 }}>Cancel subscription?</h3>
              </div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                This cancels your current {currentPlanMeta?.name ?? data.plan_type} subscription in Stripe. You can subscribe again anytime from this page.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent",
                    color: "rgba(255,255,255,0.8)",
                    cursor: "pointer",
                  }}
                >
                  Keep subscription
                </button>
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(239,68,68,0.28)",
                    background: "rgba(239,68,68,0.12)",
                    color: "#fca5a5",
                    fontWeight: 700,
                    cursor: cancel.isPending ? "wait" : "pointer",
                    opacity: cancel.isPending ? 0.7 : 1,
                  }}
                >
                  {cancel.isPending ? "Cancelling…" : "Yes, cancel"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#080a0f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          <Loader2 size={24} style={{ animation: "spin 0.9s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <SubscriptionsPageInner />
    </Suspense>
  );
}
