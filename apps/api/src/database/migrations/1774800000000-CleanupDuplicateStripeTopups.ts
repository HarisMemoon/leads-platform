import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes duplicate stripe_topup ledger rows (same PaymentIntent id) if any were
 * created before idempotency checks reliably saw the first row.
 */
export class CleanupDuplicateStripeTopups1774800000000
  implements MigrationInterface
{
  name = 'CleanupDuplicateStripeTopups1774800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM wallet_transactions wt
      WHERE wt.reference_type = 'stripe_topup'
        AND wt.reference_id IS NOT NULL
        AND wt.id NOT IN (
          SELECT DISTINCT ON (reference_id) id
          FROM wallet_transactions
          WHERE reference_type = 'stripe_topup' AND reference_id IS NOT NULL
          ORDER BY reference_id, created_at ASC
        )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wallet_tx_stripe_payment_intent"
      ON wallet_transactions ("reference_type", "reference_id")
      WHERE "reference_type" = 'stripe_topup' AND "reference_id" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    /* no-op: do not drop the unique index created by an earlier migration */
  }
}
