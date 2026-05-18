export type PlanFeatureBullet = { text: string; visible: boolean };

/** Normalize DB jsonb (legacy string[] or bullet objects) into bullet rows. */
export function normalizeRawFeatureBullets(raw: unknown): PlanFeatureBullet[] {
  if (!Array.isArray(raw)) return [];
  const out: PlanFeatureBullet[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t.length > 0) out.push({ text: t, visible: true });
    } else if (item && typeof item === 'object' && 'text' in item) {
      const t = String((item as { text: unknown }).text).trim();
      const visible = (item as { visible?: boolean }).visible !== false;
      if (t.length > 0) out.push({ text: t, visible });
    }
  }
  return out;
}

/** Texts shown on marketing / checkout cards (visible only). */
export function visibleFeatureBulletTexts(raw: unknown): string[] {
  return normalizeRawFeatureBullets(raw)
    .filter((b) => b.visible)
    .map((b) => b.text);
}
