"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAccessToken } from "@/lib/token";
import { getAuthMe } from "@/lib/auth-api";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@newleey.com");
  const [password, setPassword] = useState("Demo2024!");
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
        const data = (await res.json()) as { message: string };
        throw new Error(data.message || "Invalid credentials");
      }
      setAccessToken(
        ((await res.json()) as { access_token: string })
          ?.access_token as string,
      );
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

        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.8px;
          margin-bottom: 6px;
        }

        .form-sub {
          display: flex;
          justify-content: center;
          margin-top: 20px;
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

        .forgot-row {
          text-align: right;
          margin-top: -6px;
        }

        .forgot-row a {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .forgot-row a:hover {
          color: #6366f1;
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

        .submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 11px;
          padding: 14px;
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          font-family: 'Space Grotesk', sans-serif;
          transition: opacity 0.2s, transform 0.15s;
          position: relative;
          overflow: hidden;
          margin-top: 14px;
          line-height: normal; 
  display: flex;
  align-items: center;
  justify-content: center;
        }
        .submit-btn:hover { transform: translateY(-1px); opacity: 0.92; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .divider-or {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0 20px;
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

          <h2 className="form-title">Welcome back</h2>

          <form onSubmit={handleSubmit}>
            <div className="fields">
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
                      <svg
                        width="15"
                        height="15"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="15"
                        height="15"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="forgot-row">
                <Link href="/forgot-password">Forgot password?</Link>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    Signing in…
                  </>
                ) : (
                  "Sign in →"
                )}
              </button>
            </div>
          </form>
          <div className="divider-or" aria-hidden="true">
            <span />
            <p>or use Gmail</p>
            <span />
          </div>
          <GoogleSignInButton variant="signin" onError={setError} />
          <p className="form-sub ">
            Don't have an account? <Link href="/register">Sign up</Link>
          </p>

          {error && <div className="error-box">{error}</div>}
        </div>
      </div>
    </>
  );
}
