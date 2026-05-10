"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getMySubscription } from "@/lib/subscriptions-api";
import { queryKeys } from "@/lib/query-keys";

const LEGACY_PLANS = new Set(["basic", "market_specific", "premium"]);

/**
 * Shows a dismissible one-time banner when the user has an active legacy plan
 * (basic / market_specific / premium). Legacy plan perks (monthly wallet credits,
 * priority weight) are no longer applied; they should upgrade to Pro or stay on Free.
 */
export default function LegacyPlanBanner() {
  const { data: sub } = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: getMySubscription,
  });

  if (!sub) return null;
  if (sub.status !== "active") return null;
  if (!LEGACY_PLANS.has(sub.plan_type)) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        background: "linear-gradient(90deg,rgba(245,158,11,0.18),rgba(99,102,241,0.14))",
        borderBottom: "1px solid rgba(245,158,11,0.28)",
        padding: "10px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        fontSize: 13,
        color: "rgba(255,255,255,0.82)",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      <span>
        <strong style={{ color: "#fcd34d" }}>Heads up:</strong> Your{" "}
        <strong style={{ textTransform: "capitalize" }}>
          {sub.plan_type.replace(/_/g, " ")}
        </strong>{" "}
        plan no longer includes monthly wallet credits or priority distribution.
        Upgrade to <strong>Pro</strong> to unlock 10% off every lead, 60-minute early access,
        and priority notifications — or continue on the Free plan at no cost.
      </span>
      <Link
        href="/subscriptions"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          borderRadius: 9,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        View plans
      </Link>
    </div>
  );
}
