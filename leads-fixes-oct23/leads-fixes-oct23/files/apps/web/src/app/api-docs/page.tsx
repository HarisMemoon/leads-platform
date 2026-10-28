"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

const API_BASE = "https://lead-platform-api.onrender.com";

type FieldRow = {
  field: string;
  type: string;
  required?: boolean;
  desc: string;
  example?: string;
};

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 700px at 10% -10%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(16,185,129,0.12), transparent 55%), #080a0f",
    color: "#fff",
    fontFamily: "Inter, sans-serif",
  } as CSSProperties,
  container: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "48px 24px 96px",
  } as CSSProperties,
  card: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 24,
    marginBottom: 24,
  } as CSSProperties,
  h2: {
    fontFamily: "Manrope, sans-serif",
    fontSize: 22,
    margin: "0 0 6px",
  } as CSSProperties,
  h3: {
    fontFamily: "Manrope, sans-serif",
    fontSize: 15,
    margin: "20px 0 8px",
    color: "rgba(255,255,255,0.85)",
  } as CSSProperties,
  p: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13.5,
    lineHeight: 1.7,
    margin: "0 0 12px",
  } as CSSProperties,
  th: {
    padding: "10px 12px",
    fontSize: 11,
    textTransform: "" as const,
    letterSpacing: "0.04em",
    color: "rgba(255,255,255,0.45)",
    fontWeight: 500,
    textAlign: "left" as const,
  } as CSSProperties,
  td: {
    padding: "10px 12px",
    fontSize: 12.5,
    verticalAlign: "top" as const,
    borderTop: "1px solid rgba(255,255,255,0.05)",
  } as CSSProperties,
  code: {
    fontFamily: "DM Mono, monospace",
    color: "#a5b4fc",
    fontSize: 12,
  } as CSSProperties,
  methodBadge: {
    display: "inline-block",
    fontFamily: "DM Mono, monospace",
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 6,
    background: "rgba(16,185,129,0.15)",
    color: "#6ee7b7",
    border: "1px solid rgba(16,185,129,0.25)",
    marginRight: 10,
  } as CSSProperties,
};

function RequiredBadge({ required }: { required?: boolean }) {
  if (required) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 600,
          background: "rgba(245,158,11,0.18)",
          color: "#fcd34d",
        }}
      >
        required
      </span>
    );
  }
  return (
    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
      optional
    </span>
  );
}

function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <div
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
        marginBottom: 16,
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(0,0,0,0.25)" }}>
            <tr>
              <th style={styles.th}>Field</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Required</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Example</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.field}>
                <td style={{ ...styles.td, ...styles.code, color: "#a5b4fc" }}>
                  {r.field}
                </td>
                <td
                  style={{
                    ...styles.td,
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 11.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.type}
                </td>
                <td style={styles.td}>
                  <RequiredBadge required={r.required} />
                </td>
                <td style={{ ...styles.td, color: "rgba(255,255,255,0.65)" }}>
                  {r.desc}
                </td>
                <td
                  style={{
                    ...styles.td,
                    ...styles.code,
                    fontSize: 11,
                    color: "#6ee7b7",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.example ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const el = document.createElement("textarea");
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            textTransform: "",
            letterSpacing: "0.06em",
            color: "rgba(255,255,255,0.35)",
            fontWeight: 600,
          }}
        >
          {title ?? "Example"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: "4px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: copied ? "#6ee7b7" : "#fff",
            borderColor: copied ? "rgba(16,185,129,0.4)" : undefined,
            fontWeight: 500,
            fontSize: 11.5,
            cursor: "pointer",
          }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre
        style={{
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          padding: "14px 16px",
          fontSize: 11.5,
          color: "#e2e8f0",
          overflowX: "auto",
          lineHeight: 1.7,
          margin: 0,
          fontFamily: "DM Mono, monospace",
        }}
      >
        {code}
      </pre>
    </div>
  );
}

