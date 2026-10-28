"use client";

import type { ComponentType } from "react";
import {
  Suspense,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Check,
  CheckCircle,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Handshake,
  Home,
  Link2,
  Map,
  MapPin,
  MessageCircle,
  Package,
  PartyPopper,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  Trees,
  Video,
  Wallet,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import {
  US_STATES,
  COUNTIES_BY_STATE,
  countiesForStateCode,
} from "@/data/us-markets-geo";
import {
  getOnboardingMe,
  patchOnboardingMe,
  type UpdateOnboardingPayload,
} from "@/lib/onboarding-api";
import { queryKeys } from "@/lib/query-keys";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  confirmStripeWalletTopUp,
  createStripePaymentIntent,
} from "@/lib/wallet-api";
import {
  checkoutSubscription,
  getMySubscription,
  getSubscriptionPlans,
  type SubscriptionDto,
} from "@/lib/subscriptions-api";
import {
  patchWebhookIntegration,
  testWebhookIntegration,
} from "@/lib/integrations-api";
import {
  getAuthMe,
  sendPhoneVerificationCode,
  verifyPhoneVerificationCode,
} from "@/lib/auth-api";

type ObIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

const TOTAL_STEPS = 9;

const PROPERTY_TYPE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  desc: string;
  Icon: ObIcon;
}> = [
  {
    value: "single_family",
    label: "Single Family",
    desc: "Detached, single-unit homes",
    Icon: Home,
  },
  {
    value: "mobile_home",
    label: "Mobile Home",
    desc: "Manufactured or mobile properties",
    Icon: Warehouse,
  },
  {
    value: "multifamily",
    label: "Multifamily",
    desc: "Duplexes, triplexes, small apartment buildings",
    Icon: Building2,
  },
  {
    value: "land",
    label: "Land",
    desc: "Vacant lots and undeveloped land",
    Icon: Trees,
  },
];

function buildMarketsFromGeo(d: Record<string, unknown>): string[] {
  if (d.nationwide) {
    return US_STATES.flatMap((s) =>
      (COUNTIES_BY_STATE[s.code] ?? []).map((c) => `${s.code}:${c}`),
    );
  }
  // Support both legacy single-state and new multi-state formats
  const counties = (d.selected_counties as string[]) ?? [];
  // New format: counties already stored as "STATECODE:County Name"
  if (counties.length > 0 && counties[0].includes(":")) return counties;
  // Legacy single-state format
  const st = String(d.selected_state ?? "");
  if (!st) return [];
  return counties.map((c) => `${st}:${c}`);
}

const WALLET_FUND_AMOUNTS = [250, 500, 1000, 2500];
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

const STEP_META: ReadonlyArray<{ Icon: ObIcon; title: string; sub: string }> = [
  {
    Icon: Handshake,
    title: "Set Up Your Account",
    sub: "Find your leads. Scale your business.",
  },
  {
    Icon: MapPin,
    title: "Lead Coverage",
    sub: "Choose by state, county, search, or a nationwide toggle.",
  },
  {
    Icon: Target,
    title: "Property Type",
    sub: "Pick the kinds of properties you want to buy leads for.",
  },
  {
    Icon: Link2,
    title: "CRM webhook",
    sub: "Connect Lead Connector, Zapier, GoHighLevel, or any HTTPS webhook.",
  },
  {
    Icon: Package,
    title: "Choose your plan",
    sub: "Choose Free or Pro first so the rest of setup follows the right path.",
  },
  {
    Icon: CreditCard,
    title: "Fund your wallet",
    sub: "Add cash with Stripe now or come back later from Settings.",
  },
  {
    Icon: Bot,
    title: "Lead Delivery Limits",
    sub: "Set daily, weekly, and monthly caps so autobuy never overspends.",
  },
  {
    Icon: BookOpen,
    title: "Resources & guides",
    sub: "Skool community, tutorials, FAQs, and setup help live here.",
  },
  {
    Icon: CheckCircle,
    title: "You're all set",
    sub: "Jump into the marketplace and start buying or tracking leads.",
  },
];

