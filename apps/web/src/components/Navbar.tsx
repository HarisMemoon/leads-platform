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

  /*
  USER DATA
  */
  const { data: user } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: getAuthMe,
  });

  /*
  WALLET DATA
  */
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
    onboarding?.data && typeof onboarding.data === "object" && (onboarding.data as { skipped?: boolean }).skipped === true,
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

  return (
    <nav
      style={{
        height: "64px",
        borderBottom: "1px solid rgba(255,255,255,0.055)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        left: 0,            // Add this
    width: "100%",      // Add this
    zIndex: 100,
        background: "rgba(8,10,15,0.96)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* LEFT */}
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "30px",
              height: "30px",
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              borderRadius: "7px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "16px",
              fontWeight: 700,
              color: "#fff",
            }}
          >
            Newleey
          </span>
        </Link>

        <div style={{ display: "flex", gap: "2px" }}>
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/marketplace", label: "Marketplace" },
            { href: "/wallet", label: "Wallet" },
            { href: "/leads", label: "My Leads" },
          ].map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "7px 13px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: active ? "#fff" : "rgba(255,255,255,0.42)",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Onboarding status — hidden while on onboarding page */}
        {!onboardingLoading && !onOnboardingRoute && (
          <>
            {!onboardingComplete ? (
              <Link
                href="/onboarding"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "Syne, sans-serif",
                  textDecoration: "none",
                  color: "#e0e7ff",
                  background:
                    "linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.22) 100%)",
                  border: "1px solid rgba(129,140,248,0.45)",
                  boxShadow:
                    "0 0 0 1px rgba(99,102,241,0.15) inset, 0 4px 20px rgba(99,102,241,0.2)",
                  transition: "transform 0.15s, box-shadow 0.2s",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                  aria-hidden
                >
                  ✨
                </span>
                Complete setup
              </Link>
            ) : onboardingSkipped ? (
              <Link
                href="/onboarding?resume=1"
                title="Continue setup from your last step"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "Syne, sans-serif",
                  textDecoration: "none",
                  color: "rgba(255,255,255,0.75)",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(99,102,241,0.12) 100%)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
                  transition: "transform 0.15s, box-shadow 0.2s",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(99,102,241,0.25)",
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
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "Syne, sans-serif",
                  color: "#6ee7b7",
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.12) 100%)",
                  border: "1px solid rgba(52,211,153,0.35)",
                  boxShadow: "0 0 20px rgba(16,185,129,0.12)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(16,185,129,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                  }}
                  aria-hidden
                >
                  ✓
                </span>
                Setup complete
              </span>
            )}
          </>
        )}

        {/* WALLET */}
        <Link
          href="/wallet"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            background: "rgba(16,185,129,0.09)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "100px",
            padding: "6px 14px",
            fontSize: "13px",
            color: "#6ee7b7",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          ${isLoading ? "—" : (walletBalance / 100).toFixed(0)}
        </Link>

        {/* AVATAR + DROPDOWN */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              width: "34px",
              height: "34px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {avatarLetter}
          </div>

          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "44px",
                width: "200px",
                background: "rgba(15,18,25,0.98)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "10px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              }}
            >
              <div
                style={{
                  padding: "8px 10px",
                  fontSize: "13px",
                  color: "#fff",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  marginBottom: "6px",
                }}
              >
                {displayName}
              </div>

              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}