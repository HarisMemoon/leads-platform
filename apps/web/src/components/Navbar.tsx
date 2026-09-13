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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const { data: user } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: getAuthMe,
  });
  const isAdmin = user?.role === "admin";

  const { data: wallet, isLoading } = useQuery({
    queryKey: queryKeys.wallet.me,
    queryFn: getWalletMe,
    enabled: Boolean(user) && !isAdmin,
  });

  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: queryKeys.onboarding.me,
    queryFn: getOnboardingMe,
    enabled: Boolean(user) && !isAdmin,
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
    !isAdmin &&
    !onboardingLoading &&
    !onOnboardingRoute &&
    (!onboardingComplete || onboardingSkipped);

  const navLinks = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/leads", label: "My Leads" },
    { href: "/settings", label: "Settings" },
  ];

  if (!user || isAdmin) return null;

  // Reusable Avatar Element
  const Avatar = () => (
    <div
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
        color: "#fff",
        boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {avatarLetter}
    </div>
  );

  // Reusable CTA Renderer
  const renderOnboardingCTA = (isMobile = false) => {
    if (!showOnboardingCta) return null;

    const baseStyle = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: isMobile ? "center" : "flex-start",
      width: isMobile ? "100%" : "auto",
      gap: 8,
      padding: "10px 15px",
      borderRadius: isMobile ? 12 : 999,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "Syne, sans-serif",
      textDecoration: "none",
    };

    if (!onboardingComplete) {
      return (
        <Link
          href="/onboarding"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            ...baseStyle,
            color: "#e0e7ff",
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.4) 0%, rgba(139,92,246,0.25) 100%)",
            border: "1px solid rgba(129,140,248,0.45)",
            boxShadow:
              "0 0 0 1px rgba(99,102,241,0.12) inset, 0 4px 18px rgba(99,102,241,0.22)",
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
          >
            ✨
          </span>
          Complete setup
        </Link>
      );
    }

    return (
      <Link
        href="/onboarding?resume=1"
        onClick={() => setIsMobileMenuOpen(false)}
        style={{
          ...baseStyle,
          color: "rgba(255,255,255,0.85)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(99,102,241,0.14) 100%)",
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
        >
          ↩
        </span>
        Resume setup
      </Link>
    );
  };

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
          background: linear-gradient(165deg, rgba(22, 24, 35, 0.88) 0%, rgba(10, 12, 18, 0.92) 100%);
          backdrop-filter: blur(20px) saturate(1.35);
          -webkit-backdrop-filter: blur(20px) saturate(1.35);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04) inset, 0 1px 0 rgba(255, 255, 255, 0.06) inset;
          display: flex;
          flex-direction: column;
        }
        .nav-float-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 18px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(16, 185, 129, 0.12) 50%, rgba(139, 92, 246, 0.15));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.65;
        }
        .nav-top-bar {
          position: relative;
          z-index: 2;
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px 8px 16px;
        }
        .nav-links-scroll {
          display: flex;
          gap: 2px;
          align-items: center;
        }
        .nav-link-pill {
          padding: 8px 13px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.15s;
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

        /* --- Mobile Responsive Classes --- */
        .mobile-only { display: none !important; }
        .desktop-only { display: flex !important; }

        .hamburger-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px 4px;
          flex-direction: column;
          gap: 5px;
          align-items: center;
          justify-content: center;
        }
        .hamburger-line {
          width: 20px;
          height: 2px;
          background-color: #fff;
          border-radius: 2px;
          transition: transform 0.3s ease, opacity 0.3s ease;
        }

        .mobile-menu-drawer {
          display: none; /* Always hidden on desktop */
          flex-direction: column;
          padding: 4px 16px 20px;
          gap: 16px;
          position: relative;
          z-index: 1;
        }

        .mobile-nav-link {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          color: rgba(255, 255, 255, 0.65);
          transition: all 0.2s;
        }
        .mobile-nav-link[data-active="true"] {
          color: #fff;
          background: rgba(99, 102, 241, 0.12);
          box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.25) inset;
        }

        @media (max-width: 1024px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          /* Only show the drawer when data-open is true */
          .mobile-menu-drawer[data-open="true"] { display: flex !important; }
        }
      `}</style>

      <div className="nav-float-wrap" aria-label="Primary navigation">
        <nav className="nav-float-shell">
          {/* ----- TOP BAR ----- */}
          <div className="nav-top-bar">
            {/* LEFT: Logo & Desktop Links */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                flex: 1,
              }}
            >
              <Link
                href="/marketplace"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexShrink: 0,
                  textDecoration: "none",
                }}
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
                    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
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

              {/* Desktop Nav Links */}
              <div className="nav-links-scroll desktop-only">
                {navLinks.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="nav-link-pill"
                      data-active={active}
                      style={{
                        color: active ? "#fff" : "rgba(255, 255, 255, 0.42)",
                        background: active
                          ? "rgba(99, 102, 241, 0.18)"
                          : "transparent",
                      }}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Desktop Actions & Mobile Hamburger */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
              }}
            >
              {/* Desktop CTA */}
              <div className="desktop-only">{renderOnboardingCTA(false)}</div>

              {/* Desktop Wallet */}
              {!isAdmin && (
                <Link
                  href="/wallet"
                  className="desktop-only"
                  style={{
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
              )}

              {/* Desktop Profile Dropdown */}
              <div className="desktop-only" style={{ position: "relative" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setDropdownOpen(!dropdownOpen);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <Avatar />
                </div>
                {dropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 48,
                      width: 216,
                      background:
                        "linear-gradient(165deg, rgba(22,24,35,0.98) 0%, rgba(12,14,20,0.99) 100%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 14,
                      padding: 10,
                      boxShadow:
                        "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
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

              {/* Mobile Hamburger Button */}
              <button
                className="hamburger-btn mobile-only"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                <span
                  className="hamburger-line"
                  style={{
                    transform: isMobileMenuOpen
                      ? "translateY(7px) rotate(45deg)"
                      : "none",
                  }}
                ></span>
                <span
                  className="hamburger-line"
                  style={{ opacity: isMobileMenuOpen ? 0 : 1 }}
                ></span>
                <span
                  className="hamburger-line"
                  style={{
                    transform: isMobileMenuOpen
                      ? "translateY(-7px) rotate(-45deg)"
                      : "none",
                  }}
                ></span>
              </button>
            </div>
          </div>

          {/* ----- MOBILE MENU DRAWER ----- */}
          <div
            className="mobile-menu-drawer"
            data-open={isMobileMenuOpen ? "true" : "false"}
          >
            {/* Divider */}
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.06)",
                width: "100%",
                margin: "0 0 4px 0",
              }}
            />

            {/* Mobile Nav Links */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="mobile-nav-link"
                    data-active={active}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Mobile Wallet Badge */}
            {!isAdmin && (
              <Link
                href="/wallet"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.04) 100%)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>💳</span>
                  <span
                    style={{ fontSize: 14, color: "#a7f3d0", fontWeight: 600 }}
                  >
                    Wallet Balance
                  </span>
                </div>
                <span
                  style={{ fontSize: 16, color: "#10b981", fontWeight: 700 }}
                >
                  ${isLoading ? "—" : (walletBalance / 100).toFixed(0)}
                </span>
              </Link>
            )}

            {/* Mobile Onboarding CTA */}
            {showOnboardingCta && renderOnboardingCTA(true)}

            {/* Mobile Profile & Logout */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "14px 16px",
                marginTop: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}
                  >
                    {displayName}
                  </span>
                  <span
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}
                  >
                    My Account
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#f87171",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
// "use client";

// import Link from "next/link";
// import { useState } from "react";
// import { usePathname, useRouter } from "next/navigation";
// import { useQuery } from "@tanstack/react-query";
// import { getAuthMe } from "@/lib/auth-api";
// import { getOnboardingMe } from "@/lib/onboarding-api";
// import { getWalletMe } from "@/lib/wallet-api";
// import { queryKeys } from "@/lib/query-keys";
// import { clearAccessToken } from "@/lib/token";

// export default function Navbar() {
//   const router = useRouter();
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
//   const pathname = usePathname();

//   const { data: user } = useQuery({
//     queryKey: queryKeys.auth.me,
//     queryFn: getAuthMe,
//   });
//   const isAdmin = user?.role === "admin";

//   const { data: wallet, isLoading } = useQuery({
//     queryKey: queryKeys.wallet.me,
//     queryFn: getWalletMe,
//     enabled: Boolean(user) && !isAdmin,
//   });

//   const { data: onboarding, isLoading: onboardingLoading } = useQuery({
//     queryKey: queryKeys.onboarding.me,
//     queryFn: getOnboardingMe,
//     enabled: Boolean(user) && !isAdmin,
//   });

//   const walletBalance = Number((wallet?.balance_cents as string) || 0);

//   const onOnboardingRoute =
//     pathname === "/onboarding" || pathname?.startsWith("/onboarding/");
//   const onboardingComplete = Boolean(onboarding?.completed_at);
//   const onboardingSkipped = Boolean(
//     onboarding?.data &&
//     typeof onboarding.data === "object" &&
//     (onboarding.data as { skipped?: boolean }).skipped === true,
//   );

//   const displayName =
//     user?.full_name?.trim() ||
//     user?.email?.split("@")[0]?.replace(/\./g, " ") ||
//     "User";
//   const avatarLetter = (
//     user?.full_name?.trim()?.charAt(0) ||
//     user?.email?.charAt(0) ||
//     "U"
//   ).toUpperCase();

//   const handleLogout = () => {
//     clearAccessToken();
//     router.push("/login");
//   };

//   const showOnboardingCta =
//     !isAdmin &&
//     !onboardingLoading &&
//     !onOnboardingRoute &&
//     (!onboardingComplete || onboardingSkipped);
//   const navLinks = [
//     { href: "/marketplace", label: "Marketplace" },
//     { href: "/leads", label: "My Leads" },
//     { href: "/resources", label: "Resources" },
//     { href: "/settings", label: "Settings" },
//   ];

//   if (!user || isAdmin) return null;

//   return (
//     <>
//       <style>{`
//         .nav-float-wrap {
//           position: sticky;
//           top: 0;
//           z-index: 100;
//           padding: 14px 20px 0;
//           display: flex;
//           justify-content: center;
//           pointer-events: none;
//         }
//         .nav-float-shell {
//           pointer-events: auto;
//           width: min(1240px, calc(100% - 8px));
//           position: relative;
//           border-radius: 18px;
//           border: 1px solid rgba(255, 255, 255, 0.09);
//           background: linear-gradient(
//             165deg,
//             rgba(22, 24, 35, 0.88) 0%,
//             rgba(10, 12, 18, 0.92) 100%
//           );
//           backdrop-filter: blur(20px) saturate(1.35);
//           -webkit-backdrop-filter: blur(20px) saturate(1.35);
//           box-shadow:
//             0 4px 24px rgba(0, 0, 0, 0.35),
//             0 0 0 1px rgba(255, 255, 255, 0.04) inset,
//             0 1px 0 rgba(255, 255, 255, 0.06) inset;
//         }
//         .nav-float-shell::before {
//           content: "";
//           position: absolute;
//           inset: 0;
//           border-radius: 18px;
//           padding: 1px;
//           background: linear-gradient(
//             135deg,
//             rgba(99, 102, 241, 0.22),
//             rgba(16, 185, 129, 0.12) 50%,
//             rgba(139, 92, 246, 0.15)
//           );
//           -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
//           mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
//           -webkit-mask-composite: xor;
//           mask-composite: exclude;
//           pointer-events: none;
//           opacity: 0.65;
//         }
//         .nav-inner {
//           position: relative;
//           z-index: 1;
//           min-height: 54px;
//           display: flex;
//           align-items: center;
//           justify-content: space-between;
//           gap: 16px;
//           padding: 8px 14px 8px 16px;
//         }
//         .nav-links-scroll {
//           display: flex;
//           gap: 2px;
//           overflow-x: auto;
//           scrollbar-width: none;
//           -ms-overflow-style: none;
//           flex: 1;
//           min-width: 0;
//           justify-content: flex-start;
//         }
//         .nav-links-scroll::-webkit-scrollbar {
//           display: none;
//         }
//         .nav-link-pill {
//           padding: 8px 13px;
//           border-radius: 10px;
//           font-size: 13px;
//           font-weight: 500;
//           text-decoration: none;
//           white-space: nowrap;
//           transition: color 0.15s, background 0.15s, box-shadow 0.15s;
//         }
//         .nav-link-pill:hover {
//           color: rgba(255, 255, 255, 0.88) !important;
//           background: rgba(255, 255, 255, 0.06) !important;
//         }
//         .nav-link-pill[data-active="true"] {
//           color: #fff !important;
//           background: rgba(99, 102, 241, 0.18) !important;
//           box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.25);
//         }
//         @media (max-width: 1024px) {
//           .nav-left-brand {
//             flex-shrink: 0;
//           }
//           .nav-inner {
//             flex-wrap: wrap;
//             row-gap: 10px;
//           }
//           .nav-links-scroll {
//             order: 3;
//             width: 100%;
//             padding-bottom: 4px;
//             border-top: 1px solid rgba(255, 255, 255, 0.06);
//             padding-top: 10px;
//             margin-top: 2px;
//           }
//             .hamburger-btn {
//           display: none;
//           background: transparent;
//           border: none;
//           cursor: pointer;
//           padding: 8px;
//           flex-direction: column;
//           gap: 4px;
//           align-items: center;
//           justify-content: center;
//         }
//         .hamburger-line {
//           width: 18px;
//           height: 2px;
//           background-color: #fff;
//           border-radius: 2px;
//           transition: transform 0.3s ease, opacity 0.3s ease;
//         }

