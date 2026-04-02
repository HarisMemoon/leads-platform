"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getAuthMe } from "@/lib/auth-api";
import { getOnboardingMe } from "@/lib/onboarding-api";
import { getWalletMe } from "@/lib/wallet-api";
import { queryKeys } from "@/lib/query-keys";
import { clearAccessToken } from "@/lib/token";

export default function Navbar() {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pathname = usePathname();

  const { data: user } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: getAuthMe,
  });

  const { data: wallet, isLoading } = useQuery({
    queryKey: queryKeys.wallet.me,
    queryFn: getWalletMe,
  });

  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: queryKeys.onboarding.me,
    queryFn: getOnboardingMe,
  });

  const walletBalance = Number((wallet?.balance_cents as string) || 0);

  const onOnboardingRoute =
    pathname === "/onboarding" || pathname?.startsWith("/onboarding/");
  const onboardingComplete = Boolean(onboarding?.completed_at);
  const onboardingSkipped = Boolean(
    onboarding?.data &&
      typeof onboarding.data === "object" &&
      (onboarding.data as { skipped?: boolean }).skipped === true,
  );

  const displayName =
    user?.full_name?.trim() ||
    user?.email?.split("@")[0]?.replace(/\./g, " ") ||
    "User";
  const avatarLetter = (
    user?.full_name?.trim()?.charAt(0) ||
    user?.email?.charAt(0) ||
    "U"
  ).toUpperCase();

  const handleLogout = () => {
    clearAccessToken();
    router.push("/login");
  };

  const showOnboardingCta =
    !onboardingLoading && !onOnboardingRoute && (!onboardingComplete || onboardingSkipped);

  return (
    <>
      <style>{`
        .nav-float-wrap {
          position: sticky;
          top: 0;
          z-index: 100;
          padding: 14px 20px 0;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }
        .nav-float-shell {
          pointer-events: auto;
          width: min(1240px, calc(100% - 8px));
          position: relative;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: linear-gradient(
            165deg,
            rgba(22, 24, 35, 0.88) 0%,
            rgba(10, 12, 18, 0.92) 100%
          );
          backdrop-filter: blur(20px) saturate(1.35);
          -webkit-backdrop-filter: blur(20px) saturate(1.35);
          box-shadow:
            0 4px 24px rgba(0, 0, 0, 0.35),
            0 0 0 1px rgba(255, 255, 255, 0.04) inset,
            0 1px 0 rgba(255, 255, 255, 0.06) inset;
        }
        .nav-float-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 18px;
          padding: 1px;
          background: linear-gradient(
            135deg,
            rgba(99, 102, 241, 0.22),
            rgba(16, 185, 129, 0.12) 50%,
            rgba(139, 92, 246, 0.15)
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.65;
        }
        .nav-inner {
          position: relative;
          z-index: 1;
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 8px 14px 8px 16px;
        }
        .nav-links-scroll {
          display: flex;
          gap: 2px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          flex: 1;
          min-width: 0;
          justify-content: flex-start;
        }
        .nav-links-scroll::-webkit-scrollbar {
          display: none;
        }
        .nav-link-pill {
          padding: 8px 13px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
          transition: color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .nav-link-pill:hover {
          color: rgba(255, 255, 255, 0.88) !important;
          background: rgba(255, 255, 255, 0.06) !important;
        }
        .nav-link-pill[data-active="true"] {
          color: #fff !important;
          background: rgba(99, 102, 241, 0.18) !important;
          box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.25);
        }
        @media (max-width: 1024px) {
          .nav-left-brand {
            flex-shrink: 0;
          }
          .nav-inner {
            flex-wrap: wrap;
            row-gap: 10px;
          }
          .nav-links-scroll {
            order: 3;
            width: 100%;
            padding-bottom: 4px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 10px;
            margin-top: 2px;
          }
        }
      `}</style>

      <div className="nav-float-wrap" aria-label="Primary navigation">
        <nav className="nav-float-shell">
          <div className="nav-inner">
            {/* LEFT: brand + links */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0, flex: 1 }}>
              <Link
                href="/dashboard"
                className="nav-left-brand"
                style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, textDecoration: "none" }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    background: "linear-gradient(135deg, #6366f1, #10b981)",
                    borderRadius: 9,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
                  </svg>
                </div>
                <span
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: -0.3,
                  }}
                >
                  Newleey
                </span>
              </Link>

              <div className="nav-links-scroll">
                {[
                  { href: "/dashboard", label: "Dashboard" },
                  { href: "/marketplace", label: "Marketplace" },
                  { href: "/wallet", label: "Wallet" },
                  { href: "/leads", label: "My Leads" },
                  { href: "/subscriptions", label: "Plan" },
                  { href: "/distribution", label: "Distribution" },
                  { href: "/market-alerts", label: "Alerts" },
                  ...(user?.role === "admin" ? [{ href: "/admin/console", label: "Admin" }] : []),
                ].map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="nav-link-pill"
                      data-active={active}
                      style={{
                        color: active ? "#fff" : "rgba(255, 255, 255, 0.42)",
                        background: active ? "rgba(99, 102, 241, 0.18)" : "transparent",
                      }}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* RIGHT */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              {showOnboardingCta && (
                <>
                  {!onboardingComplete ? (
                    <Link
                      href="/onboarding"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 15px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "Syne, sans-serif",
                        textDecoration: "none",
                        color: "#e0e7ff",
                        background: "linear-gradient(135deg, rgba(99,102,241,0.4) 0%, rgba(139,92,246,0.25) 100%)",
                        border: "1px solid rgba(129,140,248,0.45)",
                        boxShadow: "0 0 0 1px rgba(99,102,241,0.12) inset, 0 4px 18px rgba(99,102,241,0.22)",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.14)",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                        }}
                        aria-hidden
                      >
                        ✨
                      </span>
                      Complete setup
                    </Link>
                  ) : (
                    <Link
                      href="/onboarding?resume=1"
                      title="Continue setup from your last step"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 15px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "Syne, sans-serif",
                        textDecoration: "none",
                        color: "rgba(255,255,255,0.78)",
                        background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(99,102,241,0.14) 100%)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 2px 14px rgba(0,0,0,0.2)",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(99,102,241,0.28)",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                        }}
                        aria-hidden
                      >
                        ↩
                      </span>
                      Resume setup
                    </Link>
                  )}
                </>
              )}

              <Link
                href="/wallet"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.28)",
                  borderRadius: 100,
                  padding: "7px 15px",
                  fontSize: 13,
                  color: "#6ee7b7",
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: "0 0 20px rgba(16,185,129,0.08)",
                }}
              >
                ${isLoading ? "—" : (walletBalance / 100).toFixed(0)}
              </Link>

              <div style={{ position: "relative" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDropdownOpen(!dropdownOpen);
                    }
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {avatarLetter}
                </div>

                {dropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 48,
                      width: 216,
                      background: "linear-gradient(165deg, rgba(22,24,35,0.98) 0%, rgba(12,14,20,0.99) 100%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14,
                      padding: 10,
                      boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
                      backdropFilter: "blur(16px)",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        fontSize: 13,
                        color: "#fff",
                        fontWeight: 600,
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        marginBottom: 6,
                      }}
                    >
                      {displayName}
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "transparent",
                        border: "none",
                        color: "rgba(255,255,255,0.72)",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
