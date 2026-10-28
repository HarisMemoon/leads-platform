"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminRefundRequests,
  lookupAdminUserByEmail,
  patchAdminUserDistributionLock,
  getAdminUsers,
  patchAdminUserActive,
  postAdminPauseDelivery,
  postAdminResumeDelivery,
  postAdminAssignLead,
  postAdminWalletCredit,
  type AdminUserRow,
  type AdminRefundRequestRow,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Banner } from "../../components/Banner";
import { Empty } from "../../components/Empty";
import { Pill } from "../../components/Pill";

const USERS_PAGE_SIZE = 10;

function fmtCents(v: string | number | undefined | null): string {
  const n = Number(v ?? 0);
  return `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Sub-component: User Detail Modal ---
function UserDetailModal({
  user,
  onClose,
  onToggleActive,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onToggleActive: (u: AdminUserRow) => void;
}) {
  const qc = useQueryClient();
  const [assignLeadId, setAssignLeadId] = useState("");
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: () => patchAdminUserActive(user.id, !user.is_active),
    onSuccess: (updated) =>
      onToggleActive({ ...user, is_active: updated.is_active }),
  });

  const pauseDelivery = useMutation({
    mutationFn: () => postAdminPauseDelivery(user.id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const resumeDelivery = useMutation({
    mutationFn: () => postAdminResumeDelivery(user.id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const assignLead = useMutation({
    mutationFn: () => postAdminAssignLead(assignLeadId.trim(), user.id),
    onSuccess: () => {
      setAssignMsg("✓ Lead assigned");
      setAssignLeadId("");
    },
    onError: (e: Error) => setAssignMsg(e.message),
  });

  const deliveryDisabled =
    user.account_status === "distribution_paused" ||
    user.account_status === "auto_delivery_off";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #12141c 0%, #0a0c10 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          width: "100%",
          maxWidth: 860,
          overflow: "hidden",
          boxShadow: "0 32px 120px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#818cf8",
                marginBottom: 8,
              }}
            >
              Customer Details
            </div>
            <h2
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 24,
                fontWeight: 700,
                margin: "0 0 8px",
              }}
            >
              {user.full_name || user.email}
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Pill tone={user.is_active ? "good" : "bad"}>
                {user.is_active ? "Active" : "Disabled"}
              </Pill>
              <Pill tone={user.role === "admin" ? "info" : "default"}>
                {user.role}
              </Pill>
              {user.account_status && (
                <Pill tone="warn">
                  {user.account_status.replace(/_/g, " ")}
                </Pill>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: 32,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Overview
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Email
                  </span>
                  <span style={{ fontSize: 13 }}>{user.email}</span>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Company
                  </span>
                  <span style={{ fontSize: 13 }}>
                    {user.company_name || "—"}
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Phone
                  </span>
                  <span style={{ fontSize: 13 }}>{user.phone || "—"}</span>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Joined
                  </span>
                  <span style={{ fontSize: 13 }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Assign Lead Manually
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    outline: "none",
                  }}
                  placeholder="Paste Lead ID"
                  value={assignLeadId}
                  onChange={(e) => {
                    setAssignLeadId(e.target.value);
                    setAssignMsg(null);
                  }}
                />
                <button
                  disabled={assignLead.isPending || !assignLeadId.trim()}
                  onClick={() => assignLead.mutate()}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {assignLead.isPending ? "..." : "Assign"}
                </button>
              </div>
              {assignMsg && (
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 8,
                    color: assignLead.isError ? "#f87171" : "#34d399",
                  }}
                >
                  {assignMsg}
                </div>
              )}
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  marginTop: 8,
                }}
              >
                Admin override. Does not charge the wallet.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                background: deliveryDisabled
                  ? "rgba(239,68,68,0.05)"
                  : "rgba(16,185,129,0.05)",
                border: deliveryDisabled
                  ? "1px solid rgba(239,68,68,0.2)"
                  : "1px solid rgba(16,185,129,0.2)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Auto Delivery Status
              </h3>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: deliveryDisabled ? "#fca5a5" : "#6ee7b7",
                  marginBottom: 16,
                }}
              >
                {user.account_status ?? "—"}
              </div>
              {!deliveryDisabled ? (
                <button
                  disabled={pauseDelivery.isPending}
                  onClick={() => pauseDelivery.mutate()}
                  style={{
                    width: "100%",
                    background: "rgba(239,68,68,0.15)",
                    color: "#fca5a5",
                    border: "1px solid rgba(239,68,68,0.3)",
                    padding: "10px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Pause Delivery
                </button>
              ) : (
                <button
                  disabled={resumeDelivery.isPending}
                  onClick={() => resumeDelivery.mutate()}
                  style={{
                    width: "100%",
                    background: "rgba(16,185,129,0.15)",
                    color: "#6ee7b7",
                    border: "1px solid rgba(16,185,129,0.3)",
                    padding: "10px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Resume Delivery
                </button>
              )}
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Account Access
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                Use this to block the customer from signing in. This does not
                delete data or remove assignments.
              </p>
              <button
                disabled={toggle.isPending}
                onClick={() => toggle.mutate()}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: user.is_active
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(16,185,129,0.15)",
                  color: user.is_active ? "#fca5a5" : "#6ee7b7",
                  border: `1px solid ${user.is_active ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                }}
              >
                {toggle.isPending
                  ? "..."
                  : user.is_active
                    ? "Disable Login"
                    : "Enable Login"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Tab ---
export default function CustomersTab() {
  const qc = useQueryClient();
  const refunds = useQuery({
    queryKey: queryKeys.admin.refundRequests,
    queryFn: getAdminRefundRequests,
  });

  const [lockEmail, setLockEmail] = useState("");
  const [lockResolved, setLockResolved] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  const users = useQuery({
    queryKey: ["admin", "users", offset, dateFrom, dateTo],
    queryFn: () =>
      getAdminUsers({
        limit: USERS_PAGE_SIZE,
        offset,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const lockLookup = useMutation({
    mutationFn: () => lookupAdminUserByEmail(lockEmail.trim()),
    onSuccess: (u) => {
      setLockResolved({ id: u.id, name: u.full_name || u.email });
      setLockError(null);
    },
    onError: (e: Error) => {
      setLockResolved(null);
      setLockError(e.message);
    },
  });

  const distLock = useMutation({
    mutationFn: (locked: boolean) =>
      patchAdminUserDistributionLock(lockResolved!.id, { locked }),
  });

  // Calculate Refund Abuse
  const buyerGroups = useMemo(() => {
    const map = new Map<
      string,
      { email: string; requests: AdminRefundRequestRow[] }
    >();
    for (const r of refunds.data ?? []) {
      if (!map.has(r.buyer.id))
        map.set(r.buyer.id, { email: r.buyer.email, requests: [] });
      map.get(r.buyer.id)!.requests.push(r);
    }
    return [...map.entries()]
      .map(([id, { email, requests }]) => {
        const total = requests.length;
        const approved = requests.filter(
          (r) => r.status === "approved" || r.status === "credited",
        ).length;
        const denied = requests.filter((r) => r.status === "rejected").length;
        const pending = requests.filter((r) => r.status === "pending").length;
        const abuseReview = requests.filter(
          (r) => r.status === "abuse_review",
        ).length;
        const flagged = total >= 3 && approved / Math.max(total, 1) >= 0.25;
        return {
          id,
          email,
          total,
          approved,
          denied,
          pending,
          abuseReview,
          flagged,
          requests,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [refunds.data]);

  const flaggedBuyers = buyerGroups.filter(
    (b) => b.flagged || b.abuseReview > 0,
  );

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
        title="Customers & Abuse Tracking"
        sub="Manage accounts, distribution locks, and monitor refund abuse."
      />

      {/* Distribution Lock */}
      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 800,
        }}
      >
        <h3
          style={{
            margin: "0 0 4px",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "Manrope, sans-serif",
          }}
        >
          Distribution Lock
        </h3>
        <p
          style={{
            margin: "0 0 20px",
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
          }}
        >
          Prevent a buyer from changing their auto-distribution rules. They can
          still browse manually.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: lockResolved || lockError ? 16 : 0,
          }}
        >
          <input
            type="email"
            placeholder="Search customer by email..."
            value={lockEmail}
            onChange={(e) => {
              setLockEmail(e.target.value);
              setLockResolved(null);
              setLockError(null);
            }}
            onKeyDown={(e) =>
              e.key === "Enter" && lockEmail.trim() && lockLookup.mutate()
            }
            style={{
              flex: 1,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            disabled={lockLookup.isPending || !lockEmail.trim()}
            onClick={() => lockLookup.mutate()}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {lockLookup.isPending ? "Searching..." : "Find"}
          </button>
        </div>

        {lockError && <Banner tone="bad">{lockError}</Banner>}
        {lockResolved && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {lockResolved.name}
              </span>
              {distLock.isSuccess && (
                <Pill tone="info">
                  {distLock.data?.distribution_locked ? "Locked" : "Unlocked"}
                </Pill>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={distLock.isPending}
                onClick={() => distLock.mutate(true)}
                style={{
                  background: "rgba(245,158,11,0.15)",
                  color: "#fcd34d",
                  border: "1px solid rgba(245,158,11,0.3)",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Lock
              </button>
              <button
                disabled={distLock.isPending}
                onClick={() => distLock.mutate(false)}
                style={{
                  background: "rgba(16,185,129,0.15)",
                  color: "#6ee7b7",
                  border: "1px solid rgba(16,185,129,0.3)",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Unlock
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Flagged Customers */}
      {flaggedBuyers.length > 0 && (
        <div
          style={{
            background:
              "linear-gradient(145deg, rgba(239,68,68,0.05), rgba(0,0,0,0.4))",
            border: "1px solid rgba(239,68,68,0.2)",
            borderLeft: "4px solid #ef4444",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 24px",
              background: "rgba(239,68,68,0.1)",
              borderBottom: "1px solid rgba(239,68,68,0.15)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                background: "#ef4444",
                color: "#fff",
                borderRadius: 20,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {flaggedBuyers.length}
            </span>
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontWeight: 700,
                fontSize: 16,
                color: "#fca5a5",
              }}
            >
              Customers flagged for refund abuse
            </span>
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {flaggedBuyers.map((b) => (
              <div
                key={b.id}
                style={{
                  padding: "16px 24px",
                  background: "rgba(0,0,0,0.2)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{b.email}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 4,
                    }}
                  >
                    {b.total} requests ·{" "}
                    <span style={{ color: "#34d399" }}>
                      {b.approved} approved
                    </span>{" "}
                    ·{" "}
                    <span style={{ color: "#f87171" }}>{b.denied} denied</span>
                  </div>
                </div>
                {b.abuseReview > 0 && (
                  <Pill tone="bad">Abuse Review Active</Pill>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Registered Users{" "}
            <span
              style={{
                fontWeight: 400,
                color: "rgba(255,255,255,0.4)",
                marginLeft: 8,
              }}
            >
              ({users.data?.total ?? 0})
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - USERS_PAGE_SIZE))}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Prev
            </button>
            <button
              disabled={offset + USERS_PAGE_SIZE >= (users.data?.total ?? 0)}
              onClick={() => setOffset((o) => o + USERS_PAGE_SIZE)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>

        {users.isLoading && <Empty title="Loading users..." />}
        {users.data && users.data.users.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead
              style={{
                background: "rgba(0,0,0,0.2)",
                fontSize: 11,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <tr>
                <th style={{ padding: "12px 24px" }}>User</th>
                <th style={{ padding: "12px 24px" }}>Role</th>
                <th style={{ padding: "12px 24px" }}>Status</th>
                <th style={{ padding: "12px 24px" }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.data.users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.02)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {u.full_name || "—"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.4)",
                        marginTop: 2,
                      }}
                    >
                      {u.email}
                    </div>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <Pill tone={u.role === "admin" ? "info" : "default"}>
                      {u.role}
                    </Pill>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <Pill tone={u.is_active ? "good" : "bad"}>
                      {u.is_active ? "Active" : "Disabled"}
                    </Pill>
                  </td>
                  <td
                    style={{
                      padding: "16px 24px",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleActive={(u) => {
            setSelectedUser(u);
            void qc.invalidateQueries({ queryKey: ["admin", "users"] });
          }}
        />
      )}
    </div>
  );
}
