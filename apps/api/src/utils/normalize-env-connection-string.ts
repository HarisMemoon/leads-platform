/**
 * PaaS dashboards sometimes save values with wrapping quotes; URL parsers then fail.
 */
export function normalizeEnvConnectionString(raw: string | undefined): string {
  if (raw == null) {
    return '';
  }
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}