//         @media (max-width: 1024px) {
//           .nav-left-brand {
//             flex-shrink: 0;
//           }
//           .nav-left-wrapper {
//             flex-wrap: wrap; /* Allows the scroll div to wrap to a new line */
//           }
//           .nav-inner {
//             flex-wrap: wrap;
//             row-gap: 10px;
//           }
//           .hamburger-btn {
//             display: flex; /* Show hamburger on mobile */
//           }
//           .nav-links-scroll {
//             display: none; /* Hide links by default */
//             flex-direction: column; /* Stack vertically for a classic mobile menu */
//             order: 3;
//             width: 100%;
//             padding-bottom: 4px;
//             border-top: 1px solid rgba(255, 255, 255, 0.06);
//             padding-top: 10px;
//             margin-top: 2px;
//           }
//           .nav-links-scroll[data-mobile-open="true"] {
//             display: flex; /* Show when open */
//           }
//         }
//       `}</style>

//       <div className="nav-float-wrap" aria-label="Primary navigation">
//         <nav className="nav-float-shell">
//           <div className="nav-inner">
//             {/* LEFT: brand + links */}
//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: 20,
//                 minWidth: 0,
//                 flex: 1,
//               }}
//             >
//               <Link
//                 href="/marketplace"
//                 className="nav-left-brand"
//                 style={{
//                   display: "flex",
//                   alignItems: "center",
//                   gap: 10,
//                   flexShrink: 0,
//                   textDecoration: "none",
//                 }}
//               >
//                 <div
//                   style={{
//                     width: 32,
//                     height: 32,
//                     background: "linear-gradient(135deg, #6366f1, #10b981)",
//                     borderRadius: 9,
//                     display: "flex",
//                     alignItems: "center",
//                     justifyContent: "center",
//                     flexShrink: 0,
//                     boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
//                   }}
//                 >
//                   <svg
//                     width="15"
//                     height="15"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     aria-hidden
//                   >
//                     <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
//                   </svg>
//                 </div>
//                 <span
//                   style={{
//                     fontFamily: "Syne, sans-serif",
//                     fontSize: 16,
//                     fontWeight: 700,
//                     color: "#fff",
//                     letterSpacing: -0.3,
//                   }}
//                 >
//                   Newleey
//                 </span>
//               </Link>

