import { MigrationInterface, QueryRunner } from 'typeorm';

export class DistributionRulesOnboardingUpsert1774612800000
  implements MigrationInterface
{
  name = 'DistributionRulesOnboardingUpsert1774612800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      ADD COLUMN IF NOT EXISTS "participation_enabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      ADD COLUMN IF NOT EXISTS "max_per_day" integer NOT NULL DEFAULT 5
    `);
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      ADD COLUMN IF NOT EXISTS "market_filters" text[] NOT NULL DEFAULT ARRAY[]::text[]
    `);
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      ADD COLUMN IF NOT EXISTS "cooldown_minutes" integer NOT NULL DEFAULT 0
    `);

    // Keep one row per user before adding uniqueness.
    await queryRunner.query(`
      DELETE FROM "distribution_rules" a
      USING "distribution_rules" b
      WHERE a.user_id = b.user_id
        AND a.created_at < b.created_at
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP CONSTRAINT IF EXISTS "UQ_distribution_rules_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP COLUMN IF EXISTS "cooldown_minutes"
    `);
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP COLUMN IF EXISTS "market_filters"
    `);
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP COLUMN IF EXISTS "max_per_day"
    `);
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP COLUMN IF EXISTS "participation_enabled"
    `);
  }
}