// ── Stripe wallet-funding form used inside step 4 ────────────────────────────
// Must be rendered inside <Elements> so it can call useStripe / useElements.
function WalletFundForm({
  onSuccess,
  onSkip,
  isSaving,
}: {
  /** Dollar amount successfully charged via Stripe (for onboarding metadata). */
  onSuccess: (fundedDollars: number) => void;
  onSkip: () => void;
  isSaving: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState(500);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(false);

  async function handlePay() {
    if (!stripe || !elements) {
      setPayError("Stripe is not ready — please refresh and try again.");
      return;
    }
    setIsPaying(true);
    setPayError(null);
    try {
      const amountCents = amount * 100;
      const { clientSecret } = await createStripePaymentIntent(amountCents);
      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card element is not mounted.");
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (result.error)
        throw new Error(result.error.message ?? "Payment failed");
      const pi = result.paymentIntent;
      if (!pi?.id) throw new Error("Missing payment intent from Stripe.");
      await confirmStripeWalletTopUp(pi.id);
      onSuccess(amount);
    } catch (e) {
      setPayError(
        e instanceof Error ? e.message : "Payment failed — please try again.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  if (skipConfirm) {
    return (
      <div
        style={{
          background: "rgba(234,179,8,0.07)",
          border: "1px solid rgba(234,179,8,0.25)",
          borderRadius: 14,
          padding: "22px 24px",
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.65,
            marginBottom: 22,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: "#fde047", marginTop: 2, flexShrink: 0 }}
          />
          <span>
            Without wallet funds, and you won&apos;t be able to purchase leads
            until you add funds. You can top up any time from the Wallet page.
          </span>
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-back"
            style={{ flex: 1 }}
            onClick={() => setSkipConfirm(false)}
          >
            ← Add funds now
          </button>
          <button
            type="button"
            className="btn-next"
            style={{
              flex: 1,
              justifyContent: "center",
              opacity: isSaving ? 0.5 : 1,
            }}
            disabled={isSaving}
            onClick={onSkip}
          >
            {isSaving ? (
              <>
                <span className="spinner" /> Saving…
              </>
            ) : (
              "Continue without funds →"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Amount picker */}
      <div className="amount-grid" style={{ marginBottom: 18 }}>
        {WALLET_FUND_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            className={`amount-btn ${amount === a ? "selected" : ""}`}
            onClick={() => setAmount(a)}
          >
            ${a}
          </button>
        ))}
      </div>

      {/* Stripe card element */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 11,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <CardElement
          options={{
            style: {
              base: {
                color: "#ffffff",
                fontSize: "15px",
                fontFamily: "'DM Sans', sans-serif",
                "::placeholder": { color: "rgba(255,255,255,0.3)" },
              },
              invalid: { color: "#fca5a5" },
            },
          }}
        />
      </div>

      {payError && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "#fca5a5",
            marginBottom: 14,
          }}
        >
          {payError}
        </div>
      )}

      {/* Primary CTA */}
      <button
        type="button"
        className="btn-next"
        style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}
        disabled={isPaying || isSaving}
        onClick={() => void handlePay()}
      >
        {isPaying ? (
          <>
            <span className="spinner" /> Processing…
          </>
        ) : (
          <>Add ${amount} to wallet &amp; continue →</>
        )}
      </button>

      {/* Skip — visible secondary button */}
      <button
        type="button"
        onClick={() => setSkipConfirm(true)}
        style={{
          width: "100%",
          padding: "12px 20px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.5)",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,255,255,0.7)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.04)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,255,255,0.5)";
        }}
      >
        Skip for now — I&apos;ll fund my wallet later
      </button>
    </>
  );
}

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const resumeStartedRef = useRef(false);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Record<string, any>>({
    markets: [] as string[],
    lead_types: [] as string[],
    property_types: [] as string[],
    crm: "",
    crm_provider: "",
    budget: "",
    auto_buy: false,
    autobuy_disclaimer_accepted: false,
    max_per_day: 3,
    max_leads_per_day: null as number | null,
    max_leads_per_week: null as number | null,
    max_leads_per_month: null as number | null,
    min_balance: 500,
    purchase_path: null as null | "subscription" | "exclusive",
    selected_state: "",
    selected_states: [] as string[],
    selected_counties: [] as string[],
    nationwide: false,
    webhook_url: "",
  });
  const [countySearch, setCountySearch] = useState("");
  const [stateMenuOpen, setStateMenuOpen] = useState(false);
  const [stateQuery, setStateQuery] = useState("");
  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const [hookMsg, setHookMsg] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{
    open: boolean;
    title: string;
    content: string;
    icon: ObIcon;
  }>({
    open: false,
    title: "",
    content: "",
    icon: CircleHelp,
  });
  const [selectedSubscriptionPlan, setSelectedSubscriptionPlan] = useState<
    SubscriptionDto["plan_type"] | null
  >(null);
  const [showAutobuyDisclaimer, setShowAutobuyDisclaimer] = useState(false);

  // ── Legacy-account phone verification fallback ──────────────────────────
  // New signups already verify inline on the register form. This only ever
  // shows for accounts created before phone verification existed.
  const { data: authMe } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getAuthMe,
  });
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerifyError, setPhoneVerifyError] = useState<string | null>(null);
  const [phoneVerifySent, setPhoneVerifySent] = useState(false);
  const sendPhoneCodeMutation = useMutation({
    mutationFn: sendPhoneVerificationCode,
    onSuccess: () => setPhoneVerifySent(true),
    onError: (e: Error) => setPhoneVerifyError(e.message),
  });
  const verifyPhoneCodeMutation = useMutation({
    mutationFn: () => verifyPhoneVerificationCode(phoneOtp),
    onSuccess: () => {
      setPhoneVerifyError(null);
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (e: Error) => setPhoneVerifyError(e.message),
  });

  const {
    data: row,
    isLoading: onboardingLoading,
    isError: onboardingIsError,
    error: onboardingError,
    refetch: refetchOnboarding,
  } = useQuery({
    queryKey: queryKeys.onboarding.me,
    queryFn: getOnboardingMe,
  });

  const resumeRequested = searchParams.get("resume") === "1";
  const skippedFlag = Boolean(
    row?.data &&
    typeof row.data === "object" &&
    (row.data as { skipped?: boolean }).skipped === true,
  );

  /** Finished onboarding (not skipped) → dashboard. Skipped without ?resume=1 → dashboard. */
  useEffect(() => {
    if (onboardingLoading) return;
    if (!row?.completed_at) return;
    if (skippedFlag && resumeRequested) return;
    router.replace("/marketplace");
  }, [
    onboardingLoading,
    row?.completed_at,
    row?.current_step,
    skippedFlag,
    resumeRequested,
    router,
  ]);

  const resumeMutation = useMutation({
    mutationFn: () => {
      if (!row) return Promise.reject(new Error("No onboarding row"));
      return patchOnboardingMe({
        completed_at: null,
        data: {
          ...(row.data as Record<string, unknown>),
          skipped: false,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.me,
      });
      router.replace("/onboarding");
      resumeStartedRef.current = false;
    },
    onError: () => {
      resumeStartedRef.current = false;
    },
  });

  /** Resume skipped onboarding: clear completion so user can continue at saved step */
  useEffect(() => {
    if (onboardingLoading || !row) return;
    if (!resumeRequested || !row.completed_at || !skippedFlag) return;
    if (resumeStartedRef.current) return;
    resumeStartedRef.current = true;
    resumeMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resumeMutation.mutate stable; avoid loop on mutation ref
  }, [onboardingLoading, row, resumeRequested, skippedFlag]);

  useEffect(() => {
    if (!row) return;
    setStep(row.current_step);
    if (row.data && typeof row.data === "object") {
      setData((d) => ({ ...d, ...row.data }));
    }
  }, [row]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateOnboardingPayload) =>
      patchOnboardingMe(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.me });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wallet.transactions({ limit: 50, offset: 0 }),
      });
    },
  });

  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: queryKeys.subscriptions.plans,
    queryFn: getSubscriptionPlans,
  });
  const { data: currentSubscription } = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: getMySubscription,
  });

  const subscriptionCheckoutMutation = useMutation({
    mutationFn: checkoutSubscription,
    onSuccess: (result) => {
      window.location.href = result.url;
    },
  });

  const hasWalletFunding =
    Number(data.wallet_amount ?? 0) > 0 ||
    data.stripe_onboarding_funded === true;
  const hasProAutoPurchaseAccess =
    currentSubscription?.plan_type === "pro" &&
    (currentSubscription.status === "active" ||
      (currentSubscription.status === "cancelled" &&
        new Date(currentSubscription.current_period_end).getTime() >
          Date.now()));

  // Multi-state: county keys are "STATECODE:County Name"
  const toggleCounty = useCallback((key: string) => {
    setData((d) => {
      const arr: string[] = d.selected_counties || [];
      return {
        ...d,
        selected_counties: arr.includes(key)
          ? arr.filter((x) => x !== key)
          : [...arr, key],
      };
    });
  }, []);

  const toggleState = useCallback((code: string) => {
    setData((d) => {
      const states: string[] = d.selected_states || [];
      const removing = states.includes(code);
      const newStates = removing
        ? states.filter((s) => s !== code)
        : [...states, code];
      // Remove counties belonging to this state when deselecting
      const newCounties = removing
        ? ((d.selected_counties as string[]) || []).filter(
            (c) => !c.startsWith(`${code}:`),
          )
        : (d.selected_counties as string[]) || [];
      return {
        ...d,
        selected_states: newStates,
        selected_counties: newCounties,
        nationwide: false,
      };
    });
  }, []);

  const selectedStates: string[] = data.selected_states || [];

  // All counties across all selected states, as "STATECODE:County Name" entries
  const countiesForSelectedStates = useMemo(
    () =>
      selectedStates.flatMap((code) =>
        countiesForStateCode(code).map((c) => ({
          key: `${code}:${c}`,
          label: c,
          stateCode: code,
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedStates.join(",")],
  );

  const filteredCounties = useMemo(() => {
    const q = countySearch.trim().toLowerCase();
    if (!q) return countiesForSelectedStates;
    return countiesForSelectedStates.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.stateCode.toLowerCase().includes(q),
    );
  }, [countiesForSelectedStates, countySearch]);

  const filteredStates = useMemo(() => {
    const q = stateQuery.trim().toLowerCase();
    if (!q) return [...US_STATES];
    return US_STATES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [stateQuery]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!stateMenuOpen) return;
      const el = stateDropdownRef.current;
      if (el && !el.contains(e.target as Node)) setStateMenuOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [stateMenuOpen]);

  async function saveStep(nextStep: number) {
    try {
      const payloadData =
        step === 2
          ? {
              ...data,
              markets: buildMarketsFromGeo(data),
            }
          : data;
      if (step === 4 && String(data.webhook_url ?? "").trim()) {
        try {
          await patchWebhookIntegration(String(data.webhook_url).trim());
        } catch {
          /* non-blocking — user can fix in Settings */
        }
      }
      await saveMutation.mutateAsync({
        current_step: nextStep <= TOTAL_STEPS ? nextStep : TOTAL_STEPS,
        completed_steps: [step], // backend merges unique ints
        data: payloadData,
      });
      if (nextStep > TOTAL_STEPS) {
        await saveMutation.mutateAsync({
          completed_at: new Date().toISOString(),
        });
        router.push("/marketplace");
      } else {
        setStep(nextStep);
      }
    } catch {
      // Error state is surfaced via saveMutation.isError if needed
    }
  }

  async function skipOnboarding() {
    try {
      await saveMutation.mutateAsync({
        current_step: step,
        completed_at: new Date().toISOString(),
        data: { ...data, skipped: true },
      });
      router.push("/marketplace");
    } catch {
      // surfaced via mutation state
    }
  }

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  if (onboardingLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.45)",
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }

  if (row?.completed_at && !skippedFlag) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.45)",
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Redirecting…
      </div>
    );
  }

  if (row?.completed_at && skippedFlag && !resumeRequested) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.45)",
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Redirecting…
      </div>
    );
  }

  if (
    resumeRequested &&
    skippedFlag &&
    row?.completed_at &&
    resumeMutation.isPending
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#080a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.45)",
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Resuming setup…
      </div>
    );
  }

  return (
    <>
      <style>{`

@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }



.ob-root {

  min-height: 100vh;

  background: #080a0f;

  display: grid;

  grid-template-columns: 280px 1fr;

  font-family: 'DM Sans', sans-serif;

  color: white;

}



/* sidebar */

.sidebar {

  background: rgba(255,255,255,0.02);

  border-right: 1px solid rgba(255,255,255,0.06);

  padding: 36px 24px;

  display: flex;

  flex-direction: column;

  position: sticky;

  top: 0;

  height: 100vh;

  overflow-y: auto;

}



.brand {

  display: flex;

  align-items: center;

  gap: 10px;

  margin-bottom: 44px;

}



.brand-icon {

  width: 32px; height: 32px;

  background: linear-gradient(135deg, #6366f1, #10b981);

  border-radius: 8px;

  display: flex; align-items: center; justify-content: center;

}



.brand-name {

  font-family: 'Syne', sans-serif;

  font-size: 17px;

  font-weight: 700;

  color: #fff;

}



.steps-nav { flex: 1; }



.step-item {

  display: flex;

  align-items: center;

  gap: 12px;

  padding: 10px 12px;

  border-radius: 10px;

  cursor: pointer;

  transition: background 0.2s;

  margin-bottom: 2px;

}



.step-item:hover { background: rgba(255,255,255,0.04); }

.step-item.active { background: rgba(99,102,241,0.12); }



.step-num {

  width: 26px; height: 26px;

  border-radius: 50%;

  display: flex; align-items: center; justify-content: center;

  font-size: 11px;

  font-weight: 600;

  flex-shrink: 0;

  transition: background 0.2s, color 0.2s;

}



.step-num.done { background: #10b981; color: white; }

.step-num.active { background: #6366f1; color: white; }

.step-num.upcoming { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.4); }



.step-label {

  font-size: 13px;

  color: rgba(255,255,255,0.4);

  transition: color 0.2s;

}



.step-item.active .step-label { color: rgba(255,255,255,0.9); font-weight: 500; }

.step-item.done .step-label { color: rgba(255,255,255,0.55); }



/* main content */

.main {

  display: flex;

  flex-direction: column;

  min-height: 100vh;

}



.progress-bar-wrap {

  height: 3px;

  background: rgba(255,255,255,0.05);

}



.progress-bar-fill {

  height: 100%;

  background: linear-gradient(90deg, #6366f1, #10b981);

  transition: width 0.4s ease;

}



.content-area {

  flex: 1;

  display: flex;

  align-items: center;

  justify-content: center;

  padding: 60px 40px;

}



.step-card {

  width: 100%;

  max-width: 600px;

  animation: fadeIn 0.35s ease both;

}



@keyframes fadeIn {

  from { opacity: 0; transform: translateY(16px); }

  to { opacity: 1; transform: translateY(0); }

}



.step-icon-wrap {

  display: flex;

  align-items: center;

  justify-content: center;

  margin-bottom: 20px;

  color: rgba(255,255,255,0.92);

}

.step-icon-wrap svg { width: 44px; height: 44px; }



.step-title {

  font-family: 'Syne', sans-serif;

  font-size: 34px;

  font-weight: 800;

  letter-spacing: -1.2px;

  color: #fff;

  margin-bottom: 10px;

  line-height: 1.1;

}



.step-sub {

  font-size: 16px;

  color: rgba(255,255,255,0.45);

  margin-bottom: 40px;

  font-weight: 300;

}



/* tag selectors */

.tag-grid {

  display: flex;

  flex-wrap: wrap;

  gap: 8px;

  margin-bottom: 36px;

}



.tag {

  padding: 9px 16px;

  border-radius: 100px;

  border: 1px solid rgba(255,255,255,0.1);

  font-size: 13px;

  color: rgba(255,255,255,0.55);

  cursor: pointer;

  background: rgba(255,255,255,0.04);

  transition: all 0.18s;

  user-select: none;

}



.tag:hover { border-color: rgba(99,102,241,0.5); color: rgba(255,255,255,0.85); }

.tag.selected {

  background: rgba(99,102,241,0.15);

  border-color: #6366f1;

  color: #a5b4fc;

}

/* markets step — searchable state + counties (readable on dark UI) */
.geo-panel {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.geo-field-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: ;
  color: rgba(255,255,255,0.38);
  margin-bottom: 8px;
}
.geo-state-wrap { position: relative; width: 100%; }
.geo-state-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: #f8fafc;
  font-size: 15px;
  font-weight: 500;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.geo-state-trigger:hover {
  border-color: rgba(99,102,241,0.45);
  background: rgba(99,102,241,0.08);
}
.geo-state-trigger span:first-child {
  flex: 1;
  min-width: 0;
  color: rgba(255,255,255,0.92);
}
.geo-state-trigger .muted { color: rgba(255,255,255,0.38); font-weight: 400; }
.geo-chevron {
  flex-shrink: 0;
  color: rgba(255,255,255,0.45);
  transition: transform 0.2s;
}
.geo-state-wrap.open .geo-chevron { transform: rotate(180deg); color: #a5b4fc; }
.geo-dropdown {
  position: absolute;
  z-index: 40;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.1);
  background: #10131c;
  box-shadow: 0 18px 50px rgba(0,0,0,0.55);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: min(340px, 52vh);
}
.geo-state-search-wrap {
  padding: 10px 10px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0,0,0,0.2);
}
.geo-state-search-wrap svg { color: rgba(255,255,255,0.35); flex-shrink: 0; }
.geo-state-search {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: #f1f5f9;
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  outline: none;
}
.geo-state-search::placeholder { color: rgba(255,255,255,0.35); }
.geo-state-list {
  overflow-y: auto;
  padding: 6px;
  max-height: 260px;
}
.geo-state-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #e2e8f0;
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.geo-state-option:hover { background: rgba(99,102,241,0.12); color: #fff; }
.geo-state-option.on {
  background: rgba(99,102,241,0.18);
  color: #c7d2fe;
}
.geo-state-code {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.35);
  flex-shrink: 0;
}
.geo-switch-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
}
.geo-switch {
  position: relative;
  width: 48px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.08);
  cursor: pointer;
  padding: 0;
  transition: background 0.2s, border-color 0.2s;
}
.geo-switch.on {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-color: rgba(129,140,248,0.5);
}
.geo-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  transition: transform 0.2s ease;
}
.geo-switch.on .geo-switch-thumb { transform: translateX(20px); }
.geo-switch-label { flex: 1; min-width: 0; }
.geo-switch-title { font-size: 15px; font-weight: 600; color: #f8fafc; margin-bottom: 4px; }
.geo-switch-desc { font-size: 12px; color: rgba(255,255,255,0.42); line-height: 1.45; }
.geo-county-search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(0,0,0,0.22);
  margin-bottom: 10px;
}
.geo-county-search-wrap svg { color: rgba(255,255,255,0.38); flex-shrink: 0; }
.geo-county-search {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: #f8fafc;
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  outline: none;
}
.geo-county-search::placeholder { color: rgba(255,255,255,0.35); }
.geo-county-panel {
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
  overflow: hidden;
}
.geo-county-scroll {
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
}
.geo-county-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: 'DM Sans', sans-serif;
  transition: background 0.12s;
}
.geo-county-row:hover { background: rgba(255,255,255,0.05); }
.geo-county-row.on { background: rgba(99,102,241,0.1); }
.geo-check {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 2px solid rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
  color: transparent;
}
.geo-county-row.on .geo-check {
  border-color: #818cf8;
  background: rgba(99,102,241,0.35);
  color: #fff;
}
.geo-county-name {
  font-size: 14px;
  color: #f1f5f9;
  line-height: 1.35;
}
.geo-empty {
  padding: 20px 14px;
  font-size: 13px;
  color: rgba(255,255,255,0.45);
  text-align: center;
  line-height: 1.5;
}
.geo-hint {
  font-size: 12px;
  color: rgba(255,255,255,0.38);
  line-height: 1.5;
  margin-top: 4px;
}

/* how it works cards */

.how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 36px; }



.how-card {

  background: rgba(255,255,255,0.03);

  border: 1px solid rgba(255,255,255,0.07);

  border-radius: 14px;

  padding: 20px;

}



.how-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 10px; color: rgba(255,255,255,0.88); }
.how-icon svg { width: 24px; height: 24px; }

.how-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 6px; }

.how-desc { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.6; }



/* plan cards */

.plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 36px; }



.plan-card {

  background: rgba(255,255,255,0.03);

  border: 2px solid rgba(255,255,255,0.06);

  border-radius: 16px;

  padding: 22px;

  cursor: pointer;

  transition: all 0.2s;

}



.plan-card:hover { border-color: rgba(99,102,241,0.4); }

.plan-card.selected { border-color: #6366f1; background: rgba(99,102,241,0.08); }



.plan-name { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; margin-top: 10px; }

.plan-price { font-size: 13px; color: #10b981; margin-bottom: 10px; }

.plan-desc { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.6; }



/* property type cards */

.ptype-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 36px; }

.ptype-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  text-align: left;
  background: rgba(255,255,255,0.03);
  border: 2px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'DM Sans', sans-serif;
}

.ptype-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.05); }

.ptype-card.selected { border-color: #6366f1; background: rgba(99,102,241,0.1); }

.ptype-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.65);
  transition: background 0.2s, color 0.2s;
}

.ptype-card.selected .ptype-icon-wrap { background: rgba(99,102,241,0.25); color: #a5b4fc; }

.ptype-title { font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 3px; }

.ptype-desc { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5; }

.ptype-check {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(99,102,241,0.4);
}

@media (max-width: 560px) {
  .ptype-grid { grid-template-columns: 1fr; }
}



/* wallet */

.wallet-display {

  background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.08));

  border: 1px solid rgba(99,102,241,0.2);

  border-radius: 18px;

  padding: 28px;

  margin-bottom: 20px;

  text-align: center;

}



.wallet-label { font-size: 12px; color: rgba(255,255,255,0.4); text-transform: ; letter-spacing: 1px; margin-bottom: 8px; }

.wallet-balance { font-family: 'Syne', sans-serif; font-size: 48px; font-weight: 800; color: #fff; }

.wallet-currency { font-size: 20px; color: rgba(255,255,255,0.5); margin-right: 4px; }



.amount-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }



.amount-btn {

  background: rgba(255,255,255,0.04);

  border: 1px solid rgba(255,255,255,0.08);

  border-radius: 10px;

  padding: 12px 8px;

  font-size: 14px;

  font-weight: 500;

  color: rgba(255,255,255,0.7);

  cursor: pointer;

  transition: all 0.18s;

  font-family: 'DM Sans', sans-serif;

}



.amount-btn:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.4); }

.amount-btn.selected { background: rgba(99,102,241,0.15); border-color: #6366f1; color: #a5b4fc; }



/* toggle */

.toggle-row {

  display: flex;

  align-items: center;

  justify-content: space-between;

  background: rgba(255,255,255,0.03);

  border: 1px solid rgba(255,255,255,0.07);

  border-radius: 14px;

  padding: 18px 20px;

  margin-bottom: 20px;

}



.toggle-info {}

.toggle-title { font-size: 15px; font-weight: 500; color: #fff; margin-bottom: 3px; }

.toggle-desc { font-size: 12px; color: rgba(255,255,255,0.35); }



.toggle {

  width: 46px; height: 26px;

  background: rgba(255,255,255,0.1);

  border-radius: 13px;

  position: relative;

  cursor: pointer;

  transition: background 0.2s;

  flex-shrink: 0;

  border: none;

  outline: none;

}



.toggle.on { background: #6366f1; }



.toggle-thumb {

  position: absolute;

  top: 3px; left: 3px;

  width: 20px; height: 20px;

  background: white;

  border-radius: 50%;

  transition: transform 0.2s;

}



.toggle.on .toggle-thumb { transform: translateX(20px); }



/* range */

.range-field { margin-bottom: 20px; }

.range-label { display: flex; justify-content: space-between; margin-bottom: 8px; }

.range-label span:first-child { font-size: 13px; color: rgba(255,255,255,0.55); }

.range-label span:last-child { font-size: 13px; font-weight: 600; color: #fff; }



input[type=range] {

  width: 100%;

  -webkit-appearance: none;

  height: 4px;

  background: rgba(255,255,255,0.1);

  border-radius: 2px;

  outline: none;

}



input[type=range]::-webkit-slider-thumb {

  -webkit-appearance: none;

  width: 18px; height: 18px;

  border-radius: 50%;

  background: #6366f1;

  cursor: pointer;

}



/* resources */

.resource-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 36px; }



.resource-card {

  background: rgba(255,255,255,0.03);

  border: 1px solid rgba(255,255,255,0.07);

  border-radius: 14px;

  padding: 18px;

  cursor: pointer;

  transition: border-color 0.2s;

}



.resource-card:hover { border-color: rgba(99,102,241,0.4); }

.resource-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 8px; color: rgba(255,255,255,0.85); }
.resource-icon svg { width: 22px; height: 22px; }

.resource-title { font-size: 14px; font-weight: 500; color: #fff; margin-bottom: 4px; }

.resource-desc { font-size: 12px; color: rgba(255,255,255,0.35); }



/* success */

.success-wrap { text-align: center; padding: 20px 0; }

.success-icon {

  width: 80px; height: 80px;

  background: linear-gradient(135deg, #6366f1, #10b981);

  border-radius: 50%;

  display: flex; align-items: center; justify-content: center;

  margin: 0 auto 28px;

  color: #fff;

}
.success-icon svg { width: 40px; height: 40px; }



.checklist { text-align: left; margin: 28px 0 36px; display: flex; flex-direction: column; gap: 10px; }

.check-item {

  display: flex;

  align-items: center;

  gap: 12px;

  background: rgba(16,185,129,0.07);

  border: 1px solid rgba(16,185,129,0.2);

  border-radius: 10px;

  padding: 12px 16px;

}



.check-item span { font-size: 13px; color: rgba(255,255,255,0.7); }



/* footer nav */

.footer-nav {

  padding: 24px 40px;

  border-top: 1px solid rgba(255,255,255,0.05);

  display: flex;

  justify-content: space-between;

  align-items: center;

}



.step-counter { font-size: 13px; color: rgba(255,255,255,0.3); }



.nav-btns { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; }



.btn-back {

  padding: 13px 22px;

  background: rgba(255,255,255,0.05);

  border: 1px solid rgba(255,255,255,0.08);

  border-radius: 11px;

  color: rgba(255,255,255,0.55);

  font-size: 14px;

  cursor: pointer;

  font-family: 'DM Sans', sans-serif;

  transition: background 0.2s;

}

.btn-back:hover { background: rgba(255,255,255,0.08); }

.btn-skip {
  padding: 13px 20px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 11px;
  color: rgba(255,255,255,0.45);
  font-size: 14px;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.btn-skip:hover:not(:disabled) {
  color: rgba(255,255,255,0.88);
  border-color: rgba(255,255,255,0.22);
  background: rgba(255,255,255,0.05);
}
.btn-skip:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-next {

  padding: 13px 28px;

  background: linear-gradient(135deg, #6366f1, #8b5cf6);

  border: none;

  border-radius: 11px;

  color: #fff;

  font-size: 14px;

  font-weight: 600;

  cursor: pointer;

  font-family: 'Syne', sans-serif;

  transition: opacity 0.2s, transform 0.15s;

  display: flex; align-items: center; gap: 6px;

}

.btn-next:hover { opacity: 0.9; transform: translateY(-1px); }

.btn-next:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }



@keyframes spin { to { transform: rotate(360deg); } }

.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }



@media (max-width: 768px) {

  .ob-root { grid-template-columns: 1fr; }

  .sidebar { display: none; }

  .content-area { padding: 32px 20px; }

  .how-grid, .plan-grid, .amount-grid, .resource-grid { grid-template-columns: 1fr; }

  .footer-nav { padding: 16px 20px; }
  /* MODAL STYLES */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px); z-index: 100;
          display: flex; align-items: center; justify-content: center;
          animation: modalIn 0.3s ease-out;
        }

        .modal-content {
          background: #0f111a; border: 1px solid rgba(255,255,255,0.1);
          width: 90%; max-width: 500px; padding: 40px; border-radius: 24px;
          position: relative; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        @keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        .btn-info {
          font-size: 11px; color: #6366f1; background: rgba(99,102,241,0.1);
          padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(99,102,241,0.2);
          cursor: pointer; margin-top: 8px; transition: 0.2s;
        }
        .btn-info:hover { background: rgba(99,102,241,0.2); }

        /* SUCCESS ANIMATION */
        .success-icon {
          animation: bounce 2s infinite;
        }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

}

`}</style>

      {/* Autobuy disclaimer modal — non-Pro users only */}
      {showAutobuyDisclaimer && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAutobuyDisclaimer(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(4,6,12,0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0f111a",
              padding: 26,
              boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <AlertTriangle size={20} color="#facc15" />
              <strong style={{ fontSize: 16, color: "#fff" }}>
                You&apos;re not subscribed
              </strong>
            </div>
            <p
              style={{
                fontSize: 13.5,
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.65,
                marginBottom: 20,
              }}
            >
              You are not currently subscribed. If you turn on autobuy, you
              agree to be charged the full lead price for each lead purchased
              automatically. Subscribers unlock $25 discounted autobuy pricing,
              early access, and non-exclusive leads.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAutobuyDisclaimer(false)}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-next"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  setData((d) => ({
                    ...d,
                    auto_buy: true,
                    autobuy_disclaimer_accepted: true,
                  }));
                  setShowAutobuyDisclaimer(false);
                }}
              >
                I agree, turn on autobuy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModal.open &&
        (() => {
          const Icon = infoModal.icon;
          return (
            <div
              onClick={() => setInfoModal({ ...infoModal, open: false })}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                background: "rgba(4,6,12,0.82)",
                backdropFilter: "blur(10px)",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 560,
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.11)",
                  background:
                    "radial-gradient(120% 140% at 0% 0%, rgba(99,102,241,0.2), transparent 45%), #070a12",
                  boxShadow: "0 28px 80px rgba(0,0,0,0.55)",
                  padding: "28px 28px 24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(16,185,129,0.22))",
                      border: "1px solid rgba(129,140,248,0.35)",
                    }}
                  >
                    <Icon
                      size={22}
                      strokeWidth={1.9}
                      className="text-indigo-100"
                      aria-hidden
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setInfoModal({ ...infoModal, open: false })}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.68)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}
                    aria-label="Close details"
                  >
                    <X size={16} />
                  </button>
                </div>
                <h3
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 28,
                    letterSpacing: -0.7,
                    marginBottom: 10,
                  }}
                >
                  {infoModal.title}
                </h3>
                <p
                  style={{
                    color: "rgba(255,255,255,0.68)",
                    lineHeight: 1.75,
                    fontSize: 14,
                    marginBottom: 22,
                  }}
                >
                  {infoModal.content}
                </p>
                <button
                  className="btn-next"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setInfoModal({ ...infoModal, open: false })}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      <div className="ob-root">
        {onboardingIsError && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px 20px",
              background: "rgba(239,68,68,0.12)",
              borderBottom: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5",
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              {onboardingError instanceof Error
                ? onboardingError.message
                : "Could not load onboarding"}
            </span>
            <button
              type="button"
              onClick={() => void refetchOnboarding()}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(252,165,165,0.4)",
                background: "rgba(0,0,0,0.2)",
                color: "#fecaca",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
              }}
            >
              Retry
            </button>
          </div>
        )}
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              <Zap
                size={16}
                strokeWidth={2}
                style={{ color: "#fff" }}
                aria-hidden
              />
            </div>
            <span className="brand-name">Newleey</span>
          </div>

          <nav className="steps-nav">
            {STEP_META.map((s, i) => {
              const n = i + 1;
              const state =
                n < step ? "done" : n === step ? "active" : "upcoming";
              return (
                <div key={n} className={`step-item ${state}`}>
                  <div className={`step-num ${state}`}>
                    {state === "done" ? (
                      <Check size={12} strokeWidth={3} aria-hidden />
                    ) : (
                      n
                    )}
                  </div>
                  <span className="step-label">{s.title}</span>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="progress-bar-wrap">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="content-area">
            <div className="step-card" key={step}>
              {(() => {
                const m = STEP_META[step - 1];
                const Hi = m.Icon;
                return (
                  <>
                    <span className="step-icon-wrap">
                      <Hi size={44} strokeWidth={1.5} />
                    </span>
                    <h2 className="step-title">{m.title}</h2>
                    <p className="step-sub">{m.sub}</p>
                  </>
                );
              })()}

              {/* Step 1 - Welcome */}
              {step === 1 && (
                <>
                  {authMe && authMe.phone_verified === false && (
                    <div
                      style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.24)",
                        borderRadius: 14,
                        padding: "16px 18px",
                        marginBottom: 24,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        <Bell size={16} color="#facc15" />
                        <strong style={{ fontSize: 14, color: "#fff" }}>
                          Verify your phone number
                        </strong>
                      </div>
                      <p
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.6)",
                          lineHeight: 1.6,
                          marginBottom: 12,
                        }}
                      >
                        We need this so you can receive lead alerts, wallet
                        alerts, and account notifications.
                      </p>
                      {phoneVerifyError && (
                        <p
                          style={{
                            fontSize: 12,
                            color: "#fca5a5",
                            marginBottom: 10,
                          }}
                        >
                          {phoneVerifyError}
                        </p>
                      )}
                      {!phoneVerifySent ? (
                        <button
                          type="button"
                          className="btn-next"
                          style={{ padding: "10px 18px", fontSize: 13 }}
                          disabled={sendPhoneCodeMutation.isPending}
                          onClick={() =>
                            void sendPhoneCodeMutation.mutateAsync()
                          }
                        >
                          {sendPhoneCodeMutation.isPending
                            ? "Sending…"
                            : "Send verification code"}
                        </button>
                      ) : (
                        <div
                          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter code"
                            value={phoneOtp}
                            onChange={(e) => setPhoneOtp(e.target.value)}
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 10,
                              padding: "10px 14px",
                              color: "#fff",
                              fontSize: 14,
                              outline: "none",
                              maxWidth: 160,
                            }}
                          />
                          <button
                            type="button"
                            className="btn-next"
                            style={{ padding: "10px 18px", fontSize: 13 }}
                            disabled={verifyPhoneCodeMutation.isPending}
                            onClick={() =>
                              void verifyPhoneCodeMutation.mutateAsync()
                            }
                          >
                            {verifyPhoneCodeMutation.isPending
                              ? "Verifying…"
                              : "Verify"}
                          </button>
                          <button
                            type="button"
                            className="btn-back"
                            style={{ padding: "10px 18px", fontSize: 13 }}
                            disabled={sendPhoneCodeMutation.isPending}
                            onClick={() =>
                              void sendPhoneCodeMutation.mutateAsync()
                            }
                          >
                            Resend
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {authMe && authMe.phone_verified === true && (
                    <div
                      style={{
                        background: "rgba(16,185,129,0.07)",
                        border: "1px solid rgba(16,185,129,0.2)",
                        borderRadius: 12,
                        padding: "10px 14px",
                        marginBottom: 24,
                        fontSize: 12,
                        color: "#34d399",
                      }}
                    >
                      ✓ Phone verified
                    </div>
                  )}
                  <div className="how-grid">
                    {[
                      {
                        Icon: Search,
                        t: "Find Leads",
                        d: "Browse thousands of motivated seller leads — inherited, foreclosure, divorce, and more — from markets across the country.",
                      },
                      {
                        Icon: MapPin,
                        t: "Choose Your Market",
                        d: "Target the exact cities, counties, or states where you buy. Get leads from all markets or narrow it down to your backyard.",
                      },
                      {
                        Icon: Link2,
                        t: "Set Up Your CRM",
                        d: "Send leads straight to GoHighLevel, Zapier, Lead Connector, or any webhook — automated on every purchase.",
                      },
                      {
                        Icon: ShoppingBag,
                        t: "Scale Your Business",
                        d: "Buy your first lead, track deal progress, and manage your entire pipeline in one place.",
                      },
                    ].map((c) => {
                      const I = c.Icon;
                      return (
                        <div key={c.t} className="how-card">
                          <div className="how-icon">
                            <I size={24} strokeWidth={2} />
                          </div>
                          <div className="how-title">{c.t}</div>
                          <div className="how-desc">{c.d}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Step 2 — hidden for now, kept for future use */}
              {false && step === 2 && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 20 }}
                >
                  <div
                    style={{
                      padding: "16px 18px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <Video size={18} color="#a5b4fc" />
                      <strong style={{ fontSize: 14, color: "#fff" }}>
                        Understand the platform before you spend a dollar
                      </strong>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.55)",
                        lineHeight: 1.65,
                      }}
                    >
                      Watch the walkthrough below, then choose the inventory
                      model that fits your buying style.
                    </p>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 16,
                    }}
                  >
                    <div className="how-card" style={{ minHeight: 160 }}>
                      <div className="how-icon">
                        <Star size={24} strokeWidth={2} />
                      </div>
                      <div className="how-title">Premium Leads</div>
                      <div className="how-desc">
                        For subscribers only: pre-vetted cold call leads with
                        monthly premium credits on Basic or Pro.
                      </div>
                    </div>
                    <div className="how-card" style={{ minHeight: 160 }}>
                      <div className="how-icon">
                        <Target size={24} strokeWidth={2} />
                      </div>
                      <div className="how-title">Exclusive Leads</div>
                      <div className="how-desc">
                        Inbound leads qualified via SMS and purchased directly
                        from your wallet.
                      </div>
                    </div>
                  </div>
                  {process.env.NEXT_PUBLIC_ONBOARDING_VIDEO_URL ? (
                    <div
                      style={{
                        position: "relative",
                        paddingBottom: "56.25%",
                        height: 0,
                        borderRadius: 14,
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <iframe
                        title="How lead buying works"
                        src={process.env.NEXT_PUBLIC_ONBOARDING_VIDEO_URL}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                        }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        borderRadius: 14,
                        border: "1px dashed rgba(255,255,255,0.15)",
                        padding: "28px 20px",
                        textAlign: "center",
                        color: "rgba(255,255,255,0.35)",
                        fontSize: 13,
                      }}
                    >
                      Set{" "}
                      <code style={{ color: "#a5b4fc" }}>
                        NEXT_PUBLIC_ONBOARDING_VIDEO_URL
                      </code>{" "}
                      to embed your walkthrough video.
                    </div>
                  )}
                </div>
              )}

              {/* Step 5 — Pro Plan vs Free Plan */}
              {step === 5 && (
                <>
                  <div
                    className="plan-grid"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {/* Pro Plan */}
                    {subscriptionPlans
                      .filter((p) => p.planType === "pro")
                      .map((plan) => (
                        <div
                          key={plan.planType}
                          role="button"
                          tabIndex={0}
                          className={`plan-card ${data.purchase_path === "subscription" && selectedSubscriptionPlan === "pro" ? "selected" : ""}`}
                          onClick={() => {
                            setData((d) => ({
                              ...d,
                              purchase_path: "subscription",
                              model: "subscription",
                            }));
                            setSelectedSubscriptionPlan("pro");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setData((d) => ({
                                ...d,
                                purchase_path: "subscription",
                                model: "subscription",
                              }));
                              setSelectedSubscriptionPlan("pro");
                            }
                          }}
                          style={{ position: "relative" }}
                        >
                          {/* First-month discount badge */}
                          <div
                            style={{
                              position: "absolute",
                              top: -1,
                              right: -1,
                              background:
                                "linear-gradient(135deg, #f59e0b, #d97706)",
                              color: "#000",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "4px 10px",
                              borderRadius: "0 12px 0 10px",
                              letterSpacing: "0.02em",
                            }}
                          >
                            Exclusive Discounted prices in just $49
                          </div>
                          <div className="plan-name">Pro Plan</div>
                          {/* <div
                            className="plan-price"
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 6,
                            }}
                          >
                            $49
                            <span
                              style={{
                                fontSize: 14,
                                color: "rgba(255,255,255,0.45)",
                                fontWeight: 400,
                              }}
                            >
                              /month
                            </span>
                          </div> */}
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(255,255,255,0.35)",
                              marginBottom: 8,
                              marginTop: -4,
                            }}
                          >
                            Membership is $49/month · cancel anytime
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            {[
                              "Shared inbound leads — $25 each (up to 5 buyers)",
                              "Exclusive leads — $150 each",
                              "60-min early access to new listings",
                              "Auto-delivery of fresh matching leads",
                            ].map((f) => (
                              <div
                                key={f}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  fontSize: 13,
                                  color: "rgba(255,255,255,0.75)",
                                }}
                              >
                                <Check
                                  size={14}
                                  strokeWidth={2.5}
                                  style={{ color: "#10b981", flexShrink: 0 }}
                                />
                                {f}
                              </div>
                            ))}
                          </div>
                          <div
                            style={{
                              marginTop: 16,
                              fontSize: 11,
                              color: "rgba(255,255,255,0.35)",
                            }}
                          >
                            Proceeds to Stripe checkout →
                          </div>
                        </div>
                      ))}

                    {/* Free Plan */}
                    <div
                      role="button"
                      tabIndex={0}
                      className={`plan-card ${data.purchase_path === "exclusive" ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedSubscriptionPlan(null);
                        setData((d) => ({
                          ...d,
                          purchase_path: "exclusive",
                          model: "exclusive_wallet",
                        }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedSubscriptionPlan(null);
                          setData((d) => ({
                            ...d,
                            purchase_path: "exclusive",
                            model: "exclusive_wallet",
                          }));
                        }
                      }}
                    >
                      <div className="plan-name">Free Plan</div>
                      <div
                        className="plan-price"
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                        }}
                      >
                        $0
                        <span
                          style={{
                            fontSize: 14,
                            color: "rgba(255,255,255,0.45)",
                            fontWeight: 400,
                          }}
                        >
                          /month
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.4)",
                          marginBottom: 14,
                          marginTop: -4,
                        }}
                      >
                        No subscription required
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {[
                          "Fund your wallet and buy from the marketplace",
                          "Full access to all available leads",
                          "Pay only for what you buy",
                        ].map((f) => (
                          <div
                            key={f}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 13,
                              color: "rgba(255,255,255,0.75)",
                            }}
                          >
                            <Check
                              size={14}
                              strokeWidth={2.5}
                              style={{ color: "#6366f1", flexShrink: 0 }}
                            />
                            {f}
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: 16,
                          fontSize: 11,
                          color: "rgba(255,255,255,0.35)",
                        }}
                      >
                        Continue to wallet funding →
                      </div>
                    </div>
                  </div>

                  {data.purchase_path === "subscription" && (
                    <div style={{ marginTop: 12 }}>
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.55)",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Sparkles size={14} color="#c4b5fd" />
                        Continue opens Stripe checkout. You can finish geography
                        &amp; webhook after you return.
                      </p>
                    </div>
                  )}
                  {data.purchase_path === "exclusive" && (
                    <div style={{ marginTop: 12 }}>
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.55)",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Sparkles size={14} color="#818cf8" />
                        Free Plan confirmed. Continue to wallet funding if you
                        want buying power now, or add funds later from Wallet.
                        Auto Purchase is available only with Pro.
                      </p>
                    </div>
                  )}
                  {subscriptionCheckoutMutation.isError ? (
                    <p
                      style={{ color: "#fca5a5", fontSize: 12, marginTop: 10 }}
                    >
                      {subscriptionCheckoutMutation.error instanceof Error
                        ? subscriptionCheckoutMutation.error.message
                        : "Could not start subscription checkout."}
                    </p>
                  ) : null}
                </>
              )}

              {/* Step 6 - Wallet (real Stripe payment) */}
              {step === 6 && (
                <Elements stripe={stripePromise}>
                  <WalletFundForm
                    onSuccess={async (fundedDollars) => {
                      await saveMutation.mutateAsync({
                        current_step: 7,
                        completed_steps: [6],
                        data: {
                          ...data,
                          wallet_amount: String(fundedDollars),
                          initial_funding_applied: true,
                          stripe_onboarding_funded: true,
                        },
                      });
                      setData((d) => ({
                        ...d,
                        wallet_amount: String(fundedDollars),
                        initial_funding_applied: true,
                        stripe_onboarding_funded: true,
                      }));
                      setStep(7);
                    }}
                    onSkip={() => void saveStep(7)}
                    isSaving={saveMutation.isPending}
                  />
                </Elements>
              )}

              {/* Step 7 - Distribution limits (Auto-buy) */}
              {step === 7 && (
                <>
                  <div className="toggle-row">
                    <div className="toggle-info">
                      <div className="toggle-title">Enable Auto Purchase</div>
                      <div className="toggle-desc">
                        {hasProAutoPurchaseAccess
                          ? "Choose your target markets first, then turn this on to auto-buy exclusive and non-exclusive leads at your discounted Pro price."
                          : "Available to everyone. Free Plan buyers auto-buy exclusive leads at full price — subscribe to Pro for $25 discounted non-exclusive pricing and early access."}
                      </div>
                    </div>
                    <button
                      className={`toggle ${data.auto_buy ? "on" : ""}`}
                      onClick={() => {
                        if (
                          !data.auto_buy &&
                          !hasProAutoPurchaseAccess &&
                          !data.autobuy_disclaimer_accepted
                        ) {
                          setShowAutobuyDisclaimer(true);
                          return;
                        }
                        setData((d) => ({ ...d, auto_buy: !d.auto_buy }));
                      }}
                    >
                      <div className="toggle-thumb" />
                    </button>
                  </div>
                  {!hasProAutoPurchaseAccess ? (
                    <div
                      style={{
                        background: "rgba(99,102,241,0.08)",
                        border: "1px solid rgba(99,102,241,0.22)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        marginBottom: 14,
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <AlertTriangle
                        size={16}
                        style={{
                          color: "#a5b4fc",
                          marginTop: 1,
                          flexShrink: 0,
                        }}
                      />
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.72)",
                          lineHeight: 1.6,
                        }}
                      >
                        Auto Purchase is available to everyone. Free Plan buyers
                        auto-buy at the full exclusive price; Pro subscribers
                        unlock $25 discounted non-exclusive pricing and early
                        access on top.
                      </p>
                    </div>
                  ) : null}
                  {data.auto_buy && !hasWalletFunding ? (
                    <div
                      style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.24)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        marginBottom: 14,
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <AlertTriangle
                        size={16}
                        style={{
                          color: "#facc15",
                          marginTop: 1,
                          flexShrink: 0,
                        }}
                      />
                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.72)",
                          lineHeight: 1.6,
                        }}
                      >
                        Auto Purchase can be configured now, but purchases will
                        wait until wallet funds are available.
                      </p>
                    </div>
                  ) : null}

                  {/* Daily/weekly/monthly caps — collected regardless of Pro status so the
                      readiness gate (autobuy eligibility) has real numbers to check. */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 12,
                      marginBottom: 20,
                    }}
                  >
                    {[
                      { key: "max_leads_per_day", label: "Daily limit" },
                      { key: "max_leads_per_week", label: "Weekly limit" },
                      { key: "max_leads_per_month", label: "Monthly limit" },
                    ].map(({ key, label }) => (
                      <div key={key} className="field">
                        <label
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "rgba(255,255,255,0.5)",
                            marginBottom: 6,
                          }}
                        >
                          {label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          placeholder="No limit"
                          value={data[key] ?? ""}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              [key]:
                                e.target.value === "" ? null : +e.target.value,
                            }))
                          }
                          style={{
                            width: "100%",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 10,
                            padding: "10px 12px",
                            color: "#fff",
                            fontSize: 14,
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {data.auto_buy && (
                    <>
                      <div className="range-field">
                        <div className="range-label">
                          <span>Max leads per day</span>
                          <span>{data.max_per_day}</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={20}
                          value={data.max_per_day}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              max_per_day: +e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="range-field">
                        <div className="range-label">
                          <span>Minimum wallet balance</span>
                          <span>${data.min_balance}</span>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={2000}
                          step={100}
                          value={data.min_balance}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              min_balance: +e.target.value,
                            }))
                          }
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Step 2 - Lead coverage: multi-state / counties / nationwide */}
              {step === 2 && (
                <div className="geo-panel">
                  {/* Nationwide toggle */}
                  <div className="geo-switch-row">
                    <button
                      type="button"
                      className={`geo-switch ${data.nationwide ? "on" : ""}`}
                      role="switch"
                      aria-checked={Boolean(data.nationwide)}
                      onClick={() =>
                        setData((d) => ({
                          ...d,
                          nationwide: !d.nationwide,
                          selected_states: [],
                          selected_counties: [],
                        }))
                      }
                    >
                      <span className="geo-switch-thumb" />
                    </button>
                    <div className="geo-switch-label">
                      <div className="geo-switch-title">
                        Nationwide coverage
                      </div>
                      <div className="geo-switch-desc">
                        Target every supported county across all states. You can
                        refine markets later in Settings → Distribution.
                      </div>
                    </div>
                  </div>

                  {!data.nationwide && (
                    <>
                      {/* State checkbox list */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <span
                            className="geo-field-label"
                            style={{ marginBottom: 0 }}
                          >
                            States
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const allCodes = filteredStates.map(
                                (s) => s.code,
                              );
                              const allSelected = allCodes.every((c) =>
                                selectedStates.includes(c),
                              );
                              if (allSelected) {
                                setData((d) => ({
                                  ...d,
                                  selected_states: [],
                                  selected_counties: [],
                                }));
                              } else {
                                setData((d) => ({
                                  ...d,
                                  selected_states: [
                                    ...new Set([
                                      ...d.selected_states,
                                      ...allCodes,
                                    ]),
                                  ],
                                  nationwide: false,
                                }));
                              }
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#a5b4fc",
                              fontSize: 12,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            {filteredStates.every((s) =>
                              selectedStates.includes(s.code),
                            )
                              ? "Deselect all"
                              : "Select all"}
                          </button>
                        </div>
                        <div
                          className="geo-state-search-wrap"
                          style={{ marginBottom: 8 }}
                        >
                          <Search size={16} strokeWidth={2} aria-hidden />
                          <input
                            type="search"
                            className="geo-state-search"
                            placeholder="Search states…"
                            value={stateQuery}
                            onChange={(e) => setStateQuery(e.target.value)}
                            aria-label="Search states"
                          />
                        </div>
                        <div className="geo-county-panel">
                          <div className="geo-county-scroll">
                            {filteredStates.length === 0 ? (
                              <div className="geo-empty">
                                No states match your search.
                              </div>
                            ) : (
                              filteredStates.map((s) => {
                                const isOn = selectedStates.includes(s.code);
                                return (
                                  <button
                                    key={s.code}
                                    type="button"
                                    className={`geo-county-row ${isOn ? "on" : ""}`}
                                    onClick={() => {
                                      toggleState(s.code);
                                      setCountySearch("");
                                    }}
                                  >
                                    <span
                                      className={`geo-check ${isOn ? "on" : ""}`}
                                      aria-hidden
                                    >
                                      {isOn ? (
                                        <Check size={14} strokeWidth={3} />
                                      ) : null}
                                    </span>
                                    <span className="geo-county-name">
                                      {s.name}
                                    </span>
                                    <span
                                      style={{
                                        marginLeft: "auto",
                                        fontSize: 11,
                                        color: "rgba(255,255,255,0.3)",
                                        paddingRight: 4,
                                      }}
                                    >
                                      {s.code}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                        {selectedStates.length > 0 && (
                          <p className="geo-hint" style={{ marginTop: 8 }}>
                            {selectedStates.length}{" "}
                            {selectedStates.length === 1 ? "state" : "states"}{" "}
                            selected
                          </p>
                        )}
                      </div>

                      {/* County checkbox list */}
                      {selectedStates.length > 0 && (
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <span
                              className="geo-field-label"
                              style={{ marginBottom: 0 }}
                            >
                              Counties
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const allKeys = filteredCounties.map(
                                  (c) => c.key,
                                );
                                const allSelected = allKeys.every((k) =>
                                  (data.selected_counties || []).includes(k),
                                );
                                if (allSelected) {
                                  setData((d) => ({
                                    ...d,
                                    selected_counties: (
                                      d.selected_counties || []
                                    ).filter(
                                      (c: string) => !allKeys.includes(c),
                                    ),
                                  }));
                                } else {
                                  setData((d) => ({
                                    ...d,
                                    selected_counties: [
                                      ...new Set([
                                        ...(d.selected_counties || []),
                                        ...allKeys,
                                      ]),
                                    ],
                                  }));
                                }
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#a5b4fc",
                                fontSize: 12,
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              {filteredCounties.every((c) =>
                                (data.selected_counties || []).includes(c.key),
                              )
                                ? "Deselect all"
                                : "Select all"}
                            </button>
                          </div>
                          <div className="geo-county-search-wrap">
                            <Search size={16} strokeWidth={2} aria-hidden />
                            <input
                              type="search"
                              className="geo-county-search"
                              placeholder="Search counties…"
                              value={countySearch}
                              onChange={(e) => setCountySearch(e.target.value)}
                              aria-label="Search counties"
                            />
                          </div>
                          <div className="geo-county-panel">
                            <div className="geo-county-scroll">
                              {filteredCounties.length === 0 ? (
                                <div className="geo-empty">
                                  {countiesForSelectedStates.length === 0
                                    ? "No county list available for selected states yet."
                                    : `No counties match "${countySearch.trim()}".`}
                                </div>
                              ) : (
                                filteredCounties.map(
                                  ({ key, label, stateCode }) => {
                                    const on = (
                                      data.selected_counties || []
                                    ).includes(key);
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        className={`geo-county-row ${on ? "on" : ""}`}
                                        onClick={() => toggleCounty(key)}
                                      >
                                        <span
                                          className={`geo-check ${on ? "on" : ""}`}
                                          aria-hidden
                                        >
                                          {on ? (
                                            <Check size={14} strokeWidth={3} />
                                          ) : null}
                                        </span>
                                        <span className="geo-county-name">
                                          {label}
                                        </span>
                                        {selectedStates.length > 1 && (
                                          <span
                                            style={{
                                              marginLeft: "auto",
                                              fontSize: 10,
                                              color: "rgba(255,255,255,0.3)",
                                              paddingRight: 4,
                                            }}
                                          >
                                            {stateCode}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  },
                                )
                              )}
                            </div>
                          </div>
                          {(data.selected_counties || []).length > 0 && (
                            <p className="geo-hint" style={{ marginTop: 10 }}>
                              {(data.selected_counties || []).length}{" "}
                              {(data.selected_counties || []).length === 1
                                ? "county"
                                : "counties"}{" "}
                              selected
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 3 - Property type */}
              {step === 3 && (
                <div className="ptype-grid">
                  {PROPERTY_TYPE_OPTIONS.map((opt) => {
                    const selected = (data.property_types || []).includes(
                      opt.value,
                    );
                    const Icon = opt.Icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`ptype-card ${selected ? "selected" : ""}`}
                        onClick={() =>
                          setData((d) => {
                            const arr: string[] = d.property_types || [];
                            return {
                              ...d,
                              property_types: arr.includes(opt.value)
                                ? arr.filter((v) => v !== opt.value)
                                : [...arr, opt.value],
                            };
                          })
                        }
                      >
                        {selected && (
                          <span className="ptype-check">
                            <Check size={12} strokeWidth={3} color="#fff" />
                          </span>
                        )}
                        <span className="ptype-icon-wrap">
                          <Icon size={20} strokeWidth={1.75} />
                        </span>
                        <span>
                          <span
                            className="ptype-title"
                            style={{ display: "block" }}
                          >
                            {opt.label}
                          </span>
                          <span className="ptype-desc">{opt.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 4 - Webhook CRM */}
              {step === 4 && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 18 }}
                >
                  {/* What is a webhook */}
                  <div
                    style={{
                      padding: "16px 18px",
                      borderRadius: 14,
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <Zap size={16} color="#a5b4fc" />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#a5b4fc",
                        }}
                      >
                        What is a webhook?
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.6)",
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      Think of it as an automatic delivery address for your
                      leads. Every time you buy a lead on Newleey, the full lead
                      details — name, phone, email, address — get sent instantly
                      to your CRM so you can follow up without any copy-pasting.
                    </p>
                  </div>

                  {/* CRM quick instructions */}
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.6)",
                        letterSpacing: "0.06em",
                        marginBottom: 10,
                      }}
                    >
                      How to get your webhook URL
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {[
                        {
                          name: "GoHighLevel / Lead Connector",
                          icon: "🔗",
                          steps:
                            "Settings → Integrations → Webhooks → Create New → copy the endpoint URL",
                        },
                        {
                          name: "Zapier",
                          icon: "⚡",
                          steps:
                            "Create a Zap → Trigger: Webhooks by Zapier → Catch Hook → copy the webhook URL",
                        },
                        {
                          name: "Any other CRM",
                          icon: "🔌",
                          steps:
                            "Look for 'Inbound Webhook', 'HTTP Trigger', or 'API Endpoint' in your CRM's automation or integrations settings",
                        },
                      ].map((crm) => (
                        <div
                          key={crm.name}
                          style={{
                            display: "flex",
                            gap: 12,
                            padding: "12px 14px",
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.07)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 18,
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            {crm.icon}
                          </span>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "rgba(255,255,255,0.85)",
                                marginBottom: 3,
                              }}
                            >
                              {crm.name}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "rgba(255,255,255,0.45)",
                                lineHeight: 1.55,
                              }}
                            >
                              {crm.steps}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Provider picker */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.5)",
                        marginBottom: 8,
                      }}
                    >
                      Which CRM are you connecting?
                    </label>
                    <div className="tag-grid" style={{ marginBottom: 0 }}>
                      {[
                        { value: "gohighlevel", label: "GoHighLevel" },
                        { value: "leadconnector", label: "LeadConnector" },
                        { value: "webhook", label: "Webhook" },
                        { value: "zapier", label: "Zapier" },
                        { value: "skip", label: "Skip for now" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`tag ${data.crm_provider === opt.value ? "selected" : ""}`}
                          onClick={() =>
                            setData((d) => ({ ...d, crm_provider: opt.value }))
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* URL input */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.5)",
                        marginBottom: 8,
                      }}
                    >
                      Paste your webhook URL here
                    </label>
                    <input
                      type="url"
                      placeholder="https://hooks.zapier.com/…"
                      value={data.webhook_url || ""}
                      onChange={(e) =>
                        setData((d) => ({ ...d, webhook_url: e.target.value }))
                      }
                      style={{
                        width: "100%",
                        maxWidth: 520,
                        marginBottom: 10,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        padding: "12px 14px",
                        color: "#fff",
                        fontSize: 14,
                        outline: "none",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-next"
                        style={{ padding: "10px 18px", fontSize: 13 }}
                        onClick={() =>
                          void patchWebhookIntegration(
                            String(data.webhook_url || "").trim(),
                          )
                            .then(() => setHookMsg("✓ Webhook URL saved."))
                            .catch((e: Error) =>
                              setHookMsg(e.message || "Save failed"),
                            )
                        }
                      >
                        Save webhook
                      </button>
                      <button
                        type="button"
                        className="btn-back"
                        style={{ padding: "10px 18px", fontSize: 13 }}
                        onClick={() =>
                          void testWebhookIntegration()
                            .then((r) =>
                              setHookMsg(`✓ Test sent — HTTP ${r.status}`),
                            )
                            .catch((e: Error) =>
                              setHookMsg(e.message || "Test failed"),
                            )
                        }
                      >
                        Send test lead
                      </button>
                    </div>
                    {hookMsg && (
                      <p
                        style={{
                          fontSize: 12,
                          color: hookMsg.startsWith("✓")
                            ? "#34d399"
                            : "#fca5a5",
                          marginTop: 10,
                        }}
                      >
                        {hookMsg}
                      </p>
                    )}
                  </div>

                  {/* What happens note */}
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      background: "rgba(16,185,129,0.07)",
                      border: "1px solid rgba(16,185,129,0.15)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.5)",
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      <span style={{ color: "#34d399", fontWeight: 600 }}>
                        What happens next:{" "}
                      </span>
                      Every lead you purchase will be delivered to this URL
                      instantly — name, phone, email, address, and property
                      details sent straight to your CRM. You can update this
                      anytime in Settings → Integrations.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 8 - Resources */}
              {step === 8 && (
                <div className="resource-grid">
                  {[
                    {
                      Icon: MessageCircle,
                      t: "Skool community",
                      d: "Access community support, updates, and best-practice walkthroughs.",
                    },
                    {
                      Icon: Video,
                      t: "GHL setup tutorial",
                      d: "Connect GoHighLevel or Lead Connector and confirm delivery.",
                    },
                    {
                      Icon: Link2,
                      t: "Zap / webhook setup",
                      d: "Map lead fields and test your webhook before you go live.",
                    },
                    {
                      Icon: CircleHelp,
                      t: "FAQs",
                      d: "Get quick answers about plans, wallet funding, refunds, and lead delivery.",
                    },
                    {
                      Icon: Sparkles,
                      t: "Win free leads & cash",
                      d: "Submit contracts, leave reviews, and participate in reward campaigns.",
                    },
                    {
                      Icon: Map,
                      t: "Resources tab",
                      d: "Everything here is also available later from the Resources section.",
                    },
                  ].map((r) => {
                    const I = r.Icon;
                    return (
                      <div key={r.t} className="resource-card">
                        <div className="resource-icon">
                          <I size={22} strokeWidth={2} />
                        </div>
                        <div className="resource-title">{r.t}</div>
                        <div className="resource-desc">{r.d}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Step 9 - Done */}
              {step === 9 &&
                (() => {
                  const geoCount =
                    Array.isArray(data.markets) && data.markets.length > 0
                      ? data.markets.length
                      : buildMarketsFromGeo(data).length;
                  const planLabel =
                    data.purchase_path === "subscription"
                      ? "Pro Plan"
                      : data.purchase_path === "exclusive"
                        ? "Free Plan"
                        : "Not selected";
                  const planSub =
                    data.purchase_path === "subscription"
                      ? "Complete Stripe checkout from Plans if needed"
                      : data.purchase_path === "exclusive"
                        ? "Fund your wallet to start buying leads"
                        : "Finish setup in Settings → Plan";
                  const summaryCards = [
                    {
                      Icon: CreditCard,
                      label: "Plan",
                      value: planLabel,
                      sub: planSub,
                      ok: !!data.purchase_path,
                    },
                    {
                      Icon: MapPin,
                      label: "Markets",
                      value: data.nationwide
                        ? "Nationwide"
                        : geoCount > 0
                          ? `${geoCount} ${geoCount === 1 ? "county" : "counties"} selected`
                          : "Not set",
                      sub: data.nationwide
                        ? "All supported markets"
                        : geoCount > 0
                          ? `Across ${(data.selected_states || []).length || 1} state${((data.selected_states || []).length || 1) > 1 ? "s" : ""}`
                          : "Add markets in Settings",
                      ok: data.nationwide || geoCount > 0,
                    },
                    {
                      Icon: Bot,
                      label: "Auto-buy",
                      value: data.auto_buy ? "Enabled" : "Disabled",
                      sub: data.auto_buy
                        ? `Up to ${data.max_per_day ?? 3} leads/day`
                        : "Turn on in Settings → Distribution",
                      ok: data.auto_buy,
                    },
                    {
                      Icon: Link2,
                      label: "CRM Webhook",
                      value: data.webhook_url ? "Connected" : "Not connected",
                      sub: data.webhook_url
                        ? "Leads will be delivered automatically"
                        : "Optional — add anytime in Settings",
                      ok: !!data.webhook_url,
                    },
                    {
                      Icon: Target,
                      label: "Property Types",
                      value:
                        (data.property_types || []).length > 0
                          ? `${data.property_types.length} selected`
                          : "Not set",
                      sub:
                        (data.property_types || []).length > 0
                          ? PROPERTY_TYPE_OPTIONS.filter((o) =>
                              (data.property_types || []).includes(o.value),
                            )
                              .map((o) => o.label)
                              .join(", ")
                          : "Add property types in Settings",
                      ok: (data.property_types || []).length > 0,
                    },
                    {
                      Icon: Bell,
                      label: "Phone Verified",
                      value: authMe?.phone_verified
                        ? "Verified"
                        : "Not verified",
                      sub: authMe?.phone_verified
                        ? "You'll receive SMS alerts for new leads"
                        : "Verify from the Welcome step",
                      ok: !!authMe?.phone_verified,
                    },
                    {
                      Icon: Package,
                      label: "Delivery Limits",
                      value:
                        data.max_leads_per_day ||
                        data.max_leads_per_week ||
                        data.max_leads_per_month
                          ? [
                              data.max_leads_per_day
                                ? `${data.max_leads_per_day}/day`
                                : null,
                              data.max_leads_per_week
                                ? `${data.max_leads_per_week}/week`
                                : null,
                              data.max_leads_per_month
                                ? `${data.max_leads_per_month}/month`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : "Not set",
                      sub: "Prevents autobuy from overspending your wallet",
                      ok: !!(
                        data.max_leads_per_day ||
                        data.max_leads_per_week ||
                        data.max_leads_per_month
                      ),
                    },
                  ];
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 24,
                      }}
                    >
                      {/* Header */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 14,
                          textAlign: "center",
                          paddingTop: 8,
                        }}
                      >
                        {/* <div
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg, #6366f1, #10b981)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 0 40px rgba(99,102,241,0.35)",
                          }}
                        >
                          <CheckCircle
                            size={36}
                            strokeWidth={1.75}
                            color="#fff"
                            aria-hidden
                          />
                        </div> */}
                        {/* <div>
                          <h2
                            style={{
                              fontSize: 22,
                              fontWeight: 700,
                              color: "#fff",
                              margin: 0,
                              lineHeight: 1.2,
                            }}
                          >
                            You&apos;re all set.
                          </h2>
                          <p
                            style={{
                              fontSize: 14,
                              color: "rgba(255,255,255,0.45)",
                              marginTop: 6,
                              marginBottom: 0,
                            }}
                          >
                            Your account is ready. Here&apos;s a summary of your
                            setup.
                          </p>
                        </div> */}
                      </div>

                      {/* Summary cards grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        {summaryCards.map(({ Icon, label, value, sub, ok }) => (
                          <div
                            key={label}
                            style={{
                              padding: "16px 18px",
                              borderRadius: 14,
                              background: ok
                                ? "rgba(16,185,129,0.06)"
                                : "rgba(255,255,255,0.03)",
                              border: `1px solid ${ok ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.07)"}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 7,
                                }}
                              >
                                <Icon
                                  size={15}
                                  style={{
                                    color: ok
                                      ? "#10b981"
                                      : "rgba(255,255,255,0.3)",
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,255,255,0.35)",
                                    textTransform: "",
                                    letterSpacing: "0.06em",
                                  }}
                                >
                                  {label}
                                </span>
                              </div>
                              <div
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: "50%",
                                  background: ok
                                    ? "#10b981"
                                    : "rgba(255,255,255,0.15)",
                                }}
                              />
                            </div>
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: ok ? "#fff" : "rgba(255,255,255,0.5)",
                              }}
                            >
                              {value}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.35)",
                                lineHeight: 1.5,
                              }}
                            >
                              {sub}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>

          {/* Footer nav */}
          <div className="footer-nav">
            <span className="step-counter">
              Step {step} of {TOTAL_STEPS}
            </span>
            <div className="nav-btns">
              {step > 1 && (
                <button
                  type="button"
                  className="btn-back"
                  onClick={() => setStep(step - 1)}
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                className="btn-skip"
                disabled={saveMutation.isPending}
                onClick={() => void skipOnboarding()}
              >
                Skip for now
              </button>
              {/* Step 6 (Wallet) drives its own navigation via WalletFundForm — no global Continue button */}
              {step !== 6 && (
                <button
                  type="button"
                  className="btn-next"
                  disabled={
                    saveMutation.isPending ||
                    subscriptionCheckoutMutation.isPending ||
                    (step === 2 &&
                      !data.nationwide &&
                      (!(data.selected_states || []).length ||
                        !(data.selected_counties || []).length)) ||
                    (step === 3 && (data.property_types || []).length === 0) ||
                    (step === 5 &&
                      (!data.purchase_path ||
                        (data.purchase_path === "subscription" &&
                          !selectedSubscriptionPlan)))
                  }
                  onClick={() => {
                    if (step === 5 && data.purchase_path === "subscription") {
                      if (!selectedSubscriptionPlan) return;
                      void subscriptionCheckoutMutation.mutateAsync(
                        selectedSubscriptionPlan,
                      );
                      return;
                    }
                    if (step === 5 && data.purchase_path === "exclusive") {
                      void saveStep(6);
                      return;
                    }
                    void saveStep(step + 1);
                  }}
                >
                  {subscriptionCheckoutMutation.isPending ? (
                    <>
                      <span className="spinner" /> Redirecting to Stripe…
                    </>
                  ) : saveMutation.isPending ? (
                    <>
                      <span className="spinner" /> Saving…
                    </>
                  ) : step === 5 && data.purchase_path === "subscription" ? (
                    "Continue to Stripe checkout →"
                  ) : step === TOTAL_STEPS ? (
                    "Go to marketplace →"
                  ) : (
                    "Continue →"
                  )}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function OnboardingPage() {
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
            color: "rgba(255,255,255,0.45)",
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Loading…
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}
