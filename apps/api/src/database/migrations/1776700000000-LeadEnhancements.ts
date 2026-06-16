import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeadEnhancements1776700000000 implements MigrationInterface {
  name = 'LeadEnhancements1776700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add LOCKED and BAD to the lead_status enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'locked'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'leads_status_enum')
        ) THEN
          ALTER TYPE leads_status_enum ADD VALUE 'locked';
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'bad'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'leads_status_enum')
        ) THEN
          ALTER TYPE leads_status_enum ADD VALUE 'bad';
        END IF;
      END$$;
    `);

    // Add vendor_name, ping_post_cost_cents, is_bad_lead to leads
    await queryRunner.query(`
      ALTER TABLE "leads"
      ADD COLUMN IF NOT EXISTS "vendor_name"           VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS "ping_post_cost_cents"  BIGINT       NULL,
      ADD COLUMN IF NOT EXISTS "is_bad_lead"           BOOLEAN      NOT NULL DEFAULT false
    `);

    // Update default for max_non_exclusive_buyers from 3 to 5 (new leads only)
    await queryRunner.query(`
      ALTER TABLE "leads"
      ALTER COLUMN "max_non_exclusive_buyers" SET DEFAULT 5
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads"
      DROP COLUMN IF EXISTS "vendor_name",
      DROP COLUMN IF EXISTS "ping_post_cost_cents",
      DROP COLUMN IF EXISTS "is_bad_lead"
    `);
    await queryRunner.query(`
      ALTER TABLE "leads"
      ALTER COLUMN "max_non_exclusive_buyers" SET DEFAULT 3
    `);
    // Note: Postgres enum values cannot be removed without recreating the type
  }
}
