"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOnboardingMe,
  patchOnboardingMe,
  type UpdateOnboardingPayload,
} from "@/lib/onboarding-api";
import { queryKeys } from "@/lib/query-keys";

const TOTAL_STEPS = 9;

const MARKETS = [
  "Dallas, TX", "Phoenix, AZ", "Atlanta, GA", "Houston, TX",
  "Orlando, FL", "Tampa, FL", "Las Vegas, NV", "Denver, CO",
  "Charlotte, NC", "Nashville, TN", "Austin, TX", "Miami, FL",
];

const LEAD_TYPES = [
  "Motivated Sellers", "Pre-Foreclosure", "Probate", "Tax Delinquent",
  "Absentee Owner", "Vacant Property", "Divorce", "Expired Listings",
];

const CRMS = [
  "GoHighLevel", "Salesforce", "HubSpot", "Podio",
  "REI BlackBook", "Freedomsoft", "InvestorFuse", "Other",
];

const BUDGETS = [
  { label: "$500 – $1,000/mo", value: "500-1000" },
  { label: "$1,000 – $3,000/mo", value: "1000-3000" },
  { label: "$3,000 – $5,000/mo", value: "3000-5000" },
  { label: "$5,000+/mo", value: "5000+" },
];

const STEP_META = [
  { icon: "👋", title: "Welcome to Newleey", sub: "Let's get your account set up in under 3 minutes." },
  { icon: "⚡", title: "How lead buying works", sub: "Understand the platform before you spend a dollar." },
  { icon: "📦", title: "Choose your model", sub: "Subscribe for steady flow or buy leads individually." },
  { icon: "💳", title: "Fund your wallet", sub: "Add credits to start buying instantly." },
  { icon: "🤖", title: "Auto-buy settings", sub: "Let the platform buy leads automatically for you." },
  { icon: "📍", title: "Markets & filters", sub: "Tell us which markets you want leads from." },
  { icon: "🔗", title: "Connect your CRM", sub: "Push leads directly into your workflow." },
  { icon: "📚", title: "Resources & guides", sub: "Everything you need to hit the ground running." },
  { icon: "🎉", title: "You're all set!", sub: "Your account is configured and ready to go." },
];

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const resumeStartedRef = useRef(false);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Record<string, any>>({
    markets: [] as string[],
    lead_types: [] as string[],
    crm: "",
    budget: "",
    auto_buy: false,
    max_per_day: 3,
    min_balance: 500,
  });
  const [infoModal, setInfoModal] = useState<{ 
    open: boolean; 
    title: string; 
    content: string 
  }>({ 
    open: false, 
    title: "", 
    content: "" 
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
    router.replace("/dashboard");
  }, [onboardingLoading, row?.completed_at, skippedFlag, resumeRequested, router]);

  const resumeMutation = useMutation({
    mutationFn: () => {
      if (!row)
        return Promise.reject(new Error("No onboarding row"));
      return patchOnboardingMe({
        completed_at: null,
        data: {
          ...(row.data as Record<string, unknown>),
          skipped: false,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.me });
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
    mutationFn: (payload: UpdateOnboardingPayload) => patchOnboardingMe(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet.me });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wallet.transactions({ limit: 50, offset: 0 }),
      });
    },
  });

  const toggle = (key: "markets" | "lead_types", val: string) => {
    setData((d) => {
      const arr: string[] = d[key] || [];
      return {
        ...d,
        [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
      };
    });
  };

  async function saveStep(nextStep: number) {
    try {
      await saveMutation.mutateAsync({
        current_step: nextStep <= TOTAL_STEPS ? nextStep : TOTAL_STEPS,
        completed_steps: [step], // backend merges unique ints
        data,
      });
      if (nextStep > TOTAL_STEPS) {
        await saveMutation.mutateAsync({ completed_at: new Date().toISOString() });
        router.push("/dashboard");
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
      router.push("/dashboard");
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

  if (resumeRequested && skippedFlag && row?.completed_at && resumeMutation.isPending) {
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



.step-emoji {

  font-size: 44px;

  margin-bottom: 20px;

  display: block;

}



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



/* how it works cards */

.how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 36px; }



.how-card {

  background: rgba(255,255,255,0.03);

  border: 1px solid rgba(255,255,255,0.07);

  border-radius: 14px;

  padding: 20px;

}



.how-icon { font-size: 24px; margin-bottom: 10px; }

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



.plan-name { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; }

.plan-price { font-size: 13px; color: #10b981; margin-bottom: 10px; }

.plan-desc { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.6; }



/* wallet */

.wallet-display {

  background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.08));

  border: 1px solid rgba(99,102,241,0.2);

  border-radius: 18px;

  padding: 28px;

  margin-bottom: 20px;

  text-align: center;

}



.wallet-label { font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }

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

.resource-icon { font-size: 22px; margin-bottom: 8px; }

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

  font-size: 36px;

}



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

      {/* Info Modal */}
     {infoModal.open && (
        <div className="modal-overlay" onClick={() => setInfoModal({ ...infoModal, open: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="brand-icon" style={{ marginBottom: 20 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="step-title" style={{ fontSize: 24, marginBottom: 12 }}>{infoModal.title}</h3>
            <p className="step-sub" style={{ marginBottom: 32, lineHeight: 1.6 }}>{infoModal.content}</p>
            <button 
              className="btn-next" 
              style={{ width: '100%', justifyContent: 'center' }} 
              onClick={() => setInfoModal({ ...infoModal, open: false })}
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
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
              {onboardingError instanceof Error ? onboardingError.message : "Could not load onboarding"}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
              </svg>
            </div>
            <span className="brand-name">Newleey</span>
          </div>

          <nav className="steps-nav">
            {STEP_META.map((s, i) => {
              const n = i + 1;
              const state = n < step ? "done" : n === step ? "active" : "upcoming";
              return (
                <div key={n} className={`step-item ${state}`}>
                  <div className={`step-num ${state}`}>
                    {state === "done" ? (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : n}
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
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="content-area">
            <div className="step-card" key={step}>
              <span className="step-emoji">{STEP_META[step - 1].icon}</span>
              <h2 className="step-title">{STEP_META[step - 1].title}</h2>
              <p className="step-sub">{STEP_META[step - 1].sub}</p>

              {/* Step 1 - Welcome */}
              {step === 1 && (
                <div className="how-grid">
                  {[
                    { icon: "💰", t: "Fund your wallet", d: "Add credits via Stripe. Use them to buy leads on demand or let auto-buy do it." },
                    { icon: "📋", t: "Browse the marketplace", d: "Filter by market, type, price, and freshness. Buy instantly." },
                    { icon: "🔄", t: "Automated distribution", d: "Opt into round-robin delivery. Leads hit your CRM automatically." },
                    { icon: "📊", t: "Track everything", d: "Full history of leads, calls, CRM syncs, and spend from one dashboard." },
                  ].map((c) => (
                    <div key={c.t} className="how-card">
                      <div className="how-icon">{c.icon}</div>
                      <div className="how-title">{c.t}</div>
                      <div className="how-desc">{c.d}</div>
                    </div>
                  ))}
                </div>
              )}

{step === 2 && (
  <div className="how-grid">
    {[
      { icon: "🏠", t: "Fresh leads", d: "Newly sourced, high intent.", info: "Fresh leads are delivered within 60 seconds of capture to ensure maximum conversion[cite: 120]." },
      { icon: "⭐", t: "Premium leads", d: "Recently qualified.", info: "Premium leads undergo secondary verification for phone and interest validity[cite: 138]." },
      { icon: "📦", t: "Aged leads", d: "Older inventory.", info: "Aged leads (30-90 days) are discounted for volume-based outreach[cite: 122]." },
      { icon: "🎯", t: "Exclusive leads", d: "Yours alone.", info: "Exclusive leads are removed from the marketplace and never shared[cite: 135]." },
    ].map((c) => (
      <div key={c.t} className="how-card">
        <div className="how-icon">{c.icon}</div>
        <div className="how-title">{c.t}</div>
        <div className="how-desc">{c.d}</div>
        {/* The Fix: Call setInfoModal here */}
        <button 
          className="btn-info" 
          onClick={() => setInfoModal({ open: true, title: c.t, content: c.info })}
        >
          Learn more
        </button>
      </div>
    ))}
  </div>
)}

              {/* Step 3 - Subscription vs pay per lead */}
              {step === 3 && (
                <div className="plan-grid">
                  {[
                    { name: "Subscription", price: "From $299/mo", desc: "Steady lead flow. Priority in distribution. Monthly lead credits included.", val: "subscription" },
                    { name: "Pay-per-lead", price: "From $25/lead", desc: "Buy only what you need. Full marketplace access. No monthly commitment.", val: "ppl" },
                    { name: "Auto-buy", price: "Wallet-based", desc: "Set rules and caps. Platform buys automatically when leads match your criteria.", val: "autobuy" },
                    { name: "Hybrid", price: "Best value", desc: "Subscribe for priority + buy extras from the marketplace. Most popular.", val: "hybrid" },
                  ].map((p) => (
                    <div
                      key={p.val}
                      className={`plan-card ${data.model === p.val ? "selected" : ""}`}
                      onClick={() => setData((d) => ({ ...d, model: p.val }))}
                    >
                      <div className="plan-name">{p.name}</div>
                      <div className="plan-price">{p.price}</div>
                      <div className="plan-desc">{p.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 4 - Wallet */}
              {step === 4 && (
                <>
                  <div className="wallet-display">
                    <div className="wallet-label">Wallet Balance</div>
                    <div className="wallet-balance">
                      <span className="wallet-currency">$</span>
                      {data.wallet_amount || "0"}
                    </div>
                  </div>
                  <div className="amount-grid">
                    {["250", "500", "1000", "2500"].map((a) => (
                      <button
                        key={a}
                        className={`amount-btn ${data.wallet_amount === a ? "selected" : ""}`}
                        onClick={() => setData((d) => ({ ...d, wallet_amount: a }))}
                      >
                        ${a}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 28 }}>
                    This amount is credited to your wallet when you finish onboarding (final step). For additional top-ups, use the Wallet page.
                  </p>
                </>
              )}

              {/* Step 5 - Auto-buy */}
              {step === 5 && (
                <>
                  <div className="toggle-row">
                    <div className="toggle-info">
                      <div className="toggle-title">Enable Auto-Buy</div>
                      <div className="toggle-desc">Platform automatically purchases matching leads from your wallet</div>
                    </div>
                    <button
                      className={`toggle ${data.auto_buy ? "on" : ""}`}
                      onClick={() => setData((d) => ({ ...d, auto_buy: !d.auto_buy }))}
                    >
                      <div className="toggle-thumb" />
                    </button>
                  </div>

                  {data.auto_buy && (
                    <>
                      <div className="range-field">
                        <div className="range-label">
                          <span>Max leads per day</span>
                          <span>{data.max_per_day}</span>
                        </div>
                        <input type="range" min={1} max={20} value={data.max_per_day}
                          onChange={(e) => setData((d) => ({ ...d, max_per_day: +e.target.value }))} />
                      </div>
                      <div className="range-field">
                        <div className="range-label">
                          <span>Minimum wallet balance</span>
                          <span>${data.min_balance}</span>
                        </div>
                        <input type="range" min={100} max={2000} step={100} value={data.min_balance}
                          onChange={(e) => setData((d) => ({ ...d, min_balance: +e.target.value }))} />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Step 6 - Markets */}
              {step === 6 && (
                <>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Select all markets you want leads from</p>
                  <div className="tag-grid">
                    {MARKETS.map((m) => (
                      <div key={m} className={`tag ${data.markets.includes(m) ? "selected" : ""}`} onClick={() => toggle("markets", m)}>{m}</div>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Lead types</p>
                  <div className="tag-grid">
                    {LEAD_TYPES.map((t) => (
                      <div key={t} className={`tag ${data.lead_types.includes(t) ? "selected" : ""}`} onClick={() => toggle("lead_types", t)}>{t}</div>
                    ))}
                  </div>

                  {/* budget */}
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 12, marginTop: 8 }}>Monthly spend target</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {BUDGETS.map((b) => (
                      <div key={b.value} className={`tag ${data.budget === b.value ? "selected" : ""}`} onClick={() => setData((d) => ({ ...d, budget: b.value }))}>{b.label}</div>
                    ))}
                  </div>
                </>
              )}

              {/* Step 7 - CRM */}
              {step === 7 && (
                <>
                  <div className="tag-grid" style={{ marginBottom: 28 }}>
                    {CRMS.map((c) => (
                      <div key={c} className={`tag ${data.crm === c ? "selected" : ""}`} onClick={() => setData((d) => ({ ...d, crm: c }))}>{c}</div>
                    ))}
                  </div>
                  {data.crm === "GoHighLevel" && (
                    <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                        ✓ GoHighLevel integration is supported. After setup, leads will be pushed to your GHL subaccount automatically with tags and workflows triggered.
                      </p>
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
                    You can configure the full integration from Settings → Integrations after setup.
                  </p>
                </>
              )}

              {/* Step 8 - Resources */}
              {step === 8 && (
                <div className="resource-grid">
                  {[
                    { icon: "🎥", t: "Platform walkthrough", d: "5-min video covering every feature" },
                    { icon: "📖", t: "GHL integration guide", d: "Step-by-step CRM connection" },
                    { icon: "⚙️", t: "Auto-buy setup guide", d: "Configure caps and rotation rules" },
                    { icon: "💬", t: "Live support chat", d: "Talk to our team directly" },
                    { icon: "🗺️", t: "Market coverage map", d: "See all available markets" },
                    { icon: "❓", t: "FAQ", d: "Most common questions answered" },
                  ].map((r) => (
                    <div key={r.t} className="resource-card">
                      <div className="resource-icon">{r.icon}</div>
                      <div className="resource-title">{r.t}</div>
                      <div className="resource-desc">{r.d}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 9 - Done */}
              {step === 9 && (
                <div className="success-wrap">
                  <div className="success-icon">🎉</div>
                  <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
                    Your account is configured. Here's what's ready:
                  </p>
                  <div className="checklist">
                    {[
                      "Account & wallet created",
                      `${data.markets?.length || 0} market${data.markets?.length !== 1 ? "s" : ""} selected`,
                      `Auto-buy ${data.auto_buy ? "enabled" : "disabled"}`,
                      `CRM: ${data.crm || "Not set — configure later"}`,
                    ].map((item) => (
                      <div key={item} className="check-item">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#10b981">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer nav */}
          <div className="footer-nav">
            <span className="step-counter">Step {step} of {TOTAL_STEPS}</span>
            <div className="nav-btns">
              {step > 1 && (
                <button type="button" className="btn-back" onClick={() => setStep(step - 1)}>← Back</button>
              )}
              <button
                type="button"
                className="btn-skip"
                disabled={saveMutation.isPending}
                onClick={() => void skipOnboarding()}
              >
                Skip for now
              </button>
              <button type="button" className="btn-next" disabled={saveMutation.isPending} onClick={() => saveStep(step + 1)}>
                {saveMutation.isPending ? <><span className="spinner" /> Saving…</> : step === TOTAL_STEPS ? "Enter dashboard →" : "Continue →"}
              </button>
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