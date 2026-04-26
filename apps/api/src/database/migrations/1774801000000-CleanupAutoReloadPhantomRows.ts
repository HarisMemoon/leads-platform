import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes impossible duplicate auto-reload ledger rows where two credits for the same wallet
 * recorded the exact same `balance_after_cents` + amount. This can only happen when two workers
 * race from the same pre-credit balance.
 */
export class CleanupAutoReloadPhantomRows1774801000000
  implements MigrationInterface
{
  name = 'CleanupAutoReloadPhantomRows1774801000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM wallet_transactions wt
      USING (
        SELECT id
        FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY
                "walletId",
                amount_cents,
                balance_after_cents,
                reference_type,
                description
              ORDER BY created_at ASC, id ASC
            ) AS rn
          FROM wallet_transactions
          WHERE reference_type = 'stripe_topup'
            AND description = 'Wallet auto-reload'
        ) ranked
        WHERE ranked.rn > 1
      ) dup
      WHERE wt.id = dup.id
    `);
  }

  public async down(): Promise<void> {
    // no-op (data cleanup migration)
  }
}
