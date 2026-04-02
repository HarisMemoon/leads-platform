import * as dns from 'node:dns';
import type { TlsOptions } from 'tls';
import { normalizeEnvConnectionString } from '../utils/normalize-env-connection-string';
import { typeormTlsForPostgres } from './postgres-ssl';

/**
 * Render and similar hosts often lack IPv6 egress. Supabase DNS can return only AAAA;
 * `dns.setDefaultResultOrder('ipv4first')` is not enough when no A record exists.
 *
 * TypeORM + node-pg sometimes apply `ssl` inconsistently when both `url` and `ssl` are set,
 * so when we resolve an IPv4 we pass host/port/user/pass/database explicitly (no connection string).
 */
export type PostgresUrlOrExplicit =
  | { kind: 'url'; url: string }
  | {
      kind: 'ipv4';
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
      ssl: TlsOptions;
    };

async function firstIpv4Address(hostname: string): Promise<string | null> {
  const fromA = await dns.promises.resolve4(hostname).catch(() => [] as string[]);
  if (fromA.length > 0) {
    return fromA[0];
  }
  try {
    const { address } = await dns.promises.lookup(hostname, { family: 4 });
    return address || null;
  } catch {
    return null;
  }
}

function parsePostgresUrl(databaseUrl: string): {
  hostForTls: string;
  port: number;
  username: string;
  password: string;
  database: string;
} {
  const u = new URL(databaseUrl);
  const port = u.port ? parseInt(u.port, 10) : 5432;
  const rawPath = u.pathname.replace(/^\//, '');
  const database = rawPath ? decodeURIComponent(rawPath) : '';
  return {
    hostForTls: u.hostname,
    port,
    username: u.username,
    password: u.password,
    database,
  };
}

export async function resolvePostgresUrlForIpv4Egress(
  rawUrl: string | undefined,
): Promise<PostgresUrlOrExplicit> {
  const databaseUrl = normalizeEnvConnectionString(rawUrl);
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }

  const { hostForTls, port, username, password, database } =
    parsePostgresUrl(databaseUrl);

  if (
    !hostForTls ||
    hostForTls === 'localhost' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostForTls) ||
    hostForTls.includes(':')
  ) {
    return { kind: 'url', url: databaseUrl };
  }

  const ipv4 = await firstIpv4Address(hostForTls);
  if (!ipv4 || ipv4 === hostForTls) {
    console.warn(
      `[postgres] Could not resolve IPv4 for ${hostForTls}. If the app fails with ENETUNREACH to IPv6, ` +
        `use Supabase "Session pooler" or "Transaction" pooler URI (Dashboard → Connect), which usually expose IPv4.`,
    );
    return { kind: 'url', url: databaseUrl };
  }

  return {
    kind: 'ipv4',
    host: ipv4,
    port,
    username,
    password,
    database,
    ssl: typeormTlsForPostgres(hostForTls),
  };
}