//               <div className="nav-links-scroll">
//                 {navLinks.map((link) => {
//                   const active = pathname === link.href;
//                   return (
//                     <Link
//                       key={link.href}
//                       href={link.href}
//                       className="nav-link-pill"
//                       data-active={active}
//                       style={{
//                         color: active ? "#fff" : "rgba(255, 255, 255, 0.42)",
//                         background: active
//                           ? "rgba(99, 102, 241, 0.18)"
//                           : "transparent",
//                       }}
//                     >
//                       {link.label}
//                     </Link>
//                   );
//                 })}
//               </div>
//             </div>

//             {/* RIGHT */}
//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: 12,
//                 flexShrink: 0,
//               }}
//             >
//               {showOnboardingCta && (
//                 <>
//                   {!onboardingComplete ? (
//                     <Link
//                       href="/onboarding"
//                       style={{
//                         display: "inline-flex",
//                         alignItems: "center",
//                         gap: 8,
//                         padding: "8px 15px",
//                         borderRadius: 999,
//                         fontSize: 12,
//                         fontWeight: 600,
//                         fontFamily: "Syne, sans-serif",
//                         textDecoration: "none",
//                         color: "#e0e7ff",
//                         background:
//                           "linear-gradient(135deg, rgba(99,102,241,0.4) 0%, rgba(139,92,246,0.25) 100%)",
//                         border: "1px solid rgba(129,140,248,0.45)",
//                         boxShadow:
//                           "0 0 0 1px rgba(99,102,241,0.12) inset, 0 4px 18px rgba(99,102,241,0.22)",
//                       }}
//                     >
//                       <span
//                         style={{
//                           display: "flex",
//                           width: 22,
//                           height: 22,
//                           borderRadius: "50%",
//                           background: "rgba(255,255,255,0.14)",
//                           alignItems: "center",
//                           justifyContent: "center",
//                           fontSize: 11,
//                         }}
//                         aria-hidden
//                       >
//                         ✨
//                       </span>
//                       Complete setup
//                     </Link>
//                   ) : (
//                     <Link
//                       href="/onboarding?resume=1"
//                       title="Continue setup from your last step"
//                       style={{
//                         display: "inline-flex",
//                         alignItems: "center",
//                         gap: 8,
//                         padding: "8px 15px",
//                         borderRadius: 999,
//                         fontSize: 12,
//                         fontWeight: 600,
//                         fontFamily: "Syne, sans-serif",
//                         textDecoration: "none",
//                         color: "rgba(255,255,255,0.78)",
//                         background:
//                           "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(99,102,241,0.14) 100%)",
//                         border: "1px solid rgba(255,255,255,0.12)",
//                         boxShadow: "0 2px 14px rgba(0,0,0,0.2)",
//                       }}
//                     >
//                       <span
//                         style={{
//                           display: "flex",
//                           width: 22,
//                           height: 22,
//                           borderRadius: "50%",
//                           background: "rgba(99,102,241,0.28)",
//                           alignItems: "center",
//                           justifyContent: "center",
//                           fontSize: 11,
//                         }}
//                         aria-hidden
//                       >
//                         ↩
//                       </span>
//                       Resume setup
//                     </Link>
//                   )}
//                 </>
//               )}

