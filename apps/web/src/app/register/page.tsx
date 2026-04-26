"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAccessToken } from "@/lib/token";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirm: "", full_name: "", company_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Passwords don't match"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    setError("");
    try {
      const utm: Record<string, string> = {};
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
          const v = sp.get(k);
          if (v) utm[k] = v;
        }
      }
      const res = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          company_name: form.company_name,
          ...utm,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { message: string };
        throw new Error(data.message || "Registration failed");
      }
      const data = await res.json() as { access_token: string } | { message: string };
      setAccessToken((data as { access_token: string })?.access_token as string);
      router.push("/onboarding");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const strength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#10b981", "#6366f1"][strength];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .reg-root {
          min-height: 100vh;
          background: #080a0f;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
          padding: 40px 20px;
        }

        .bg-mesh {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 50% 60% at 80% 20%, rgba(99,102,241,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 40% 50% at 20% 80%, rgba(16,185,129,0.08) 0%, transparent 60%);
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px;
          padding: 48px 44px;
          backdrop-filter: blur(20px);
          animation: fadeUp 0.5s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 36px;
        }

        .brand-icon {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #6366f1, #10b981);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
        }

        .step-indicator {
          display: flex;
          gap: 6px;
          margin-bottom: 32px;
        }

        .step-dot {
          height: 3px;
          border-radius: 2px;
          flex: 1;
          background: rgba(255,255,255,0.1);
          transition: background 0.3s;
        }

        .step-dot.active { background: #6366f1; }
        .step-dot.done { background: #10b981; }

        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.8px;
          margin-bottom: 6px;
        }

        .form-sub {
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 32px;
        }

        .form-sub a {
          color: #6366f1;
          text-decoration: none;
          font-weight: 500;
        }

        .fields { display: flex; flex-direction: column; gap: 14px; }

        .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .field { display: flex; flex-direction: column; gap: 7px; }

        .field label {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }

        .input-wrap { position: relative; }

        .input-wrap input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 11px;
          padding: 13px 15px;
          font-size: 14px;
          color: #ffffff;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          font-family: 'DM Sans', sans-serif;
        }

        .input-wrap input:focus {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.04);
        }

        .input-wrap input::placeholder { color: rgba(255,255,255,0.18); }

        .eye-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.25);
          padding: 4px;
          transition: color 0.2s;
        }
        .eye-btn:hover { color: rgba(255,255,255,0.6); }

        .strength-bar {
          margin-top: 8px;
          display: flex;
          gap: 4px;
        }

        .strength-seg {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.1);
          transition: background 0.3s;
        }

        .strength-label {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          margin-top: 4px;
          text-align: right;
          transition: color 0.3s;
        }

        .error-box {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 13px;
          color: #f87171;
          margin-bottom: 14px;
        }

        .btn-row {
          display: flex;
          gap: 10px;
          margin-top: 28px;
        }

        .back-btn {
          padding: 14px 20px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 11px;
          color: rgba(255,255,255,0.6);
          font-size: 14px;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.2s;
          white-space: nowrap;
        }
        .back-btn:hover { background: rgba(255,255,255,0.08); }

        .submit-btn {
          flex: 1;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 11px;
          padding: 14px;
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          transition: opacity 0.2s, transform 0.15s;
          position: relative;
          overflow: hidden;
        }
        .submit-btn:hover { transform: translateY(-1px); opacity: 0.92; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .terms {
          margin-top: 16px;
          font-size: 12px;
          color: rgba(255,255,255,0.25);
          text-align: center;
          line-height: 1.5;
        }

        .terms a { color: rgba(255,255,255,0.45); text-decoration: underline; }

        .divider-or {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 8px 0 20px;
        }
        .divider-or span {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.07);
        }
        .divider-or p {
          font-size: 12px;
          color: rgba(255,255,255,0.25);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
          margin-right: 8px;
        }

        @media (max-width: 520px) {
          .card { padding: 36px 24px; }
          .row-2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="reg-root">
        <div className="bg-mesh" />
        <div className="bg-grid" />

        <div className="card">
          <div className="brand">
            <div className="brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
              </svg>
            </div>
            <span className="brand-name">Newleey</span>
          </div>

          <div className="step-indicator">
            <div className={`step-dot ${step >= 1 ? (step > 1 ? "done" : "active") : ""}`} />
            <div className={`step-dot ${step >= 2 ? "active" : ""}`} />
          </div>

          <h2 className="form-title">
            {step === 1 ? "Create your account" : "Your details"}
          </h2>
          <p className="form-sub">
            {step === 1 ? (
              <>Already have one? <Link href="/login">Sign in</Link></>
            ) : (
              "Tell us a bit about yourself"
            )}
          </p>

          {error && <div className="error-box">{error}</div>}

          {step === 1 && (
            <>
              <GoogleSignInButton variant="signup" onError={setError} />
              <div className="divider-or" aria-hidden="true">
                <span />
                <p>or use email</p>
                <span />
              </div>
            </>
          )}

          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setError(""); setStep(2); } : handleSubmit}>
            {step === 1 ? (
              <div className="fields">
                <div className="field">
                  <label>Email address</label>
                  <div className="input-wrap">
                    <input type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} required autoComplete="email" />
                  </div>
                </div>
                <div className="field">
                  <label>Password</label>
                  <div className="input-wrap">
                    <input type={showPw ? "text" : "password"} placeholder="Min. 8 characters" value={form.password} onChange={set("password")} required minLength={8} />
                    <button type="button" className="eye-btn" onClick={() => setShowPw(!showPw)}>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                  {form.password && (
                    <>
                      <div className="strength-bar">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="strength-seg" style={{ background: i <= strength ? strengthColor : undefined }} />
                        ))}
                      </div>
                      <div className="strength-label" style={{ color: strengthColor }}>{strengthLabel}</div>
                    </>
                  )}
                </div>
                <div className="field">
                  <label>Confirm password</label>
                  <div className="input-wrap">
                    <input type="password" placeholder="Repeat password" value={form.confirm} onChange={set("confirm")} required />
                  </div>
                </div>
                <button type="submit" className="submit-btn" style={{ marginTop: 14 }}>
                  Continue →
                </button>
              </div>
            ) : (
              <div className="fields">
                <div className="row-2">
                  <div className="field">
                    <label>Full name</label>
                    <div className="input-wrap">
                      <input type="text" placeholder="John Smith" value={form.full_name} onChange={set("full_name")} required />
                    </div>
                  </div>
                  <div className="field">
                    <label>Company</label>
                    <div className="input-wrap">
                      <input type="text" placeholder="Acme Investments" value={form.company_name} onChange={set("company_name")} />
                    </div>
                  </div>
                </div>
                <div className="btn-row">
                  <button type="button" className="back-btn" onClick={() => setStep(1)}>← Back</button>
                  <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? <><span className="spinner" />Creating…</> : "Create account"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="terms">
            By creating an account you agree to our{" "}
            <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </>
  );
}