function Endpoint({
  method,
  path,
  authHeader,
}: {
  method: string;
  path: string;
  authHeader: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <span style={styles.methodBadge}>{method}</span>
      <code style={{ ...styles.code, fontSize: 13.5, color: "#fff" }}>
        {path}
      </code>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 11.5,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        Auth header:{" "}
        <code style={{ ...styles.code, color: "#fcd34d" }}>{authHeader}</code>
      </span>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      style={{
        color: "rgba(255,255,255,0.6)",
        textDecoration: "none",
        fontSize: 13,
        padding: "6px 12px",
        borderRadius: 8,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </a>
  );
}

// ── Field tables ────────────────────────────────────────────────────────────

const SINGLE_LEAD_FIELDS: FieldRow[] = [
  {
    field: "vendor_lead_id",
    type: "string",
    desc: "Your unique ID for this lead — used for idempotency (duplicate submissions are deduped). Auto-generated if omitted.",
    example: '"VL-10293"',
  },
  {
    field: "lead_type / leadType",
    type: "string",
    desc: 'Lead category — drives which pricing tier the lead is sold at (e.g. inherited, foreclosure, divorce, vacant_land). Defaults to "motivated_seller".',
    example: '"inherited"',
  },
  {
    field: "source",
    type: "string",
    desc: "Source label for this lead. If your vendor account restricts allowed sources, this must match one of them.",
    example: '"juiced"',
  },
  {
    field: "exclusivity_choice",
    type: '"exclusive" | "non_exclusive"',
    desc: 'Sell to a single buyer (exclusive, higher price) or up to 3 buyers (non_exclusive). Defaults to "non_exclusive".',
    example: '"non_exclusive"',
  },
  {
    field: "market",
    type: "string",
    desc: "Market label. If omitted, derived automatically from city + state, or zip.",
    example: '"Phoenix, AZ"',
  },
  {
    field: "city",
    type: "string",
    desc: "Property city.",
    example: '"Phoenix"',
  },
  {
    field: "state",
    type: "string",
    desc: "Property state (2-letter).",
    example: '"AZ"',
  },
  {
    field: "zip / Zip",
    type: "string",
    desc: "Property ZIP code.",
    example: '"85001"',
  },
  {
    field: "county",
    type: "string",
    desc: "Property county.",
    example: '"Maricopa"',
  },
  {
    field: "property_type / Propertytype / propertyType",
    type: "string",
    desc: "Type of property.",
    example: '"single_family"',
  },
  {
    field: "listed",
    type: 'string ("true" | "false")',
    desc: "Whether the property is currently listed on the MLS.",
    example: '"false"',
  },
  {
    field: "howsoontosell / timeline",
    type: "string",
    desc: "Seller's timeline to sell.",
    example: '"ASAP"',
  },
  {
    field: "reasonforselling / reason",
    type: "string",
    desc: "Why the seller wants to sell.",
    example: '"Inherited"',
  },
  {
    field: "property_condition / condition",
    type: "string",
    desc: "Condition of the property.",
    example: '"Fair"',
  },
  {
    field: "asking_price_cents",
    type: "integer",
    desc: "Seller's asking price, in cents.",
    example: "25000000",
  },
  {
    field: "motivation_tags",
    type: "string[]",
    desc: "Tags describing the seller's motivation.",
    example: '["inherited","vacant"]',
  },
  {
    field: "first_name / last_name",
    type: "string",
    desc: "Seller name (use this OR seller_name).",
    example: '"Sarah" / "Johnson"',
  },
  {
    field: "seller_name",
    type: "string",
    desc: "Full seller name (alternative to first_name + last_name).",
    example: '"Sarah Johnson"',
  },
  {
    field: "phone",
    type: "string",
    desc: "Seller phone number.",
    example: '"602-555-0101"',
  },
  {
    field: "email",
    type: "string",
    desc: "Seller email address.",
    example: '"sarah@example.com"',
  },
  {
    field: "address_1 / address_2",
    type: "string",
    desc: "Street address lines (use these OR address / fulladdress).",
    example: '"123 Main St"',
  },
  {
    field: "address / fulladdress",
    type: "string",
    desc: "Full address as a single string (alternative to address_1 / address_2).",
    example: '"123 Main St, Phoenix, AZ 85001"',
  },
  {
    field: "vendor",
    type: "string",
    desc: "Vendor / brand name sending the lead. Defaults to your account name if omitted.",
    example: '"Juiced"',
  },
  {
    field: "referrer",
    type: "string",
    desc: "UTM source or referring URL.",
    example: '"https://juiced.com/form"',
  },
  {
    field: "IP_Address",
    type: "string",
    desc: "Visitor's IP address at time of submission.",
    example: '"203.0.113.45"',
  },
  {
    field: "TrustedForm / xxTrustedFormCertUrl",
    type: "string",
    desc: "ActiveProspect TrustedForm certificate URL.",
    example: '"https://cert.trustedform.com/abc123"',
  },
  {
    field: "submitted_at",
    type: "string (ISO 8601)",
    desc: "When the seller submitted the originating form.",
    example: '"2026-06-12T14:30:00Z"',
  },
  {
    field: "quality_score",
    type: "integer (0–100)",
    desc: "Lead quality score. Defaults to 70.",
    example: "82",
  },
  {
    field: "notes",
    type: "string",
    desc: "Free-text notes.",
    example: '"Motivated, wants a quick close"',
  },
  {
    field: "metadata",
    type: "object",
    desc: "Any extra key/value data — merged into the lead's stored metadata.",
    example: '{"campaign":"spring-2026"}',
  },
];

const PING_FIELDS: FieldRow[] = [
  {
    field: "vendor_ping_id",
    type: "string",
    desc: "Your unique ID for this ping. Auto-generated if omitted.",
    example: '"VP-10293"',
  },
  {
    field: "lead_type / leadType",
    type: "string",
    desc: 'Lead category. Defaults to "motivated_seller".',
    example: '"inherited"',
  },
  {
    field: "source",
    type: "string",
    desc: "Source label — must be in your vendor account's allowed sources, if configured.",
    example: '"juiced"',
  },
  {
    field: "exclusivity_choice",
    type: '"exclusive" | "non_exclusive"',
    desc: 'Buyer-matching mode for this ping. Defaults to "exclusive".',
    example: '"exclusive"',
  },
  {
    field: "market / city / state / zip / county",
    type: "string",
    desc: "Location fields — same meaning as the Single Lead endpoint.",
    example: '"Phoenix" / "AZ" / "85001"',
  },
  {
    field: "property_type (+ aliases)",
    type: "string",
    desc: "Property type.",
    example: '"single_family"',
  },
  {
    field: "asking_price_cents",
    type: "integer",
    desc: "Seller's asking price, in cents.",
    example: "25000000",
  },
  {
    field: "motivation_tags",
    type: "string[]",
    desc: "Tags describing seller motivation.",
    example: '["inherited"]',
  },
  {
    field: "first_name / last_name / phone / email",
    type: "string",
    desc: "Seller identity — used for duplicate-lead detection.",
    example: '"Sarah" / "Johnson" / "602-555-0101"',
  },
  {
    field: "address_1 / address_2 / fulladdress",
    type: "string",
    desc: "Address — used for duplicate-lead detection.",
    example: '"123 Main St"',
  },
  {
    field: "TrustedForm / xxTrustedFormCertUrl",
    type: "string",
    desc: "ActiveProspect TrustedForm certificate URL.",
    example: '"https://cert.trustedform.com/abc123"',
  },
  {
    field: "metadata",
    type: "object",
    desc: "Extra data, stored with the ping and carried over to the lead on post.",
    example: "{}",
  },
];

const POST_FIELDS: FieldRow[] = [
  {
    field: "ping_id",
    type: "string (UUID)",
    required: true,
    desc: "The ping_id returned by /vendor/ping.",
    example: '"b2b9e4f1-58cc-..."',
  },
  {
    field: "vendor_lead_id",
    type: "string",
    required: true,
    desc: "Your unique ID for this lead — used for idempotency.",
    example: '"VL-10293"',
  },
  {
    field: "seller_name",
    type: "string",
    desc: "Full seller name (alternative to first_name + last_name).",
    example: '"Sarah Johnson"',
  },
  {
    field: "first_name / last_name",
    type: "string",
    desc: "Seller name.",
    example: '"Sarah" / "Johnson"',
  },
  {
    field: "phone",
    type: "string",
    desc: "Seller phone number.",
    example: '"602-555-0101"',
  },
  {
    field: "email",
    type: "string",
    desc: "Seller email address.",
    example: '"sarah@example.com"',
  },
  {
    field: "address / address_1 / address_2 / fulladdress",
    type: "string",
    desc: "Property address.",
    example: '"123 Main St, Phoenix, AZ 85001"',
  },
  {
    field: "city / state / zip / Zip",
    type: "string",
    desc: "Overrides the location captured at ping time, if provided.",
    example: '"Phoenix" / "AZ" / "85001"',
  },
  {
    field: "property_type / Propertytype",
    type: "string",
    desc: "Property type — overrides the ping value, if provided.",
    example: '"single_family"',
  },
  {
    field: "listed / howsoontosell / reasonforselling / property_condition",
    type: "string",
    desc: "Same meaning as the Single Lead endpoint.",
    example: '"false" / "ASAP" / "Inherited" / "Fair"',
  },
  {
    field: "vendor / referrer / IP_Address / TrustedForm",
    type: "string",
    desc: "Attribution & compliance fields.",
    example: '"Juiced" / "https://..." ',
  },
  {
    field: "notes",
    type: "string",
    desc: "Free-text notes.",
    example: '"Motivated seller"',
  },
  {
    field: "quality_score",
    type: "integer (0–100)",
    desc: "Lead quality score. Defaults to 70.",
    example: "82",
  },
  {
    field: "metadata",
    type: "object",
    desc: "Extra data, merged into the lead's metadata.",
    example: "{}",
  },
];

const INBOUND_FIELDS: FieldRow[] = [
  {
    field: "market",
    type: "string",
    required: true,
    desc: "Market label shown in the marketplace.",
    example: '"Phoenix, AZ"',
  },
  {
    field: "lead_type",
    type: "string",
    required: true,
    desc: "Lead category.",
    example: '"inherited"',
  },
  {
    field: "title",
    type: "string",
    desc: "Lead title shown in the marketplace.",
    example: '"Sarah Johnson — Inherited Property"',
  },
  {
    field: "price_cents",
    type: "integer",
    desc: "Legacy single price field, in cents.",
    example: "4500",
  },
  {
    field: "exclusive_price_cents",
    type: "integer",
    desc: "Exclusive price override, in cents.",
    example: "4500",
  },
  {
    field: "shared_price_cents",
    type: "integer",
    desc: "Non-exclusive (shared) per-buyer price override, in cents.",
    example: "1800",
  },
  {
    field: "quality_score",
    type: "integer (0–100)",
    desc: "Lead quality score. Defaults to 70.",
    example: "82",
  },
  {
    field: "source_label",
    type: "string",
    desc: 'Source label, e.g. "website", "facebook", "google".',
    example: '"website"',
  },
  {
    field: "metadata",
    type: "object",
    desc: "Arbitrary extra data, stored with the lead.",
    example: '{"contact_phone":"602-555-0101"}',
  },
];

// ── Example payloads ────────────────────────────────────────────────────────

const SINGLE_LEAD_CURL = `curl -X POST ${API_BASE}/vendor/lead \\
  -H "Content-Type: application/json" \\
  -H "X-Vendor-API-Key: YOUR_API_KEY" \\
  -d '{
    "vendor_lead_id": "VL-10293",
    "lead_type": "inherited",
    "exclusivity_choice": "non_exclusive",
    "city": "Phoenix",
    "state": "AZ",
    "zip": "85001",
    "property_type": "single_family",
    "timeline": "ASAP",
    "reason": "Inherited",
    "condition": "Fair",
    "asking_price_cents": 25000000,
    "first_name": "Sarah",
    "last_name": "Johnson",
    "phone": "602-555-0101",
    "email": "sarah@example.com",
    "address_1": "123 Main St",
    "vendor": "Juiced",
    "TrustedForm": "https://cert.trustedform.com/abc123",
    "submitted_at": "2026-06-12T14:30:00Z",
    "quality_score": 82,
    "notes": "Motivated, wants a quick close"
  }'`;

const SINGLE_LEAD_RESPONSE = `{
  "accepted": true,
  "lead_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "vendor_lead_id": "VL-10293",
  "market": "Phoenix, AZ",
  "lead_type": "inherited",
  "status": "available",
  "exclusivity_level": "shared",
  "exclusive_price_cents": "4500",
  "shared_price_cents": "1800"
}`;

const SINGLE_LEAD_DUPLICATE_RESPONSE = `{
  "accepted": false,
  "status": "rejected",
  "error": "duplicate_lead",
  "duplicate_lead_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}`;

const PING_CURL = `curl -X POST ${API_BASE}/vendor/ping \\
  -H "Content-Type: application/json" \\
  -H "X-Vendor-API-Key: YOUR_API_KEY" \\
  -d '{
    "lead_type": "inherited",
    "exclusivity_choice": "exclusive",
    "city": "Phoenix",
    "state": "AZ",
    "zip": "85001",
    "property_type": "single_family",
    "asking_price_cents": 25000000,
    "first_name": "Sarah",
    "last_name": "Johnson",
    "phone": "602-555-0101"
  }'`;

const PING_RESPONSE = `{
  "accepted": true,
  "status": "accepted",
  "ping_id": "b2b9e4f1-58cc-4372-a567-0e02b2c3d479",
  "vendor_ping_id": "3f29b1c4-...",
  "price_cents": "4500",
  "matched_buyer_id": "9c1f2a3b-...",
  "expires_at": "2026-06-12T15:00:00Z",
  "rejection_reason": null,
  "latency_ms": 42
}`;

const POST_CURL = `curl -X POST ${API_BASE}/vendor/post \\
  -H "Content-Type: application/json" \\
  -H "X-Vendor-API-Key: YOUR_API_KEY" \\
  -d '{
    "ping_id": "b2b9e4f1-58cc-4372-a567-0e02b2c3d479",
    "vendor_lead_id": "VL-10293",
    "seller_name": "Sarah Johnson",
    "phone": "602-555-0101",
    "email": "sarah@example.com",
    "address": "123 Main St, Phoenix, AZ 85001"
  }'`;

const POST_RESPONSE = `{
  "accepted": true,
  "post_id": "8d3a4b5c-...",
  "lead_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "assignment_id": "9e4b6d7e-...",
  "buyer_id": "9c1f2a3b-...",
  "price_cents": "4500",
  "status": "accepted"
}`;

const INBOUND_CURL = `curl -X POST ${API_BASE}/inbound/lead \\
  -H "Content-Type: application/json" \\
  -H "X-Vendor-API-Key: YOUR_API_KEY" \\
  -d '{
    "market": "Phoenix, AZ",
    "lead_type": "inherited",
    "title": "Sarah Johnson — Inherited Property",
    "quality_score": 82,
    "source_label": "website",
    "metadata": {
      "contact_phone": "602-555-0101",
      "contact_email": "sarah@example.com"
    }
  }'`;

const INBOUND_RESPONSE = `{
  "success": true,
  "lead_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "market": "Phoenix, AZ",
  "lead_type": "inherited",
  "status": "available"
}`;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "",
              color: "rgba(165,180,252,0.9)",
              fontWeight: 700,
            }}
          >
            Newleey Platform
          </p>
          <h1
            style={{
              margin: "10px 0 10px",
              fontSize: "clamp(28px, 4vw, 42px)",
              lineHeight: 1.12,
              letterSpacing: -1,
              fontFamily: "Manrope, sans-serif",
              fontWeight: 800,
            }}
          >
            Vendor API Reference
          </h1>
          <p style={{ ...styles.p, maxWidth: 700, fontSize: 15 }}>
            Three ways to send leads into the Newleey marketplace — pick the one
            that fits your integration. All endpoints accept JSON.
          </p>
        </div>

        {/* Quick nav */}
        <div
          style={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            marginBottom: 24,
            padding: "8px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <NavLink href="#authentication">Authentication</NavLink>
          <NavLink href="#single-lead">1. Single Lead</NavLink>
          <NavLink href="#ping-post">2. Ping → Post</NavLink>
          <NavLink href="#inbound">3. Inbound Webhook</NavLink>
        </div>

        {/* Overview */}
        <div style={styles.card}>
          <h2 style={styles.h2}>How a lead can reach Newleey</h2>
          <p style={styles.p}>
            Choose whichever integration matches your platform's capabilities.
            All three create a lead that becomes available in the buyer
            marketplace — none of them charge a buyer's wallet directly.
          </p>
          <FieldTable
            rows={[
              {
                field: "POST /vendor/lead",
                type: "single call",
                desc: "Recommended. Send the full lead in one request — richest field set, Juiced-compatible.",
                example: "~1 request",
              },
              {
                field: "POST /vendor/ping → POST /vendor/post",
                type: "two-step",
                desc: "Ping first to check price/availability against buyer demand, then post the full lead if accepted. Useful for real-time bidding integrations.",
                example: "~2 requests",
              },
              {
                field: "POST /inbound/lead (or /inbound/leads)",
                type: "simple webhook",
                desc: "Legacy/simple form — just market + lead_type plus optional pricing. Good for website forms or spreadsheet automations.",
                example: "~1 request",
              },
            ]}
          />
        </div>

        {/* Authentication */}
        <div id="authentication" style={styles.card}>
          <h2 style={styles.h2}>Authentication</h2>
          <p style={styles.p}>
            Every vendor account has a single API key, issued by an admin in{" "}
            <strong style={{ color: "rgba(255,255,255,0.8)" }}>
              Admin Console → Lead Vendors
            </strong>
            . The same key works for every endpoint below — only the{" "}
            <strong style={{ color: "rgba(255,255,255,0.8)" }}>
              header name
            </strong>{" "}
            changes depending on which family of endpoints you're calling.
          </p>
          <FieldTable
            rows={[
              {
                field: "X-Vendor-API-Key",
                type: "header",
                desc: "Used for ALL vendor endpoints: /vendor/ping, /vendor/post, /vendor/lead, /inbound/lead, and /inbound/leads. (Legacy X-Vendor-Key is still accepted on the /inbound endpoints only.)",
                example: "YOUR_API_KEY",
              },
            ]}
          />
          <p style={{ ...styles.p, marginBottom: 0 }}>
            If a request is missing its API key header or the key is invalid /
            disabled, the endpoint returns{" "}
            <code style={styles.code}>401 Unauthorized</code>.
          </p>
        </div>

        {/* 1. Single Lead */}
        <div id="single-lead" style={styles.card}>
          <h2 style={styles.h2}>1. Single Lead — Recommended</h2>
          <p style={styles.p}>
            Send everything in one call. Internally this validates the lead like
            a ping (duplicate check, market matching), then creates the lead
            directly in the marketplace with status{" "}
            <code style={styles.code}>available</code>, runs auto-distribution
            to matching buyers, and fires outbound pings to other platforms
            (e.g. Juiced). No wallet charge happens at this step — buyers
            purchase the lead from the marketplace normally.
          </p>
          <Endpoint
            method="POST"
            path="/vendor/lead"
            authHeader="X-Vendor-API-Key"
          />
          <h3 style={styles.h3}>Fields</h3>
          <FieldTable rows={SINGLE_LEAD_FIELDS} />
          <h3 style={styles.h3}>Example request</h3>
          <CodeBlock title="cURL" code={SINGLE_LEAD_CURL} />
          <h3 style={styles.h3}>Example response — accepted</h3>
          <CodeBlock title="JSON" code={SINGLE_LEAD_RESPONSE} />
          <h3 style={styles.h3}>Example response — duplicate</h3>
          <CodeBlock title="JSON" code={SINGLE_LEAD_DUPLICATE_RESPONSE} />
        </div>

        {/* 2. Ping -> Post */}
        <div id="ping-post" style={styles.card}>
          <h2 style={styles.h2}>2. Ping → Post — Two-Step</h2>
          <p style={styles.p}>
            Ping first with the lead's location, type, and seller-matching
            fields. The platform checks it against buyer demand and returns a
            matched price and a short-lived{" "}
            <code style={styles.code}>ping_id</code>. If accepted, post the full
            lead within the TTL window to create it and immediately assign it to
            the matched buyer (this step{" "}
            <strong style={{ color: "rgba(255,255,255,0.8)" }}>does</strong>{" "}
            charge the buyer's wallet). All fields accept the same aliases
            listed in the Single Lead table above (e.g.{" "}
            <code style={styles.code}>propertyType</code>,{" "}
            <code style={styles.code}>timeline</code>,{" "}
            <code style={styles.code}>reason</code>,{" "}
            <code style={styles.code}>condition</code>,{" "}
            <code style={styles.code}>xxTrustedFormCertUrl</code>).
          </p>

          <h3 style={styles.h3}>Step 1 — Ping</h3>
          <Endpoint
            method="POST"
            path="/vendor/ping"
            authHeader="X-Vendor-API-Key"
          />
          <FieldTable rows={PING_FIELDS} />
          <CodeBlock title="cURL" code={PING_CURL} />
          <CodeBlock title="JSON response — accepted" code={PING_RESPONSE} />

          <h3 style={styles.h3}>Step 2 — Post</h3>
          <Endpoint
            method="POST"
            path="/vendor/post"
            authHeader="X-Vendor-API-Key"
          />
          <FieldTable rows={POST_FIELDS} />
          <CodeBlock title="cURL" code={POST_CURL} />
          <CodeBlock title="JSON response — accepted" code={POST_RESPONSE} />
        </div>

        {/* 3. Inbound webhook */}
        <div id="inbound" style={styles.card}>
          <h2 style={styles.h2}>3. Inbound Webhook — Simple</h2>
          <p style={styles.p}>
            The simplest path — just a market and lead type, plus optional
            pricing and metadata. The lead is created directly with status{" "}
            <code style={styles.code}>available</code>, then auto-distribution
            and outbound pings run the same as the Single Lead endpoint. A batch
            variant is available at{" "}
            <code style={styles.code}>POST /inbound/leads</code>, which accepts{" "}
            <code style={styles.code}>{`{ "leads": [ ... ] }`}</code> — an array
            of the same object shape, processed independently.
          </p>
          <Endpoint
            method="POST"
            path="/inbound/lead"
            authHeader="X-Vendor-API-Key"
          />
          <h3 style={styles.h3}>Fields</h3>
          <FieldTable rows={INBOUND_FIELDS} />
          <h3 style={styles.h3}>Example request</h3>
          <CodeBlock title="cURL" code={INBOUND_CURL} />
          <h3 style={styles.h3}>Example response</h3>
          <CodeBlock title="JSON" code={INBOUND_RESPONSE} />
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.35)",
            fontSize: 12.5,
          }}
        >
          Need an API key or have questions about your integration? Contact your
          Newleey account manager.{" "}
          <Link href="/" style={{ color: "rgba(165,180,252,0.9)" }}>
            ← Back to Newleey
          </Link>
        </div>
      </div>
    </main>
  );
}
