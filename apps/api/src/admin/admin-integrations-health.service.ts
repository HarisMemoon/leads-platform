import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export type IntegrationHealthRow = {
  name: string;
  status: 'ok' | 'warn' | 'down' | 'unconfigured';
  note: string;
  last_checked_at: string;
  latency_ms: number | null;
};

const CACHE_TTL_MS = 60 * 1000;
const PROBE_TIMEOUT_MS = 5_000;

@Injectable()
export class AdminIntegrationsHealthService {
  private readonly logger = new Logger(AdminIntegrationsHealthService.name);
  private cache: { ts: number; rows: IntegrationHealthRow[] } | null = null;

  constructor(private readonly config: ConfigService) {}

  async getHealth(): Promise<IntegrationHealthRow[]> {
    if (this.cache && Date.now() - this.cache.ts < CACHE_TTL_MS) {
      return this.cache.rows;
    }
    const rows = await Promise.all([
      this.probeStripe(),
      this.probePostmark(),
      this.probeTwilio(),
      this.probeGhl(),
      this.probeS3(),
    ]);
    this.cache = { ts: Date.now(), rows };
    return rows;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private unconfigured(name: string, note: string): IntegrationHealthRow {
    return {
      name,
      status: 'unconfigured',
      note,
      last_checked_at: this.now(),
      latency_ms: null,
    };
  }

  private async probeStripe(): Promise<IntegrationHealthRow> {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) return this.unconfigured('Stripe', 'STRIPE_SECRET_KEY not set');
    const stripe = new Stripe(key);
    const start = Date.now();
    try {
      await this.withTimeout(stripe.balance.retrieve(), PROBE_TIMEOUT_MS);
      const latency = Date.now() - start;
      return {
        name: 'Stripe',
        status: 'ok',
        note: `Balance API reachable · ${latency}ms`,
        last_checked_at: this.now(),
        latency_ms: latency,
      };
    } catch (e) {
      const latency = Date.now() - start;
      return {
        name: 'Stripe',
        status: 'down',
        note: `Balance probe failed: ${this.errMsg(e)}`,
        last_checked_at: this.now(),
        latency_ms: latency,
      };
    }
  }

  private async probePostmark(): Promise<IntegrationHealthRow> {
    const token = this.config.get<string>('POSTMARK_SERVER_TOKEN');
    if (!token)
      return this.unconfigured('Postmark', 'POSTMARK_SERVER_TOKEN not set');
    const start = Date.now();
    try {
      const res = await this.fetchWithTimeout(
        'https://api.postmarkapp.com/server',
        {
          headers: {
            Accept: 'application/json',
            'X-Postmark-Server-Token': token,
          },
        },
        PROBE_TIMEOUT_MS,
      );
      const latency = Date.now() - start;
      if (!res.ok) {
        return {
          name: 'Postmark',
          status: 'warn',
          note: `HTTP ${res.status} from /server`,
          last_checked_at: this.now(),
          latency_ms: latency,
        };
      }
      return {
        name: 'Postmark',
        status: 'ok',
        note: `Server token OK · ${latency}ms`,
        last_checked_at: this.now(),
        latency_ms: latency,
      };
    } catch (e) {
      return {
        name: 'Postmark',
        status: 'down',
        note: `Probe failed: ${this.errMsg(e)}`,
        last_checked_at: this.now(),
        latency_ms: Date.now() - start,
      };
    }
  }

  private async probeTwilio(): Promise<IntegrationHealthRow> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (!sid || !token)
      return this.unconfigured(
        'Twilio SMS',
        'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set',
      );
    const start = Date.now();
    try {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const res = await this.fetchWithTimeout(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
        { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } },
        PROBE_TIMEOUT_MS,
      );
      const latency = Date.now() - start;
      if (!res.ok) {
        return {
          name: 'Twilio SMS',
          status: 'warn',
          note: `HTTP ${res.status} from accounts`,
          last_checked_at: this.now(),
          latency_ms: latency,
        };
      }
      return {
        name: 'Twilio SMS',
        status: 'ok',
        note: `Account reachable · ${latency}ms`,
        last_checked_at: this.now(),
        latency_ms: latency,
      };
    } catch (e) {
      return {
        name: 'Twilio SMS',
        status: 'down',
        note: `Probe failed: ${this.errMsg(e)}`,
        last_checked_at: this.now(),
        latency_ms: Date.now() - start,
      };
    }
  }

  private async probeGhl(): Promise<IntegrationHealthRow> {
    const key = this.config.get<string>('GHL_API_KEY');
    const url =
      this.config.get<string>('GHL_HEALTH_URL') ??
      'https://services.leadconnectorhq.com/locations/me';
    if (!key) return this.unconfigured('GoHighLevel', 'GHL_API_KEY not set');
    const start = Date.now();
    try {
      const res = await this.fetchWithTimeout(
        url,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
            Version: '2021-07-28',
          },
        },
        PROBE_TIMEOUT_MS,
      );
      const latency = Date.now() - start;
      if (!res.ok) {
        return {
          name: 'GoHighLevel',
          status: 'warn',
          note: `HTTP ${res.status} from ${url}`,
          last_checked_at: this.now(),
          latency_ms: latency,
        };
      }
      return {
        name: 'GoHighLevel',
        status: 'ok',
        note: `Locations API reachable · ${latency}ms`,
        last_checked_at: this.now(),
        latency_ms: latency,
      };
    } catch (e) {
      return {
        name: 'GoHighLevel',
        status: 'down',
        note: `Probe failed: ${this.errMsg(e)}`,
        last_checked_at: this.now(),
        latency_ms: Date.now() - start,
      };
    }
  }

  private async probeS3(): Promise<IntegrationHealthRow> {
    const bucket = this.config.get<string>('S3_INGEST_BUCKET');
    if (!bucket)
      return this.unconfigured('S3 ingest bucket', 'S3_INGEST_BUCKET not set');
    return {
      name: 'S3 ingest bucket',
      status: 'ok',
      note: `Configured · bucket=${bucket} (no live probe wired)`,
      last_checked_at: this.now(),
      latency_ms: null,
    };
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        },
      );
    });
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    ms: number,
  ): Promise<Response> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private errMsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    return 'unknown error';
  }
}
