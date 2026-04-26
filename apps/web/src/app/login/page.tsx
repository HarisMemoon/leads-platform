"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAccessToken } from "@/lib/token";
import { getAuthMe } from "@/lib/auth-api";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("t1@gmail.com");
  const [password, setPassword] = useState("Pakistan7@");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json() as { message: string };
        throw new Error(data.message || "Invalid credentials");
      }
      setAccessToken((await res.json() as { access_token: string })?.access_token as string);
      const me = await getAuthMe();
      router.push(me.role === "admin" ? "/admin/console" : "/onboarding");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: #080a0f;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* animated grid background */
        .grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
        }

        /* glowing orbs */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
        }
        .orb-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
          top: -200px; right: -100px;
          animation: float1 8s ease-in-out infinite;
        }
        .orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%);
          bottom: -100px; left: -50px;
          animation: float2 10s ease-in-out infinite;
        }

        @keyframes float1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-30px, 30px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
        }

        /* left panel */
        .left-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 80px;
          position: relative;
          z-index: 1;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 80px;
        }

        .brand-icon {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, #6366f1, #10b981);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.5px;
        }

        .hero-text {
          font-family: 'Syne', sans-serif;
          font-size: clamp(38px, 4vw, 56px);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -2px;
          color: #ffffff;
          margin-bottom: 20px;
        }

        .hero-accent {
          background: linear-gradient(90deg, #6366f1, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-sub {
          font-size: 16px;
          color: rgba(255,255,255,0.45);
          line-height: 1.6;
          max-width: 380px;
          font-weight: 300;
        }

        .stats-row {
          display: flex;
          gap: 48px;
          margin-top: 64px;
        }

        .stat-item {}
        .stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
        }
        .stat-label {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          margin-top: 4px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        /* divider */
        .divider-line {
          width: 1px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent);
          margin: 60px;
          position: relative;
          z-index: 1;
        }

        /* right panel */
        .right-panel {
          width: 520px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 80px 60px;
          position: relative;
          z-index: 1;
        }

        .form-header {
          margin-bottom: 40px;
        }

        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.8px;
          margin-bottom: 8px;
        }

        .form-sub {
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          font-weight: 300;
        }

        .form-sub a {
          color: #6366f1;
          text-decoration: none;
          font-weight: 500;
        }
        .form-sub a:hover { text-decoration: underline; }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 24px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field label {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .input-wrap {
          position: relative;
        }

        .input-wrap input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 15px;
          color: #ffffff;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          font-family: 'DM Sans', sans-serif;
        }

        .input-wrap input:focus {
          border-color: rgba(99,102,241,0.6);
          background: rgba(99,102,241,0.05);
        }

        .input-wrap input::placeholder { color: rgba(255,255,255,0.2); }

        .eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          padding: 4px;
          transition: color 0.2s;
        }
        .eye-btn:hover { color: rgba(255,255,255,0.7); }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -8px;
          margin-bottom: 8px;
        }

        .signup-row {
          display: flex;
          justify-content: stretch;
          margin-top: 28px;
        }
        .signup-btn {
          width: 100%;
          min-height: 56px;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: transparent;
          border: 1.5px solid rgba(255,255,255,0.14);
          border-radius: 12px;
          padding: 14px 20px;
          cursor: pointer;
          
          font-size: 15px;
          font-weight: 600;
          color: rgba(255,255,255,0.88);
          font-family: 'Syne', sans-serif;
          letter-spacing: 0.2px;
          line-height: 1.9;
          transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.2) inset;
        }
        .signup-btn:hover {
          background: rgba(16,185,129,0.1);
          border-color: rgba(52,211,153,0.5);
          color: #a7f3d0;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(16,185,129,0.12);
        }
        .signup-btn:active { transform: translateY(0); }
        .signup-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .forgot-row a {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          text-decoration: none;
          transition: color 0.2s;
        }
        .forgot-row a:hover { color: #6366f1; }

        .error-box {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px;
          color: #f87171;
          margin-bottom: 16px;
        }

        .submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 12px;
          padding: 14px 18px;
          min-height: 56px;
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          letter-spacing: 0.3px;
          line-height: 1.2;
          transition: opacity 0.2s, transform 0.15s;
          position: relative;
          overflow: visible;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-sizing: border-box;
        }

        .submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
          opacity: 0;
          transition: opacity 0.2s;
          pointer-events: none;
        }

        .submit-btn:hover::after { opacity: 1; }
        .submit-btn:hover { transform: translateY(-1px); }
        .submit-btn:active { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .divider-or {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0;
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
        }

        .google-btn {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 13px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.2s, border-color 0.2s;
        }

        .google-btn:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.15);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
          margin-right: 8px;
        }

        @media (max-width: 900px) {
          .left-panel, .divider-line { display: none; }
          .right-panel { width: 100%; padding: 40px 32px; }
        }
      `}</style>

      <div className="login-root">
        <div className="grid-bg" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        {/* Left panel */}
        <div className="left-panel">
          <div className="brand">
            <div className="brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
              </svg>
            </div>
            <span className="brand-name">Newleey</span>
          </div>

          <h1 className="hero-text">
            The smarter way<br />
            to buy <span className="hero-accent">leads</span>.
          </h1>
          <p className="hero-sub">
            Fund your wallet, set your rules, and let the platform work. Automated distribution with full visibility.
          </p>

          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-num">12K+</div>
              <div className="stat-label">Leads delivered</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">98%</div>
              <div className="stat-label">Delivery rate</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">340+</div>
              <div className="stat-label">Active buyers</div>
            </div>
          </div>
        </div>

        <div className="divider-line" />

        {/* Right panel - form */}
        <div className="right-panel">
          <div className="form-header">
            <h2 className="form-title">Welcome back !</h2>
            {/* <p className="form-sub">
              No account?{" "}
              <Link href="/register">Create one free</Link>
            </p> */}
          </div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <div className="field">
                <label>Email address</label>
                <div className="input-wrap">
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="field">
                <label>Password</label>
                <div className="input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="forgot-row">
              <Link href="/forgot-password" >Forgot password?</Link>
            </div>
      

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? <><span className="spinner" />Signing in…</> : "Sign in →"}
            </button>
          </form>
        
          <div className="divider-or">
            <span /><p>or</p><span />
          </div>
          <GoogleSignInButton variant="signin" onError={setError} />
          <div className="signup-row">
              <button className="signup-btn" onClick={() => router.push("/register")}>Sign up for free</button>
            </div>
        </div>
      </div>
    </>
  );
}