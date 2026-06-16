const SENSITIVE_KEYS = new Set([
  'name',
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'mobile',
  'address',
  'street',
]);

export function redactLeadMetadata(meta: Record<string, unknown> | null | undefined) {
  if (!meta || typeof meta !== 'object') return {};
  const out: Record<string, unknown> = { ...meta };
  for (const key of Object.keys(out)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '••••••';
    }
  }
  return out;
}
