"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminLeadDuplicateGroups,
  getAdminResolvedDuplicateGroups,
  postAdminLeadMarkDuplicate,
  type AdminLeadDuplicateGroup,
} from "@/lib/admin-api";
import { queryKeys } from "@/lib/query-keys";

import { SectionTitle } from "../../components/SectionTitle";
import { Stat } from "../../components/Stat";
import { Pill } from "../../components/Pill";
import { Empty } from "../../components/Empty";
import { Banner } from "../../components/Banner";

// --- Sub-component: Resolved Modal ---
const PAGE_SIZE = 10;

function ResolvedDuplicatesModal({ onClose }: { onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [take, setTake] = useState(PAGE_SIZE);

  const resolved = useQuery({
    queryKey: ["admin", "duplicate-groups", "resolved", take, dateFrom, dateTo],
    queryFn: () =>
      getAdminResolvedDuplicateGroups({
        limit: take,
        offset: 0,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const hasMore = (resolved.data?.length ?? 0) >= take;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        .modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 24px; animation: fadeIn 0.2s ease-out; }
        .modal-box { background: linear-gradient(180deg, #12141c 0%, #0a0c10 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; width: 100%; max-width: 640px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 32px 120px rgba(0,0,0,0.8); }
        .modal-head { padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; }
        .modal-body { padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .input-modern { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 13px; outline: none; color-scheme: dark; }
        .input-modern:focus { border-color: #6366f1; }
        .btn-modern { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-ghost { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1); }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); }
      `}</style>
      <div className="modal-box">
        <div className="modal-head">
          <div>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                margin: 0,
                fontFamily: "Manrope, sans-serif",
              }}
            >
              Resolved Duplicates
            </h3>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                marginTop: 4,
              }}
            >
              {resolved.data
                ? `${resolved.data.length} groups loaded`
                : "Loading..."}
            </div>
          </div>
          <button className="btn-modern btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Archived between
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setTake(PAGE_SIZE);
            }}
            className="input-modern"
          />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            and
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setTake(PAGE_SIZE);
            }}
            className="input-modern"
          />
        </div>
        <div className="modal-body">
          {resolved.isLoading && <Empty title="Loading resolved groups..." />}
          {resolved.data && resolved.data.length === 0 && (
            <Empty
              title="No resolved groups"
              body="Archived duplicates will appear here."
            />
          )}
          {(resolved.data ?? []).map((g) => (
            <div
              key={g.canonical_id}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {g.canonical_title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 4,
                    }}
                  >
                    {g.phone}
                  </div>
                </div>
                <Pill tone="good">{g.duplicate_count} archived</Pill>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(g.duplicates ?? []).map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      background: "rgba(0,0,0,0.2)",
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>
                      {d.title}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.3)" }}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              className="btn-modern btn-ghost"
              style={{ alignSelf: "center" }}
              onClick={() => setTake((t) => t + PAGE_SIZE)}
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-component: Group Card ---
function DuplicateGroupCard({
  group,
  onMergeMany,
  merging,
  selectedLeadIds,
  onToggle,
  onSelectGroup,
  onClearGroup,
}: any) {
  const leads = group.leads ?? [];
  const [canonicalId, setCanonicalId] = useState(leads[0]?.id ?? "");

  const resolvable = leads.filter(
    (l: any) => l.id !== canonicalId && !l.is_duplicate,
  );
  const allSelected =
    resolvable.length > 0 &&
    resolvable.every((l: any) => selectedLeadIds.has(l.id));

  return (
    <>
      <div
        style={{
          background:
            "linear-gradient(145deg, rgba(24,24,27,0.6), rgba(9,9,11,0.8))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "Manrope, sans-serif",
              }}
            >
              {group.phone || "(no phone)"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                marginTop: 4,
              }}
            >
              {leads.length} leads share this number ·{" "}
              <strong style={{ color: "#fcd34d" }}>
                {resolvable.length} to resolve
              </strong>
            </div>
          </div>

          {resolvable.length > 1 && (
            <button
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
              }}
              onClick={() =>
                allSelected
                  ? onClearGroup(resolvable.map((l: any) => l.id))
                  : onSelectGroup(
                      resolvable.map((l: any) => ({ id: l.id, canonicalId })),
                    )
              }
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {leads.map((lead: any) => {
            const isCanonical = lead.id === canonicalId;
            const isDupe = lead.is_duplicate;
            const isSelected = selectedLeadIds.has(lead.id);

            return (
              <div
                key={lead.id}
                onClick={() =>
                  !isCanonical && !isDupe && onToggle(lead.id, canonicalId)
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr auto auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: isCanonical
                    ? "1px solid rgba(52,211,153,0.4)"
                    : isSelected
                      ? "1px solid rgba(99,102,241,0.5)"
                      : "1px solid rgba(255,255,255,0.05)",
                  background: isCanonical
                    ? "rgba(52,211,153,0.05)"
                    : isSelected
                      ? "rgba(99,102,241,0.1)"
                      : "rgba(0,0,0,0.2)",
                  cursor: !isCanonical && !isDupe ? "pointer" : "default",
                  transition: "all 0.2s",
                }}
              >
                {isDupe || isCanonical ? (
                  <span />
                ) : (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{
                      accentColor: "#6366f1",
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                )}

                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isDupe ? "rgba(255,255,255,0.3)" : "#fff",
                    }}
                  >
                    {lead.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 4,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background:
                          lead.status === "available" ? "#34d399" : "#64748b",
                        marginRight: 6,
                      }}
                    />
                    {lead.status} ·{" "}
                    {new Date(lead.created_at).toLocaleDateString()}
                  </div>
                </div>

                {isCanonical ? (
                  <Pill tone="good">Canonical</Pill>
                ) : isDupe ? (
                  <Pill tone="default">Archived</Pill>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCanonicalId(lead.id);
                      onClearGroup([lead.id]);
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#fff",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Set Canonical
                  </button>
                )}

                {!isCanonical && !isDupe && (
                  <button
                    disabled={merging}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMergeMany([lead.id], canonicalId);
                    }}
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#fca5a5",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Archive
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// --- Main Tab ---
export default function DuplicatesTab() {
  const qc = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);
  const [globalSelected, setGlobalSelected] = useState<Map<string, string>>(
    new Map(),
  );

  const groups = useQuery({
    queryKey: queryKeys.admin.duplicateGroups,
    queryFn: getAdminLeadDuplicateGroups,
  });

  const merge = useMutation({
    mutationFn: (args: { duplicateLeadId: string; canonicalLeadId: string }) =>
      postAdminLeadMarkDuplicate(args.duplicateLeadId, args.canonicalLeadId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.duplicateGroups });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.metricsBreakdown });
    },
  });

  async function handleMergeMany(duplicateIds: string[], canonicalId: string) {
    await Promise.all(
      duplicateIds.map((id) =>
        merge.mutateAsync({
          duplicateLeadId: id,
          canonicalLeadId: canonicalId,
        }),
      ),
    );
  }

  async function handleMergeGlobalSelected() {
    const entries = Array.from(globalSelected.entries());
    if (entries.length === 0) return;
    await Promise.all(
      entries.map(([dupId, canId]) =>
        merge.mutateAsync({ duplicateLeadId: dupId, canonicalLeadId: canId }),
      ),
    );
    setGlobalSelected(new Map());
  }

  const allResolvable = useMemo(() => {
    const items: Array<{ id: string; canonicalId: string }> = [];
    for (const g of groups.data ?? []) {
      const leads = g.leads ?? [];
      const canonicalId =
        leads.find((l) => !l.is_duplicate)?.id ?? leads[0]?.id ?? "";
      for (const l of leads) {
        if (!l.is_duplicate && l.id !== canonicalId)
          items.push({ id: l.id, canonicalId });
      }
    }
    return items;
  }, [groups.data]);

  const totalGroups = groups.data?.length ?? 0;
  const totalToResolve = allResolvable.length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      {showResolved && (
        <ResolvedDuplicatesModal onClose={() => setShowResolved(false)} />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <SectionTitle
          title="Duplicates Resolution"
          sub="Merge leads with identical phone numbers to protect your buyers."
        />
        <button
          onClick={() => setShowResolved(true)}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          View Resolved History
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
        }}
      >
        <Stat
          label="Phone Clusters"
          value={String(totalGroups)}
          accent="linear-gradient(135deg, #f59e0b, #ef4444)"
        />
        <Stat
          label="Leads to Resolve"
          value={String(totalToResolve)}
          accent="linear-gradient(135deg, #6366f1, #8b5cf6)"
        />
      </div>

      {globalSelected.size > 0 && (
        <div
          style={{
            position: "sticky",
            top: 24,
            zIndex: 40,
            background: "rgba(99,102,241,0.15)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 16,
            padding: "12px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#818cf8",
                boxShadow: "0 0 10px #818cf8",
              }}
            />
            <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
              {globalSelected.size} leads selected
            </span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setGlobalSelected(new Map())}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              disabled={merge.isPending}
              onClick={handleMergeGlobalSelected}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                color: "#fff",
                padding: "8px 20px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {merge.isPending ? "Archiving..." : "Archive Selected"}
            </button>
          </div>
        </div>
      )}

      {merge.isError && (
        <Banner tone="bad">{(merge.error as Error).message}</Banner>
      )}
      {groups.isLoading && (
        <Empty title="Scanning inventory for duplicates..." />
      )}
      {groups.data && groups.data.length === 0 && (
        <Empty
          title="No duplicates found"
          body="All leads have unique phone numbers. Clusters will appear here automatically."
        />
      )}

      {groups.data && groups.data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.data.map((g) => {
            const groupLeadIds = new Set((g.leads ?? []).map((l) => l.id));
            const selectedInGroup = new Set(
              Array.from(globalSelected.keys()).filter((id) =>
                groupLeadIds.has(id),
              ),
            );
            return (
              <DuplicateGroupCard
                key={g.phone}
                group={g}
                merging={merge.isPending}
                onMergeMany={handleMergeMany}
                selectedLeadIds={selectedInGroup}
                onToggle={(id: string, canId: string) =>
                  setGlobalSelected((prev) => {
                    const n = new Map(prev);
                    n.has(id) ? n.delete(id) : n.set(id, canId);
                    return n;
                  })
                }
                onSelectGroup={(items: any[]) =>
                  setGlobalSelected((prev) => {
                    const n = new Map(prev);
                    items.forEach((i) => n.set(i.id, i.canonicalId));
                    return n;
                  })
                }
                onClearGroup={(ids: string[]) =>
                  setGlobalSelected((prev) => {
                    const n = new Map(prev);
                    ids.forEach((id) => n.delete(id));
                    return n;
                  })
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
