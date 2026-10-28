"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Same floating-shell visual language as the dashboard <Navbar /> (blur,
 * gradient hairline, pill links, hamburger drawer), swapped for a logged-out
 * audience: no auth query, no wallet, no avatar — just nav links and the
 * sign-in / create-account actions.
 *
 * Headings use var(--font-heading) and body text inherits var(--font-body)
 * from globals.css, so this stays in sync with whatever the app's layout
 * loads for those variables — nothing is hardcoded here.
 */

const NAV_LINKS = [
  { href: "#marketplace", label: "Marketplace" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#automation", label: "Auto-buy & Ping/Post" },
  { href: "#pro-plan", label: "Pricing" },
];

export default function MarketingNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          color: rgba(255, 255, 255, 0.6);
        }
        .nav-link-pill:hover {
          color: rgba(255, 255, 255, 0.88) !important;
          background: rgba(255, 255, 255, 0.06) !important;
        }

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
          display: none;
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
        .mobile-nav-link:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
        }

        @media (max-width: 1024px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .mobile-menu-drawer[data-open="true"] { display: flex !important; }
        }
      `}</style>

      <div className="nav-float-wrap" aria-label="Primary navigation">
        <nav className="nav-float-shell">
          <div className="nav-top-bar">
            {/* LEFT: Logo & desktop links */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                flex: 1,
              }}
            >
              <Link
                href="/"
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
                    fontFamily: "var(--font-heading)",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: -0.3,
                  }}
                >
                  Newleey
                </span>
              </Link>

              <div className="nav-links-scroll desktop-only">
                {NAV_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="nav-link-pill">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* RIGHT: desktop actions & mobile hamburger */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <Link
                href="/login"
                className="desktop-only nav-link-pill"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign in
              </Link>

              <Link
                href="/register"
                className="desktop-only"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  alignItems: "center",
                  padding: "9px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "var(--font-heading)",
                  color: "#fff",
                  textDecoration: "none",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                Create free account
              </Link>

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
                />
                <span
                  className="hamburger-line"
                  style={{ opacity: isMobileMenuOpen ? 0 : 1 }}
                />
                <span
                  className="hamburger-line"
                  style={{
                    transform: isMobileMenuOpen
                      ? "translateY(-7px) rotate(-45deg)"
                      : "none",
                  }}
                />
              </button>
            </div>
          </div>

          {/* MOBILE DRAWER */}
          <div
            className="mobile-menu-drawer"
            data-open={isMobileMenuOpen ? "true" : "false"}
          >
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.06)",
                width: "100%",
                margin: "0 0 4px 0",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/login"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign in
              </Link>
            </div>

            <Link
              href="/register"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "var(--font-heading)",
                color: "#fff",
                textDecoration: "none",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              }}
            >
              Create free account
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
