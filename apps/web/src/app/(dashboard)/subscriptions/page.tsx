"use client";

import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Sparkles, Users, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  cancelSubscription,
  checkoutSubscription,
  createCustomerPortal,
  getMySubscription,
  getSubscriptionPricing,
  syncSubscriptionCheckout,
  type SubscriptionDto,
} from "@/lib/subscriptions-api";
import { queryKeys } from "@/lib/query-keys";

const ACTIVE_LIKE = ["active", "past_due", "paused"] as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function badgeColor(status: SubscriptionDto["status"]) {
  if (status === "active") return { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)", text: "#86efac" };
  if (status === "paused") return { bg: "rgba(250,204,21,0.1)", border: "rgba(250,204,21,0.2)", text: "#fde047" };
  if (status === "past_due") return { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", text: "#fca5a5" };
  return { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)", text: "#cbd5e1" };
}

function SubscriptionsContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [synced, setSynced] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: getMySubscription,
  });

  const { data: pricing } = useQuery({
    queryKey: ["subscriptions", "pricing"],
    queryFn: getSubscriptionPricing,
    staleTime: 5 * 60 * 1000,
  });

  const proDisplayPrice = pricing?.proDisplayPrice ?? "$49";
  const sharedInboundPrice = pricing
    ? `$${Math.round(pricing.sharedInboundPriceCents / 100)}`
    : "$30";
  const sharedOutboundPrice = pricing
    ? `$${Math.round(pricing.sharedOutboundPriceCents / 100)}`
    : "$20";

  const proBullets: Array<{ icon: typeof Check; text: string }> = [
    { icon: Users, text: `Non-exclusive inbound leads — ${sharedInboundPrice} each (up to 5 buyers)` },
    { icon: Users, text: `Non-exclusive outbound leads — ${sharedOutboundPrice} each (up to 3 buyers)` },
    { icon: Sparkles, text: "Early marketplace access — see new leads before free members" },
    { icon: Zap, text: "Non-exclusive leads & auto-delivery — fresh matching leads routed to your CRM automatically" },
    { icon: Check, text: "Cancel anytime" },
  ];

  const hasActive = sub != null && (ACTIVE_LIKE as readonly string[]).includes(sub.status);

  // ── Stripe checkout return handler ────────────────────────────────────────
  useEffect(() => {
    if (synced) return;
    const checkout = searchParams.get("checkout");
    const status = searchParams.get("status");
    const sessionId = searchParams.get("session_id");
    if (
      sessionId &&
      (checkout === "success" || status === "success")
    ) {
      setSynced(true);
      syncSubscriptionCheckout(sessionId)
        .then(() => {
          setNotice({ type: "success", msg: "Welcome to Pro! Your subscription is active." });
          return queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.me });
        })
        .catch(() => setNotice({ type: "error", msg: "Sync failed — please refresh." }));
    } else if (checkout === "cancelled" || status === "cancel") {
      setNotice({ type: "error", msg: "Checkout cancelled." });
    }
  }, [searchParams, synced, queryClient]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const checkoutMut = useMutation({
    mutationFn: () => checkoutSubscription("pro"),
    onSuccess: (res) => { window.location.href = res.url; },
    onError: (e: Error) => setNotice({ type: "error", msg: e.message }),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: async () => {
      setNotice({ type: "success", msg: "Subscription cancelled." });
      await queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.me });
    },
    onError: (e: Error) => setNotice({ type: "error", msg: e.message }),
  });

  const portalMut = useMutation({
    mutationFn: () => createCustomerPortal(),
    onSuccess: (res) => { window.location.href = res.url; },
    onError: (e: Error) => setNotice({ type: "error", msg: e.message }),
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .subs-root { min-height: 100vh; background: #080a0f; color: #fff; font-family: 'DM Sans', sans-serif; padding: 40px 28px; }
        .subs-inner { max-width: 760px; margin: 0 auto; }

        .subs-heading { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; margin-bottom: 6px; }
        .subs-sub { font-size: 14px; color: rgba(255,255,255,0.45); margin-bottom: 32px; }

        .notice { padding: 14px 18px; border-radius: 12px; font-size: 13px; margin-bottom: 24px; }
        .notice.success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #6ee7b7; }
        .notice.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5; }

        .plans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
        .plan-card { border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); padding: 28px; position: relative; }
        .plan-card.free { background: rgba(255,255,255,0.025); }
        .plan-card.pro { background: linear-gradient(145deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08)); border-color: rgba(99,102,241,0.3); }

        .plan-eyebrow { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; color: rgba(255,255,255,0.35); }
        .plan-eyebrow.pro { color: #a5b4fc; }
        .plan-name { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 4px; }
        .plan-price { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; margin-bottom: 4px; }
        .plan-price-sub { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 18px; }
        .plan-tagline { font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.5; margin-bottom: 18px; }
        .plan-bullets { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
        .plan-bullet { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.75); }
        .plan-bullet-icon { flex-shrink: 0; margin-top: 1px; }
        .plan-bullet-icon.free { color: rgba(255,255,255,0.3); }
        .plan-bullet-icon.pro { color: #a5b4fc; }

        .plan-cta { width: 100%; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Syne', sans-serif; transition: opacity 0.15s; border: none; }
        .plan-cta.free { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.55); cursor: default; }
        .plan-cta.pro { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
        .plan-cta.pro:hover { opacity: 0.9; }
        .plan-cta.pro:disabled { opacity: 0.5; cursor: not-allowed; }
        .plan-cta.current { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #6ee7b7; cursor: default; }

        .current-badge { position: absolute; top: 18px; right: 18px; font-size: 10px; font-weight: 700; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; border-radius: 100px; padding: 3px 10px; }

        .active-panel { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 24px; }
        .active-panel-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; margin-bottom: 16px; }
        .active-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .active-detail-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; }
        .active-detail-label { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .active-detail-value { font-size: 14px; font-weight: 600; }
        .active-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .active-btn { padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; border: none; transition: opacity 0.15s; }
        .active-btn.portal { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; }
        .active-btn.portal:hover { background: rgba(99,102,241,0.25); }
        .active-btn.cancel { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; }
        .active-btn.cancel:hover { background: rgba(239,68,68,0.18); }
        .active-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 640px) {
          .plans-grid { grid-template-columns: 1fr; }
          .active-detail-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="subs-root">
        <div className="subs-inner">
          <div className="subs-heading">Plans & Billing</div>
          <div className="subs-sub">Subscribe to unlock shared lead pricing and early marketplace access.</div>

          {notice && (
            <div className={`notice ${notice.type}`}>{notice.msg}</div>
          )}

          {/* ── Plan cards ── */}
          <div className="plans-grid">
            {/* Free */}
            <div className="plan-card free" style={{ position: "relative" }}>
              {!hasActive && !subLoading && <span className="current-badge">Current plan</span>}
              <div className="plan-eyebrow">Free</div>
              <div className="plan-name">Marketplace</div>
              <div className="plan-price">$0</div>
              <div className="plan-price-sub">No monthly fee</div>
              <ul className="plan-bullets">
                {[
                  "Browse all available leads",
                  "Buy exclusive leads manually",
                  "Wallet top-ups",
                  "CRM webhook delivery",
                ].map((b) => (
                  <li key={b} className="plan-bullet">
                    <Check size={14} className="plan-bullet-icon free" />
                    {b}
                  </li>
                ))}
              </ul>
              <button type="button" className="plan-cta free" disabled>
                {!hasActive ? "Your current plan" : "Free"}
              </button>
            </div>

            {/* Pro — hardcoded */}
            <div className="plan-card pro" style={{ position: "relative" }}>
              {hasActive && <span className="current-badge">Active</span>}
              <div className="plan-eyebrow pro">Pro</div>
              <div className="plan-name" style={{ color: "#a5b4fc" }}>Membership</div>
              <div className="plan-tagline">
                Membership is {proDisplayPrice} per month. Access shared lead pricing, auto-delivery, and early marketplace access.
              </div>
              <div className="plan-price">{proDisplayPrice}</div>
              <div className="plan-price-sub" style={{ marginBottom: 6 }}>per month · cancel anytime</div>
              <ul className="plan-bullets">
                {proBullets.map(({ icon: Icon, text }) => (
                  <li key={text} className="plan-bullet">
                    <span className="plan-bullet-icon pro" style={{ display: "flex" }}>
                      <Icon size={14} />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
              {hasActive ? (
                <button type="button" className="plan-cta current" disabled>
                  ✓ Subscription active
                </button>
              ) : (
                <button
                  type="button"
                  className="plan-cta pro"
                  disabled={checkoutMut.isPending || subLoading}
                  onClick={() => checkoutMut.mutate()}
                >
                  {checkoutMut.isPending ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                      Redirecting…
                    </span>
                  ) : `Subscribe — ${proDisplayPrice}/month`}
                </button>
              )}
            </div>
          </div>

          {/* ── Active subscription panel ── */}
          {subLoading && (
            <div style={{ textAlign: "center", padding: "28px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} />
              {" "}Loading subscription status…
            </div>
          )}

          {/* Cancelled-but-in-grace-period notice */}
          {!subLoading && sub?.status === "cancelled" && sub.current_period_end && new Date(sub.current_period_end) > new Date() && (
            <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fbbf24", marginBottom: 4 }}>Subscription cancelled — access until {fmtDate(sub.current_period_end)}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                You still have full access including discounted shared leads until your current billing period ends. After that, auto delivery will be turned off and shared lead pricing will no longer apply. Your wallet balance will remain and can still be used toward exclusive leads.
              </div>
            </div>
          )}

          {/* Fully expired cancellation notice */}
          {!subLoading && sub?.status === "cancelled" && sub.current_period_end && new Date(sub.current_period_end) <= new Date() && (
            <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Subscription ended</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                You still have wallet funds available. To access discounted shared leads, reactivate your subscription. You can still use your wallet balance toward exclusive lead purchases.
              </div>
            </div>
          )}

          {!subLoading && hasActive && sub && (
            <div className="active-panel">
              <div className="active-panel-title">Active subscription</div>
              <div className="active-detail-grid">
                <div className="active-detail-item">
                  <div className="active-detail-label">Plan</div>
                  <div className="active-detail-value" style={{ textTransform: "capitalize" }}>{sub.plan_type}</div>
                </div>
                <div className="active-detail-item">
                  <div className="active-detail-label">Status</div>
                  <div className="active-detail-value" style={{ ...badgeColor(sub.status), borderRadius: 8, display: "inline-block", padding: "2px 8px", border: `1px solid ${badgeColor(sub.status).border}` }}>
                    {sub.status === "past_due" ? "Past Due" : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </div>
                </div>
                {sub.current_period_end && (
                  <div className="active-detail-item">
                    <div className="active-detail-label">Renews</div>
                    <div className="active-detail-value">{fmtDate(sub.current_period_end)}</div>
                  </div>
                )}
              </div>
              <div className="active-actions">
                <button
                  type="button"
                  className="active-btn portal"
                  disabled={portalMut.isPending}
                  onClick={() => portalMut.mutate()}
                >
                  {portalMut.isPending ? "Opening…" : "Manage billing"}
                </button>
                <button
                  type="button"
                  className="active-btn cancel"
                  disabled={cancelMut.isPending}
                  onClick={() => {
                    if (window.confirm("Cancel your subscription? You'll keep access until the current period ends.")) {
                      cancelMut.mutate();
                    }
                  }}
                >
                  {cancelMut.isPending ? "Cancelling…" : "Cancel subscription"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#080a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} style={{ color: "rgba(255,255,255,0.3)", animation: "spin 1s linear infinite" }} />
      </div>
    }>
      <SubscriptionsContent />
    </Suspense>
  );
}