//               {!isAdmin && (
//                 <Link
//                   href="/wallet"
//                   style={{
//                     display: "flex",
//                     alignItems: "center",
//                     gap: 7,
//                     background: "rgba(16,185,129,0.12)",
//                     border: "1px solid rgba(16,185,129,0.28)",
//                     borderRadius: 100,
//                     padding: "7px 15px",
//                     fontSize: 13,
//                     color: "#6ee7b7",
//                     fontWeight: 600,
//                     textDecoration: "none",
//                     boxShadow: "0 0 20px rgba(16,185,129,0.08)",
//                   }}
//                 >
//                   ${isLoading ? "—" : (walletBalance / 100).toFixed(0)}
//                 </Link>
//               )}

//               <div style={{ position: "relative" }}>
//                 <div
//                   role="button"
//                   tabIndex={0}
//                   onClick={() => setDropdownOpen(!dropdownOpen)}
//                   onKeyDown={(e) => {
//                     if (e.key === "Enter" || e.key === " ") {
//                       e.preventDefault();
//                       setDropdownOpen(!dropdownOpen);
//                     }
//                   }}
//                   style={{
//                     width: 36,
//                     height: 36,
//                     background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
//                     borderRadius: "50%",
//                     display: "flex",
//                     alignItems: "center",
//                     justifyContent: "center",
//                     fontSize: 12,
//                     fontWeight: 700,
//                     cursor: "pointer",
//                     boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
//                     border: "1px solid rgba(255,255,255,0.12)",
//                   }}
//                 >
//                   {avatarLetter}
//                 </div>

