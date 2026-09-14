"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getAuthMe } from "@/lib/auth-api";
import { clearAccessToken } from "@/lib/token";
import { queryKeys } from "@/lib/query-keys";

// --- Shared Components ---
import { Pill } from "./components/Pill";

// --- Feature Tabs ---
import OverviewTab from "./tabs/overview/OverviewTab";
import InventoryTab from "./tabs/inventory/InventoryTab";
import IngestionTab from "./tabs/ingestion/IngestionTab";
import DuplicatesTab from "./tabs/duplicates/DuplicatesTab";
import DistributionTab from "./tabs/distribution/DistributionTab";
import VendorPingsTab from "./tabs/pings/VendorPingsTab";
import PricingTab from "./tabs/pricing/PricingTab";
import WalletTab from "./tabs/wallet/WalletTab";
import SubscriptionsTab from "./tabs/subscriptions/SubscriptionsTab";
import CustomersTab from "./tabs/customers/CustomersTab";
import IntegrationsTab from "./tabs/integrations/IntegrationsTab";
import ResourcesTab from "./tabs/resources/ResourcesTab";
import AuditTab from "./tabs/audit/AuditTab";

// --- Constants ---
type TabId =
  | "overview"
  | "inventory"
  | "ingestion"
  | "duplicates"
  | "distribution"
  | "pings"
  | "pricing"
  | "wallet"
  | "subscriptions"
  | "customers"
  | "integrations"
  | "notifications"
  | "audit";
type TabDef = { id: TabId; label: string; group: string; hint: string };

const TABS: TabDef[] = [
  {
    id: "overview",
    label: "Dashboard",
    group: "Overview",
    hint: "Revenue, leads, and health at a glance",
  },
  {
    id: "inventory",
    label: "Leads",
    group: "Leads",
    hint: "Browse, edit, and delete leads",
  },
  {
    id: "ingestion",
    label: "Add Leads",
    group: "Leads",
    hint: "Upload CSVs or connect vendor feeds",
  },
  {
    id: "duplicates",
    label: "Duplicates",
    group: "Leads",
    hint: "Review leads with duplicate phone numbers",
  },
  {
    id: "distribution",
    label: "Auto-Distribution",
    group: "Operations",
    hint: "Control the engine that routes leads to buyers",
  },
  {
    id: "pings",
    label: "Lead Vendors",
    group: "Operations",
    hint: "Manage vendor connections and routing",
  },
  {
    id: "pricing",
    label: "Pricing",
    group: "Operations",
    hint: "Automatic markdowns and Pro early access",
  },
  {
    id: "wallet",
    label: "Customer Wallets",
    group: "Finance",
    hint: "Add credits to any customer account",
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    group: "Finance",
    hint: "Pro plan health and settings",
  },
  {
    id: "customers",
    label: "Customers",
    group: "People",
    hint: "Manage accounts and handle refunds",
  },
  {
    id: "integrations",
    label: "System Health",
    group: "System",
    hint: "Check Stripe, GHL, and other connections",
  },
  {
    id: "notifications",
    label: "Resources",
    group: "System",
    hint: "Manage buyer-facing resources and links",
  },
  {
    id: "audit",
    label: "Audit Log",
    group: "System",
    hint: "Record of all sensitive admin actions",
  },
];

