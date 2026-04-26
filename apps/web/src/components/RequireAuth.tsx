"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthMe } from "@/lib/auth-api";
import { clearAccessToken, getAccessToken } from "@/lib/token";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    setReady(false);

    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const user = await getAuthMe();
        if (user.role === "admin" && pathname !== "/admin/console" && !pathname.startsWith("/admin/console/")) {
          if (!cancelled) router.replace("/admin/console");
          return;
        }
        if (!cancelled) setReady(true);
      } catch {
        clearAccessToken();
        if (!cancelled) router.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) return null;

  return <>{children}</>;
}