import type { TlsOptions } from 'tls';

/**
 * Supabase pooler / some PaaS Postgres chains fail Node's default TLS verification
 * ("self-signed certificate in certificate chain"). Default is lenient; set
 * DATABASE_SSL_REJECT_UNAUTHORIZED=true to enforce full verification (may break pooler).
 */
export function typeormTlsForPostgres(hostForTls?: string): TlsOptions {
  const strict = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
  return {
    rejectUnauthorized: strict,
    ...(hostForTls ? { servername: hostForTls } : {}),
  } as TlsOptions;
}

/** True when the URI expects TLS — avoid forcing ssl on plain local docker Postgres. */
export function isPostgresUrlUsingTls(databaseUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(databaseUrl);
  } catch {
    return false;
  }
  const mode = u.searchParams.get('sslmode');
  return (
    mode === 'require' ||
    mode === 'verify-full' ||
    mode === 'verify-ca' ||
    u.port === '6543' ||
    u.hostname.includes('supabase.co')
  );
}
