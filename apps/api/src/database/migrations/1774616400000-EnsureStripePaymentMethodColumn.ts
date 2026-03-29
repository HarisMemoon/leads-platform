import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureStripePaymentMethodColumn1774616400000
  implements MigrationInterface
{
  name = 'EnsureStripePaymentMethodColumn1774616400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wallet_accounts"
      ADD COLUMN IF NOT EXISTS "stripe_payment_method_id" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wallet_accounts"
      DROP COLUMN IF EXISTS "stripe_payment_method_id"
    `);
  }
}

