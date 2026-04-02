import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { DataSource } from 'typeorm';

/**
 * Diagnostic helper for auto-reload opt-in flag.
 * Run from apps/api:
 *   pnpm ts-node -r tsconfig-paths/register scripts/check-auto-reload-opt-in.ts
 */
async function main() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    // Raw SQL only; avoids TypeORM entity metadata graph issues.
    entities: [],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  // Simpler: raw SQL for clarity.
  const rows = await dataSource.query(`
    SELECT id, user_id, stripe_payment_method_id IS NOT NULL AS has_pm, auto_reload_opt_in,
           auto_reload_enabled, auto_reload_threshold_cents, auto_reload_amount_cents,
           updated_at
    FROM wallet_accounts
    ORDER BY updated_at DESC
    LIMIT 5
  `);

  console.log('Latest wallet_accounts rows:');
  console.log(rows);

  const stats = await dataSource.query(`
    SELECT
      COUNT(*) FILTER (WHERE stripe_payment_method_id IS NOT NULL) AS has_pm,
      COUNT(*) FILTER (WHERE stripe_payment_method_id IS NOT NULL AND auto_reload_opt_in IS TRUE) AS opted_in_with_pm,
      COUNT(*) FILTER (WHERE auto_reload_opt_in IS TRUE) AS opted_in_total,
      COUNT(*) FILTER (WHERE auto_reload_enabled IS TRUE) AS auto_reload_enabled_total
    FROM wallet_accounts
  `);

  console.log('Stats:');
  console.log(stats);

  await dataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