//                 {dropdownOpen && (
//                   <div
//                     style={{
//                       position: "absolute",
//                       right: 0,
//                       top: 48,
//                       width: 216,
//                       background:
//                         "linear-gradient(165deg, rgba(22,24,35,0.98) 0%, rgba(12,14,20,0.99) 100%)",
//                       border: "1px solid rgba(255,255,255,0.1)",
//                       borderRadius: 14,
//                       padding: 10,
//                       boxShadow:
//                         "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
//                       backdropFilter: "blur(16px)",
//                     }}
//                   >
//                     <div
//                       style={{
//                         padding: "10px 12px",
//                         fontSize: 13,
//                         color: "#fff",
//                         fontWeight: 600,
//                         borderBottom: "1px solid rgba(255,255,255,0.06)",
//                         marginBottom: 6,
//                       }}
//                     >
//                       {displayName}
//                     </div>

//                     <button
//                       type="button"
//                       onClick={handleLogout}
//                       style={{
//                         width: "100%",
//                         textAlign: "left",
//                         padding: "10px 12px",
//                         borderRadius: 10,
//                         background: "transparent",
//                         border: "none",
//                         color: "rgba(255,255,255,0.72)",
//                         fontSize: 13,
//                         cursor: "pointer",
//                       }}
//                     >
//                       Logout
//                     </button>
//                   </div>
//                 )}
//               </div>
//               <button
//                 className="hamburger-btn"
//                 onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
//                 aria-label="Toggle mobile menu"
//               >
//                 <span
//                   className="hamburger-line"
//                   style={{
//                     transform: isMobileMenuOpen
//                       ? "translateY(6px) rotate(45deg)"
//                       : "none",
//                   }}
//                 ></span>
//                 <span
//                   className="hamburger-line"
//                   style={{ opacity: isMobileMenuOpen ? 0 : 1 }}
//                 ></span>
//                 <span
//                   className="hamburger-line"
//                   style={{
//                     transform: isMobileMenuOpen
//                       ? "translateY(-6px) rotate(-45deg)"
//                       : "none",
//                   }}
//                 ></span>
//               </button>
//             </div>
//           </div>
//         </nav>
//       </div>
//     </>
//   );
// }
