import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Auto-reload may only be turned on after the user opts in by checking
 * "Save this card for auto-reload" on a completed wallet top-up.
 * Existing wallets with a saved PM are treated as opted-in (grandfather).
 */
export class WalletAutoReloadOptIn1774705000000 implements MigrationInterface {
  name = 'WalletAutoReloadOptIn1774705000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wallet_accounts"
      ADD COLUMN IF NOT EXISTS "auto_reload_opt_in" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "wallet_accounts"
      SET "auto_reload_opt_in" = true
      WHERE "stripe_payment_method_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet_accounts" DROP COLUMN IF EXISTS "auto_reload_opt_in"`,
    );
  }
}
