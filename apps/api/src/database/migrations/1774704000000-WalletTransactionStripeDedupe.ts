import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes duplicate Stripe wallet credits when webhook + HTTP confirm race:
 * removes duplicate ledger rows and enforces uniqueness on PaymentIntent id.
 */
export class WalletTransactionStripeDedupe1774704000000
  implements MigrationInterface
{
  name = 'WalletTransactionStripeDedupe1774704000000';

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
      DELETE FROM wallet_transactions wt
      WHERE wt.reference_type = 'onboarding_initial'
        AND wt.id NOT IN (
          SELECT DISTINCT ON ("walletId") id
          FROM wallet_transactions
          WHERE reference_type = 'onboarding_initial'
          ORDER BY "walletId", created_at ASC
        )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wallet_tx_stripe_payment_intent"
      ON wallet_transactions ("reference_type", "reference_id")
      WHERE "reference_type" = 'stripe_topup' AND "reference_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wallet_tx_onboarding_initial_wallet"
      ON wallet_transactions ("walletId")
      WHERE "reference_type" = 'onboarding_initial'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_wallet_tx_onboarding_initial_wallet"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_wallet_tx_stripe_payment_intent"`,
    );
  }
}
