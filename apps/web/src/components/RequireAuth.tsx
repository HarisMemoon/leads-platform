"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthMe } from "@/lib/auth-api";
import { clearAccessToken, getAccessToken } from "@/lib/token";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        await getAuthMe();
        if (!cancelled) setReady(true);
      } catch {
        clearAccessToken();
        if (!cancelled) router.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return null;

  return <>{children}</>;
}