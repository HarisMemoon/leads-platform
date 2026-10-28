"use client";

import { useQuery } from "@tanstack/react-query";
import { getPublishedResourceItems } from "@/lib/resources-api";
import { queryKeys } from "@/lib/query-keys";

export default function ResourcesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.resources.items,
    queryFn: getPublishedResourceItems,
  });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px 80px", color: "#fff", fontFamily: "DM Sans, sans-serif" }}>
      <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 28, marginBottom: 8 }}>Resources</h1>
      <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 28, fontSize: 14 }}>
        Guides, videos, and FAQs managed by your team. Need something added? Ask an admin.
      </p>
      {isLoading && <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p>}
      {isError && <p style={{ color: "#fca5a5" }}>Could not load resources.</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {(data ?? []).map((item) => (
          <li
            key={item.id}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "16px 18px",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
              {item.kind}
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{item.title}</div>
            {item.body ? (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", whiteSpace: "pre-wrap", margin: 0 }}>{item.body}</p>
            ) : null}
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "#a5b4fc", fontSize: 14 }}>
                Open link →
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      {!isLoading && (data?.length ?? 0) === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No published resources yet.</p>
      ) : null}
    </div>
  );
}
