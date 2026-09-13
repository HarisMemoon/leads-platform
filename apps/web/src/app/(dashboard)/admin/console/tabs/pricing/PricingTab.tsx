"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDistributionEngineSettings,
  getAdminLeadPricing,
  patchDistributionEngineSettings,
  patchAdminLeadPricing,
  type AdminLeadPricingConfigDto,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Banner } from "../../components/Banner";
import { Empty } from "../../components/Empty";

type LeadPricingBody = Partial<{
  new_lead_price_cents: number;
  shared_price_cents: number | null;
  discount_after_days: number;
  discount_amount_cents: number;
  min_price_floor_cents: number | null;
}>;

function PriceInput({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
}: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.6)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </label>
      <div
        style={{ position: "relative", display: "flex", alignItems: "center" }}
      >
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: 14,
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
            }}
          >
            {prefix}
          </span>
        )}
        <input
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            paddingLeft: prefix ? 32 : 14,
            paddingRight: suffix ? 50 : 14,
            transition: "border-color 0.2s",
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: 14,
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PricingTab() {
  const qc = useQueryClient();
  const engine = useQuery({
    queryKey: queryKeys.admin.engine,
    queryFn: getDistributionEngineSettings,
  });
  const pricing = useQuery({
    queryKey: queryKeys.admin.leadPricing,
    queryFn: getAdminLeadPricing,
  });

  const patchEarlyAccess = useMutation({
    mutationFn: (body: Partial<{ early_access_minutes: number }>) =>
      patchDistributionEngineSettings(body),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.admin.engine }),
  });

  const onLeadPricingSaved = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.admin.leadPricing });
  };

  const patchInbound = useMutation({
    mutationFn: (body: LeadPricingBody) =>
      patchAdminLeadPricing("inbound", body),
    onSuccess: onLeadPricingSaved,
  });
  const patchOutbound = useMutation({
    mutationFn: (body: LeadPricingBody) =>
      patchAdminLeadPricing("outbound", body),
    onSuccess: onLeadPricingSaved,
  });

  const e = engine.data;
  const [earlyAccess, setEarlyAccess] = useState("");
  const [pricingState, setPricingState] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!e) return;
    setEarlyAccess(String(e.early_access_minutes));
  }, [e?.updated_at]);

  useEffect(() => {
    if (!pricing.data) return;
    setPricingState(
      pricing.data.reduce((acc, row) => {
        acc[row.lead_type] = {
          exclusivePrice: String(
            Math.round(Number(row.new_lead_price_cents) / 100),
          ),
          sharedPrice:
            row.shared_price_cents != null
              ? String(Math.round(Number(row.shared_price_cents) / 100))
              : "",
          discountDays: String(row.discount_after_days),
          discountAmount: String(
            Math.round(Number(row.discount_amount_cents) / 100),
          ),
          floorPrice:
            row.min_price_floor_cents != null
              ? String(Math.round(Number(row.min_price_floor_cents) / 100))
              : "",
        };
        return acc;
      }, {} as any),
    );
  }, [pricing.data]);

  function setTypeField(type: string, field: string, value: string) {
    setPricingState((prev) => ({
      ...prev,
      [type]: { ...(prev[type] ?? {}), [field]: value },
    }));
  }

  function handleSaveType(type: string) {
    const row = pricingState[type];
    if (!row) return;
    const body: LeadPricingBody = {
      new_lead_price_cents: Math.round(
        (parseFloat(row.exclusivePrice) || 0) * 100,
      ),
      shared_price_cents: row.sharedPrice.trim()
        ? Math.round((parseFloat(row.sharedPrice) || 0) * 100)
        : null,
      discount_after_days: Number(row.discountDays) || 0,
      discount_amount_cents: Math.round(
        (parseFloat(row.discountAmount) || 0) * 100,
      ),
      min_price_floor_cents: row.floorPrice.trim()
        ? Math.round((parseFloat(row.floorPrice) || 0) * 100)
        : null,
    };
    if (type === "inbound") patchInbound.mutate(body);
    else patchOutbound.mutate(body);
  }

  const pricingRows = useMemo(() => {
    const rows = pricing.data ?? [];
    return ["inbound", "outbound"]
      .map((type) => rows.find((row) => row.lead_type === type))
      .filter(Boolean) as AdminLeadPricingConfigDto[];
  }, [pricing.data]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <SectionTitle
          title="Global Pricing"
          sub="Set base prices, decay rules, and Pro early access."
        />
        {(e || pricing.data?.length) && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Last synced {new Date().toLocaleTimeString()}
          </span>
        )}
      </div>

      {(engine.isLoading || pricing.isLoading) && (
        <Empty title="Loading pricing configurations..." />
      )}

      {e && (
        <div
          style={{
            background:
              "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "24px 32px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 24,
            }}
          >
            <div style={{ maxWidth: 500 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "#818cf8",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Pro Early Access
              </div>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: 24,
                  fontWeight: 800,
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                Hide fresh leads from free users
              </h3>
              <p
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                New leads stay exclusive to Pro subscribers for a set window
                before hitting the general marketplace.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                minWidth: 260,
              }}
            >
              <PriceInput
                label="Early Access Window"
                value={earlyAccess}
                onChange={setEarlyAccess}
                placeholder="e.g. 15"
                suffix="Minutes"
              />
              <button
                disabled={patchEarlyAccess.isPending}
                onClick={() =>
                  patchEarlyAccess.mutate({
                    early_access_minutes:
                      Number(earlyAccess) || e.early_access_minutes,
                  })
                }
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "none",
                  color: "#fff",
                  padding: "12px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {patchEarlyAccess.isPending ? "Saving..." : "Save Window"}
              </button>
              {patchEarlyAccess.isSuccess && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#34d399",
                    textAlign: "center",
                  }}
                >
                  ✓ Saved successfully
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: 24,
        }}
      >
        {pricingRows.map((row) => {
          const typeState = pricingState[row.lead_type] ?? {
            exclusivePrice: "",
            sharedPrice: "",
            discountDays: "",
            discountAmount: "",
            floorPrice: "",
          };
          const isOutbound = row.lead_type === "outbound";
          const accent = isOutbound ? "#f59e0b" : "#38bdf8";
          const mut = isOutbound ? patchOutbound : patchInbound;

          return (
            <div
              key={row.id}
              style={{
                background:
                  "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "24px 32px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 24,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: accent,
                      marginBottom: 6,
                    }}
                  >
                    {row.lead_type} Pricing
                  </div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 20,
                      fontWeight: 800,
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    Base & Decay Rules
                  </h3>
                </div>
                <div
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    padding: "12px 16px",
                    borderRadius: 12,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 4,
                    }}
                  >
                    Current Base
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: accent,
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    ${typeState.exclusivePrice || "0"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <PriceInput
                  label="Exclusive Price"
                  value={typeState.exclusivePrice}
                  onChange={(v: string) =>
                    setTypeField(row.lead_type, "exclusivePrice", v)
                  }
                  prefix="$"
                />
                <PriceInput
                  label="Shared Price"
                  value={typeState.sharedPrice}
                  onChange={(v: string) =>
                    setTypeField(row.lead_type, "sharedPrice", v)
                  }
                  prefix="$"
                />
                <PriceInput
                  label="Discount After"
                  value={typeState.discountDays}
                  onChange={(v: string) =>
                    setTypeField(row.lead_type, "discountDays", v)
                  }
                  suffix="Days"
                />
                <PriceInput
                  label="Discount Amount"
                  value={typeState.discountAmount}
                  onChange={(v: string) =>
                    setTypeField(row.lead_type, "discountAmount", v)
                  }
                  prefix="-$"
                />
                <PriceInput
                  label="Price Floor"
                  value={typeState.floorPrice}
                  onChange={(v: string) =>
                    setTypeField(row.lead_type, "floorPrice", v)
                  }
                  prefix="$"
                />
              </div>

              <div
                style={{
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 20,
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div>
                  {mut.isSuccess && (
                    <span
                      style={{
                        fontSize: 13,
                        color: "#34d399",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Configuration Saved
                    </span>
                  )}
                  {mut.isError && (
                    <span
                      style={{
                        fontSize: 13,
                        color: "#f87171",
                        fontWeight: 600,
                      }}
                    >
                      {(mut.error as Error).message}
                    </span>
                  )}
                </div>
                <button
                  disabled={mut.isPending}
                  onClick={() => handleSaveType(row.lead_type)}
                  style={{
                    background: isOutbound
                      ? "linear-gradient(135deg, #f59e0b, #ea580c)"
                      : "linear-gradient(135deg, #38bdf8, #2563eb)",
                    border: "none",
                    color: "#fff",
                    padding: "10px 24px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: `0 4px 20px ${isOutbound ? "rgba(245,158,11,0.2)" : "rgba(56,189,248,0.2)"}`,
                  }}
                >
                  {mut.isPending ? "Saving..." : `Save ${row.lead_type} config`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
