import { MigrationInterface, QueryRunner } from 'typeorm';

export class DistributionRulePropertyTypeAndDisclaimer1777100000000
  implements MigrationInterface
{
  name = 'DistributionRulePropertyTypeAndDisclaimer1777100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      ADD COLUMN IF NOT EXISTS "property_type_filters" text[] NOT NULL DEFAULT ARRAY[]::text[],
      ADD COLUMN IF NOT EXISTS "autobuy_disclaimer_accepted_at" TIMESTAMP WITH TIME ZONE NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP COLUMN IF EXISTS "property_type_filters",
      DROP COLUMN IF EXISTS "autobuy_disclaimer_accepted_at"
    `);
  }
}
