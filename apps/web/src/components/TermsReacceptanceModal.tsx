"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTermsStatus, acceptTerms } from "@/lib/auth-api";
import { queryKeys } from "@/lib/query-keys";

export default function TermsReacceptanceModal() {
  const qc = useQueryClient();

  const { data: termsStatus, isLoading } = useQuery({
    queryKey: queryKeys.terms.status,
    queryFn: getTermsStatus,
    staleTime: 5 * 60 * 1000,
  });

  const acceptMut = useMutation({
    mutationFn: acceptTerms,
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.terms.status }),
  });

  if (isLoading || !termsStatus || termsStatus.accepted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{
        background: "#13151f",
        border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 18,
        padding: "32px 28px",
        maxWidth: 480,
        width: "100%",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            fontSize: 20,
          }}>
            📋
          </div>
          <h2
            id="terms-modal-title"
            style={{
              fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 800,
              color: "#fff", margin: 0,
            }}
          >
            Updated Terms of Service
          </h2>
        </div>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, marginBottom: 8 }}>
          Our Terms of Service have been updated (version{" "}
          <strong style={{ color: "#a5b4fc" }}>{termsStatus.terms_version}</strong>). You must
          review and accept the new terms to continue using the platform and auto lead delivery.
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 24 }}>
          By clicking "Accept &amp; Continue" you agree to our{" "}
          <a href="/terms-of-service" target="_blank" rel="noopener" style={{ color: "#a5b4fc" }}>
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy-policy" target="_blank" rel="noopener" style={{ color: "#a5b4fc" }}>
            Privacy Policy
          </a>
          .
        </p>

        <button
          type="button"
          disabled={acceptMut.isPending}
          onClick={() => acceptMut.mutate()}
          style={{
            width: "100%",
            padding: "13px 0",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "#fff",
            fontFamily: "Syne, sans-serif",
            fontSize: 15,
            fontWeight: 700,
            cursor: acceptMut.isPending ? "not-allowed" : "pointer",
            opacity: acceptMut.isPending ? 0.7 : 1,
            boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
          }}
        >
          {acceptMut.isPending ? "Accepting…" : "Accept & Continue"}
        </button>

        {acceptMut.isError && (
          <p style={{ marginTop: 10, color: "#fca5a5", fontSize: 13, textAlign: "center" }}>
            {(acceptMut.error as Error).message ?? "Failed to save acceptance. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
}
