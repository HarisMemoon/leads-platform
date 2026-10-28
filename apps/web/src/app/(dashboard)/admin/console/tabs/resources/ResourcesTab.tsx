"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminResourceItems,
  postAdminResourceItem,
  patchAdminResourceItem,
  deleteAdminResourceItem,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Stat } from "../../components/Stat";
import { Banner } from "../../components/Banner";
import { Empty } from "../../components/Empty";
import { Pill } from "../../components/Pill";

export default function ResourcesTab() {
  const qc = useQueryClient();
  const items = useQuery({
    queryKey: queryKeys.admin.resourceItems,
    queryFn: getAdminResourceItems,
  });

  const [kind, setKind] = useState("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [sort, setSort] = useState("0");

  const create = useMutation({
    mutationFn: () =>
      postAdminResourceItem({
        kind,
        title: title.trim(),
        url: url.trim() || null,
        body: body.trim() || null,
        sort_order: Number(sort) || 0,
        is_published: true,
      }),
    onSuccess: () => {
      setTitle("");
      setUrl("");
      setBody("");
      setSort("0");
      void qc.invalidateQueries({ queryKey: queryKeys.admin.resourceItems });
    },
  });

  const patch = useMutation({
    mutationFn: (args: { id: string; body: { is_published?: boolean } }) =>
      patchAdminResourceItem(args.id, args.body),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.admin.resourceItems }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAdminResourceItem(id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: queryKeys.admin.resourceItems }),
  });

  const list = items.data ?? [];
  const lastUpdated = list[0]
    ? new Date(list[0].updated_at).toLocaleDateString()
    : "—";

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
        title="Buyer Resources"
        sub="Manage external links, guides, and dashboard announcements."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        <Stat
          label="Published Items"
          value={String(list.filter((i) => i.is_published).length)}
          accent="linear-gradient(135deg, #10b981, #34d399)"
        />
        <Stat
          label="Drafts"
          value={String(list.filter((i) => !i.is_published).length)}
          accent="linear-gradient(135deg, #64748b, #94a3b8)"
        />
        <Stat label="Last Updated" value={lastUpdated} />
      </div>

      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <h3
          style={{
            margin: "0 0 20px",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "Manrope, sans-serif",
          }}
        >
          Add Resource
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            alignItems: "end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                textTransform: "",
              }}
            >
              Type
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
              }}
            >
              <option value="link">External Link</option>
              <option value="video">Video Embed</option>
              <option value="faq">FAQ Entry</option>
              <option value="promo">Announcement</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                textTransform: "",
              }}
            >
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                textTransform: "",
              }}
            >
              URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                textTransform: "",
              }}
            >
              Sort Weight
            </label>
            <input
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              gridColumn: "1 / -2",
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
              Body text (Optional)
            </label>
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
          <button
            disabled={create.isPending || !title.trim()}
            onClick={() => create.mutate()}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              height: "42px",
              opacity: !title.trim() ? 0.5 : 1,
            }}
          >
            {create.isPending ? "Publishing..." : "Publish"}
          </button>
        </div>
        {create.isError && (
          <div style={{ marginTop: 16 }}>
            <Banner tone="bad">{(create.error as Error).message}</Banner>
          </div>
        )}
      </div>

      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {items.isLoading && <Empty title="Loading resources..." />}
        {items.data && items.data.length === 0 && (
          <Empty title="No resources published yet" />
        )}
        {items.data && items.data.length > 0 && (
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
                textTransform: "",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <tr>
                <th style={{ padding: "12px 24px" }}>Type</th>
                <th style={{ padding: "12px 24px" }}>Title / Link</th>
                <th style={{ padding: "12px 24px" }}>Status</th>
                <th style={{ padding: "12px 24px" }}>Sort</th>
                <th style={{ padding: "12px 24px", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.data.map((it) => (
                <tr
                  key={it.id}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <td style={{ padding: "16px 24px" }}>
                    <Pill>{it.kind}</Pill>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {it.title}
                    </div>
                    {it.url && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.4)",
                          marginTop: 4,
                        }}
                      >
                        {it.url}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <button
                      disabled={patch.isPending}
                      onClick={() =>
                        patch.mutate({
                          id: it.id,
                          body: { is_published: !it.is_published },
                        })
                      }
                      style={{
                        background: it.is_published
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(255,255,255,0.05)",
                        border: `1px solid ${it.is_published ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
                        color: it.is_published ? "#34d399" : "#fff",
                        padding: "4px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {it.is_published ? "Live" : "Draft"}
                    </button>
                  </td>
                  <td
                    style={{
                      padding: "16px 24px",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {it.sort_order}
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right" }}>
                    <button
                      disabled={del.isPending}
                      onClick={() => {
                        if (confirm("Delete this resource?")) del.mutate(it.id);
                      }}
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#fca5a5",
                        padding: "6px 14px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
