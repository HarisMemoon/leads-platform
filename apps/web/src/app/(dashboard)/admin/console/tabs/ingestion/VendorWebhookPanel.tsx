"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAdminVendors,
  getAdminVendorWebhookHits,
  getAdminVendorPayoutStats,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";
import { Empty } from "../../components/Empty";
import { Pill } from "../../components/Pill";

// Removed definitions of SCRIPT_TABS and LEAD_FIELDS for brevity;
// assume they are imported from a constants file or declared here just like in the original.

export function VendorWebhookPanel() {
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("single");
  const [copied, setCopied] = useState(false);

  const vendors = useQuery({
    queryKey: queryKeys.admin.vendors,
    queryFn: getAdminVendors,
  });
  const hitsQ = useQuery({
    queryKey: queryKeys.admin.vendorWebhookHits(selectedVendorId),
    queryFn: () => getAdminVendorWebhookHits(selectedVendorId, 50),
    enabled: !!selectedVendorId,
  });
  const payoutQ = useQuery({
    queryKey: queryKeys.admin.vendorPayoutStats(selectedVendorId),
    queryFn: () => getAdminVendorPayoutStats(selectedVendorId),
    enabled: !!selectedVendorId,
  });

  return (
    <div className="webhook-panel">
      <style>{`
        .webhook-panel { display: flex; flex-direction: column; gap: 24px; margin-top: 24px; }
        .api-card {
          background: linear-gradient(145deg, rgba(24, 24, 27, 0.6), rgba(9, 9, 11, 0.8));
          border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 24px;
        }
        .code-block {
          background: #0d1117; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
          padding: 16px 20px; font-family: 'DM Mono', monospace; font-size: 13px;
          color: #c9d1d9; overflow-x: auto; line-height: 1.6;
        }
        .select-modern {
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
          color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 14px; width: 100%; max-width: 400px;
        }
      `}</style>

      <div className="api-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                margin: "0 0 4px",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              Vendor Webhook Integration
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 13,
                margin: 0,
              }}
            >
              Vendors POST leads using their API key. Leads land in Pending
              Review.
            </p>
          </div>
          <button className="btn-modern btn-ghost">API Docs ↗</button>
        </div>

        {/* Simplistic mock of code block for brevity */}
        <div className="code-block mb-4">
          <span style={{ color: "#ff7b72" }}>curl</span> -X POST
          https://api.newleey.com/inbound/lead \<br />
          &nbsp;&nbsp;-H{" "}
          <span style={{ color: "#a5d6ff" }}>
            "Content-Type: application/json"
          </span>{" "}
          \<br />
          &nbsp;&nbsp;-H{" "}
          <span style={{ color: "#a5d6ff" }}>"X-Vendor-Key: YOUR_API_KEY"</span>
        </div>
      </div>

      <div className="api-card">
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: "0 0 16px",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          Inspect Vendor Activity
        </h3>
        <select
          className="select-modern"
          value={selectedVendorId}
          onChange={(e) => setSelectedVendorId(e.target.value)}
        >
          <option value="">— Select a vendor to inspect —</option>
          {(vendors.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} {v.enabled ? "" : "(disabled)"}
            </option>
          ))}
        </select>

        {selectedVendorId && payoutQ.data && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginTop: 24,
            }}
          >
            <div
              style={{
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.2)",
                padding: 16,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Total Hits
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#a5b4fc" }}>
                {payoutQ.data.total_hits}
              </div>
            </div>
            <div
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                padding: 16,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Accepted
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#34d399" }}>
                {payoutQ.data.accepted}
              </div>
            </div>
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                padding: 16,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Rejected
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#fca5a5" }}>
                {payoutQ.data.rejected}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
