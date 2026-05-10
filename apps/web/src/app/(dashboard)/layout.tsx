"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import RequireAuth from "@/components/RequireAuth";
import LegacyPlanBanner from "@/components/LegacyPlanBanner";

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
          {!hideNavbar && <LegacyPlanBanner />}
          {children}
        </main>
    </RequireAuth>
  );
}