"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { getAuthMe } from "@/lib/auth-api";
import { setAccessToken } from "@/lib/token";
import styles from "./GoogleSignInButton.module.css";

type GsiWindow = Window & {
  google?: {
    accounts: {
      id: {
        initialize: (cfg: {
          client_id: string;
          callback: (r: { credential?: string }) => void;
        }) => void;
        renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
      };
    };
  };
};

/** Primary actions on auth pages use ~56px min-height; Google iframe is vertically centered in this row */
const PRIMARY_ROW_MIN_PX = 56;

export type GoogleSignInButtonProps = {
  variant?: "signin" | "signup";
  onError?: (message: string) => void;
  redirectTo?: string;
};

/**
 * Google Identity Services button → POST /api/auth/google with id_token.
 * Full width; height row matches primary Sign in / Continue buttons (56px).
 */
export function GoogleSignInButton({
  variant = "signin",
  onError,
  redirectTo = "/onboarding",
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pixelWidth, setPixelWidth] = useState(0);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";

  useEffect(() => {
    if (!clientId) return;
    const existing = document.querySelector('script[data-gsi="1"]');
    if (existing) {
      setGsiLoaded(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.dataset.gsi = "1";
    s.onload = () => setGsiLoaded(true);
    document.body.appendChild(s);
  }, [clientId]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setPixelWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const exchangeToken = useCallback(
    async (idToken: string) => {
      setBusy(true);
      onError?.("");
      try {
        const res = await fetch(`/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: idToken }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            message?: string | string[];
          };
          const raw = data.message;
          const msg = Array.isArray(raw) ? raw.join(", ") : raw;
          throw new Error(msg || "Google sign-in failed");
        }
        const data = (await res.json()) as { access_token: string };
        setAccessToken(data.access_token);
        const me = await getAuthMe();
        router.push(me.role === "admin" ? "/admin/console" : redirectTo);
      } catch (err: unknown) {
        onError?.(err instanceof Error ? err.message : "Google sign-in failed");
      } finally {
        setBusy(false);
      }
    },
    [onError, redirectTo, router],
  );

  useEffect(() => {
    if (!clientId || !gsiLoaded || !hostRef.current || pixelWidth < 120) return;
    const w = window as GsiWindow;
    if (!w.google?.accounts?.id) return;

    hostRef.current.innerHTML = "";
    w.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (resp) => {
        if (!resp.credential) return;
        await exchangeToken(resp.credential);
      },
    });
    /* Account for .hoverRing horizontal border so the iframe fits */
    const innerW = Math.max(120, pixelWidth - 6);
    w.google.accounts.id.renderButton(hostRef.current, {
      theme: "outline",
      size: "large",
      width: innerW,
      text: variant === "signup" ? "signup_with" : "signin_with",
    });
  }, [clientId, gsiLoaded, variant, exchangeToken, pixelWidth]);

  const shellClass = `${styles.shell}${busy ? ` ${styles.shellBusy}` : ""}`;

  if (!clientId) {
    return (
      <div ref={wrapRef} className={shellClass}>
        <button
          type="button"
          className={styles.fallbackBtn}
          disabled={busy}
          onClick={() =>
            onError?.(
              "Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID (same OAuth client as the API GOOGLE_CLIENT_ID).",
            )
          }
        >
          <GoogleGIcon />
          {variant === "signup" ? "Sign up with Google" : "Sign in with Google"}
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={shellClass}>
      <div className={styles.hoverRing}>
        <div
          ref={hostRef}
          className={styles.host}
          style={{ minHeight: PRIMARY_ROW_MIN_PX }}
        />
      </div>
    </div>
  );
}

function GoogleGIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
