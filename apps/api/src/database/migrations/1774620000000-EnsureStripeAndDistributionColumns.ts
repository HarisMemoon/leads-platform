import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureStripeAndDistributionColumns1774620000000
  implements MigrationInterface
{
  name = 'EnsureStripeAndDistributionColumns1774620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      ADD COLUMN IF NOT EXISTS "cooldown_minutes" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_distribution_rules_user_id'
        ) THEN
          ALTER TABLE "distribution_rules"
          ADD CONSTRAINT "UQ_distribution_rules_user_id" UNIQUE ("user_id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" character varying
    `);

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

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "stripe_customer_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP CONSTRAINT IF EXISTS "UQ_distribution_rules_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP COLUMN IF EXISTS "cooldown_minutes"
    `);
  }
}

