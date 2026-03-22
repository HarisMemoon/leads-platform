"use client";

import Navbar from "@/components/Navbar";
import RequireAuth from "@/components/RequireAuth";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
        
        {/* Sidebar */}
        {/* <aside style={{ width: 200, borderRight: "1px solid #ccc", padding: 16 }}>
          <h3>Dashboard</h3>

          <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/dashboard/onboarding">Onboarding</Link>
            <Link href="/dashboard/wallet">Wallet</Link>
            <Link href="/dashboard/marketplace">Marketplace</Link>
          </nav>
        </aside> */}

        {/* Single scroll area: navbar fixed height, content scrolls only when needed */}
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <Navbar />
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {children}
          </div>
        </main>
    </RequireAuth>
  );
}