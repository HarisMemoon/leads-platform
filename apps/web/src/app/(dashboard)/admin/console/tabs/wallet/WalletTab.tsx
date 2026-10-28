"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  lookupAdminUserByEmail,
  postAdminWalletCredit,
  getAdminExtendedMetrics,
  getAdminMetricsBreakdown,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Stat } from "../../components/Stat";
import { Banner } from "../../components/Banner";

function fmtCents(v: string | number | undefined | null): string {
  const n = Number(v ?? 0);
  return `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WalletTab() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [amountDollars, setAmountDollars] = useState("50");
  const [desc, setDesc] = useState("Admin credit");

  const metrics = useQuery({
    queryKey: queryKeys.admin.metrics,
    queryFn: getAdminExtendedMetrics,
  });
  const breakdown = useQuery({
    queryKey: queryKeys.admin.metricsBreakdown,
    queryFn: getAdminMetricsBreakdown,
  });

  const lookup = useMutation({
    mutationFn: () => lookupAdminUserByEmail(email.trim()),
    onSuccess: (u) => {
      setResolvedUserId(u.id);
      setResolvedName(u.full_name || u.email);
      setLookupError(null);
    },
    onError: (e: Error) => {
      setResolvedUserId(null);
      setResolvedName(null);
      setLookupError(e.message);
    },
  });

  const credit = useMutation({
    mutationFn: () =>
      postAdminWalletCredit({
        user_id: resolvedUserId!,
        amount_cents: Math.round(parseFloat(amountDollars) * 100) || 0,
        description: desc,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metrics });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.me });
      setAmountDollars("");
      setDesc("");
    },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <SectionTitle
        title="Customer Wallets"
        sub="View wallet deposits and manually grant admin credits."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <Stat
          label="Lifetime Deposits"
          value={fmtCents(metrics.data?.totalWalletDepositsCents)}
          accent="linear-gradient(135deg, #38bdf8, #6366f1)"
        />
        <Stat
          label="Distinct Buyers"
          value={String(metrics.data?.distinctBuyers ?? "—")}
          accent="linear-gradient(135deg, #6366f1, #8b5cf6)"
        />
        <Stat
          label="Pending Refund Credits"
          value={
            breakdown.data
              ? fmtCents(breakdown.data.pendingRefundCreditsCents)
              : "—"
          }
          accent="linear-gradient(135deg, #f59e0b, #ef4444)"
        />
      </div>

      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "32px",
          maxWidth: 700,
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "Manrope, sans-serif",
          }}
        >
          Grant Admin Credit
        </h3>
        <p
          style={{
            margin: "0 0 24px",
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
          }}
        >
          Search by email to add promotional or reimbursement funds directly to
          a user's wallet.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                textTransform: "",
              }}
            >
              Customer Email
            </label>
            <input
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setResolvedUserId(null);
                setResolvedName(null);
                setLookupError(null);
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && email.trim() && lookup.mutate()
              }
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,0.1)")
              }
            />
          </div>
          <button
            disabled={lookup.isPending || !email.trim()}
            onClick={() => lookup.mutate()}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            {lookup.isPending ? "Searching..." : "Find"}
          </button>
        </div>

        {lookupError && <Banner tone="bad">{lookupError}</Banner>}

        {resolvedName && (
          <div
            style={{
              background: "rgba(52,211,153,0.05)",
              border: "1px solid rgba(52,211,153,0.2)",
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#34d399",
                  boxShadow: "0 0 10px #34d399",
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                  {resolvedName}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  User located and ready for credit.
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setResolvedUserId(null);
                setResolvedName(null);
                setEmail("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Clear
            </button>
          </div>
        )}

        {resolvedUserId && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: 24,
            }}
          >
            <div style={{ display: "flex", gap: 16 }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "",
                  }}
                >
                  Amount ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    padding: "12px 16px",
                    borderRadius: 10,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
              <div
                style={{
                  flex: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "",
                  }}
                >
                  Internal Note
                </label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Reason for credit"
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    padding: "12px 16px",
                    borderRadius: 10,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
            </div>
            <button
              disabled={credit.isPending || !Number(amountDollars)}
              onClick={() => credit.mutate()}
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                border: "none",
                color: "#fff",
                padding: "14px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                transition: "transform 0.2s",
                opacity: Number(amountDollars) > 0 ? 1 : 0.5,
              }}
            >
              {credit.isPending
                ? "Applying Credit..."
                : `Add $${amountDollars || "0"} to Wallet`}
            </button>
            {credit.isError && (
              <Banner tone="bad">{(credit.error as Error).message}</Banner>
            )}
            {credit.isSuccess && (
              <Banner tone="good">
                Successfully credited ${amountDollars} to {resolvedName}.
              </Banner>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
