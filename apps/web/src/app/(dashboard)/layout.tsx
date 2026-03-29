"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import RequireAuth from "@/components/RequireAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideNavbar =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");

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

        {/* Navbar is sticky + floating (see Navbar.tsx); content scrolls with the document. */}
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
            background: "#080a0f",
          }}
        >
          {!hideNavbar && <Navbar />}
          {children}
        </main>
    </RequireAuth>
  );
}