export default function AdminConsolePage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: getAuthMe,
  });

  const grouped = useMemo(() => {
    const out = new Map<string, TabDef[]>();
    for (const t of TABS) {
      const arr = out.get(t.group) ?? [];
      arr.push(t);
      out.set(t.group, arr);
    }
    return Array.from(out.entries());
  }, []);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const adminName =
    user?.full_name?.trim() ||
    user?.email?.split("@")[0]?.replace(/\./g, " ") ||
    "Admin";
  const adminInitial = (
    user?.full_name?.trim()?.charAt(0) ||
    user?.email?.charAt(0) ||
    "A"
  ).toUpperCase();

  function handleLogout() {
    clearAccessToken();
    router.push("/login");
  }

  // Close mobile menu when a tab is selected
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [tab]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(99,102,241,0.08), #06080c 60%)",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <style>{`
        .admin-nav::-webkit-scrollbar { display: none; }
        
        .admin-layout {
          display: flex; gap: 32px; align-items: flex-start;
        }
        
        .admin-sidebar {
          width: 220px; flex-shrink: 0; display: flex; flex-direction: column;
          position: sticky; top: 24px; max-height: calc(100vh - 160px); overflow-y: auto;
        }

        .mobile-toggle { display: none; }

        @media (max-width: 1024px) {
          .admin-layout { flex-direction: column; gap: 16px; }
          
          /* Hide standard sidebar on mobile */
          .admin-sidebar {
            display: none; width: 100%; position: relative; top: 0; max-height: none;
            background: #0f111a; border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 16px; padding: 16px; z-index: 50;
          }
          
          /* Show when toggled */
          .admin-sidebar.open { display: flex; animation: slideDown 0.3s ease-out; }
          
          .mobile-toggle {
            display: flex; justify-content: space-between; align-items: center;
            width: 100%; padding: 16px 20px; background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
            font-size: 15px; font-weight: 600; color: #fff; cursor: pointer;
            margin-bottom: 8px;
          }
          
          .header-container { padding-bottom: 16px !important; margin-bottom: 16px !important; }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 24px 100px" }}
      >
        {/* Header */}
        <div
          className="header-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 32,
            gap: 16,
            flexWrap: "wrap",
            paddingBottom: 24,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(165,180,252,0.8)",
                marginBottom: 6,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Admin Console
            </div>
            <h1
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 32,
                fontWeight: 800,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              {active.label}
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                marginTop: 6,
                fontSize: 14,
              }}
            >
              {active.hint}
            </p>
          </div>
          <Pill tone="info">
            System Synced: {new Date().toLocaleTimeString()}
          </Pill>
        </div>

        <div className="admin-layout">
          {/* Mobile Menu Toggle */}
          <button
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span>
              Menu: <span style={{ color: "#a5b4fc" }}>{active.label}</span>
            </span>
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* Sidebar */}
          <nav
            className={`admin-nav admin-sidebar ${mobileMenuOpen ? "open" : ""}`}
          >
            <div style={{ flex: 1 }}>
              {grouped.map(([group, items], gi) => (
                <div key={group} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: gi === 0 ? "0 8px 8px" : "16px 8px 8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: "rgba(255,255,255,0.3)",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {group}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "rgba(255,255,255,0.05)",
                      }}
                    />
                  </div>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    {items.map((t) => {
                      const isActive = t.id === tab;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTab(t.id)}
                          style={{
                            textAlign: "left",
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "none",
                            background: isActive
                              ? "rgba(99,102,241,0.15)"
                              : "transparent",
                            color: isActive
                              ? "#c7d2fe"
                              : "rgba(255,255,255,0.55)",
                            fontWeight: isActive ? 600 : 500,
                            fontSize: 13,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            borderLeft: isActive
                              ? "3px solid #818cf8"
                              : "3px solid transparent",
                          }}
                          onMouseEnter={(e) =>
                            !isActive &&
                            ((e.currentTarget.style.color = "#fff"),
                            (e.currentTarget.style.background =
                              "rgba(255,255,255,0.03)"))
                          }
                          onMouseLeave={(e) =>
                            !isActive &&
                            ((e.currentTarget.style.color =
                              "rgba(255,255,255,0.55)"),
                            (e.currentTarget.style.background = "transparent"))
                          }
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* User Footer */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#fff",
                    boxShadow: "0 0 12px rgba(99,102,241,0.3)",
                  }}
                >
                  {adminInitial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {adminName}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 2,
                    }}
                  >
                    Superadmin
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.2)",
                  background: "rgba(239,68,68,0.05)",
                  color: "#fca5a5",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                  marginTop: 12,
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(239,68,68,0.15)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(239,68,68,0.05)")
                }
              >
                Sign Out
              </button>
            </div>
          </nav>

          {/* Main Content Router */}
          <main className="admin-main" style={{ flex: 1, minWidth: 0 }}>
            {tab === "overview" && <OverviewTab />}
            {tab === "inventory" && <InventoryTab />}
            {tab === "ingestion" && <IngestionTab />}
            {tab === "duplicates" && <DuplicatesTab />}
            {tab === "distribution" && <DistributionTab />}
            {tab === "pings" && <VendorPingsTab />}
            {tab === "pricing" && <PricingTab />}
            {tab === "wallet" && <WalletTab />}
            {tab === "subscriptions" && <SubscriptionsTab />}
            {tab === "customers" && <CustomersTab />}
            {tab === "integrations" && <IntegrationsTab />}
            {tab === "notifications" && <ResourcesTab />}
            {tab === "audit" && <AuditTab />}
          </main>
        </div>
      </div>
    </div>
  );
}
