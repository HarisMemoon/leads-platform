import * as dns from 'node:dns';
import type { TlsOptions } from 'tls';
import { normalizeEnvConnectionString } from '../utils/normalize-env-connection-string';

/**
 * Render and similar hosts often lack IPv6 egress. Supabase (Postgres) DNS can return only AAAA;
 * `dns.setDefaultResultOrder('ipv4first')` is not enough when no A record exists.
 * Resolve an IPv4 address and keep TLS SNI so hosted Postgres SSL still validates.
 */
export async function resolvePostgresUrlForIpv4Egress(
  rawUrl: string | undefined,
): Promise<{ url: string; ssl?: TlsOptions | boolean }> {
  const databaseUrl = normalizeEnvConnectionString(rawUrl);
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  let u: URL;
  try {
    u = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }

  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }

  const hostForTls = u.hostname;
  if (
    !hostForTls ||
    hostForTls === 'localhost' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostForTls) ||
    hostForTls.includes(':')
  ) {
    return { url: databaseUrl };
  }

  try {
    const { address } = await dns.promises.lookup(hostForTls, { family: 4 });
    if (!address || address === hostForTls) {
      return { url: databaseUrl };
    }
    u.hostname = address;
    return {
      url: u.toString(),
      ssl: {
        rejectUnauthorized: true,
        servername: hostForTls,
      } as TlsOptions,
    };
  } catch {
    return { url: databaseUrl };
  }
}
