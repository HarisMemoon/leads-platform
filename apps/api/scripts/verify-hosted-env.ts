/**
 * Validates DATABASE_URL, REDIS_URL, JWT_SECRET, STRIPE_SECRET_KEY, and STRIPE_WEBHOOK_SECRET before deploy.
 * Run from apps/api: npm run verify:hosted-env
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { STRIPE_WEBHOOK_EVENT_TYPES } from '../src/stripe/stripe-webhook-events';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function main(): void {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const redisUrl = process.env.REDIS_URL?.trim();

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Copy from Neon or Supabase into apps/api/.env');
    process.exit(1);
  }

  let pg: URL;
  try {
    pg = new URL(databaseUrl);
  } catch {
    console.error('DATABASE_URL is not a valid URL');
    process.exit(1);
  }

  if (pg.protocol !== 'postgres:' && pg.protocol !== 'postgresql:') {
    console.error('DATABASE_URL must use postgres:// or postgresql://');
    process.exit(1);
  }

  if (!redisUrl) {
    console.error('REDIS_URL is not set. For Upstash, paste the rediss:// URL into apps/api/.env');
    process.exit(1);
  }

  let redis: URL;
  try {
    redis = new URL(redisUrl);
  } catch {
    console.error('REDIS_URL is not a valid URL');
    process.exit(1);
  }

  if (redis.protocol !== 'redis:' && redis.protocol !== 'rediss:') {
    console.error('REDIS_URL must use redis:// or rediss://');
    process.exit(1);
  }

  if (redis.protocol === 'rediss:') {
    console.log('REDIS_URL uses TLS (rediss://) — suitable for Upstash / hosted Redis.');
  } else {
    console.warn(
      'REDIS_URL uses redis:// (no TLS). For Upstash in production, use the rediss:// URL from the dashboard.',
    );
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    console.error('JWT_SECRET is not set — required for auth in production.');
    process.exit(1);
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) {
    console.error('STRIPE_SECRET_KEY is not set — required for Stripe API in production.');
    process.exit(1);
  }

  const webhook = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhook) {
    console.error(
      'STRIPE_WEBHOOK_SECRET is not set. Register https://<your-api-host>/stripe/webhook in Stripe Dashboard → Webhooks, then paste the endpoint signing secret (whsec_...).',
    );
    console.error('Subscribe the endpoint to:', STRIPE_WEBHOOK_EVENT_TYPES.join(', '));
    process.exit(1);
  }

  console.log(
    'DATABASE_URL, REDIS_URL, JWT_SECRET, STRIPE_SECRET_KEY, and STRIPE_WEBHOOK_SECRET are set and parse correctly.',
  );
  console.log('Stripe webhook events to register:', STRIPE_WEBHOOK_EVENT_TYPES.join(', '));
}

main();
