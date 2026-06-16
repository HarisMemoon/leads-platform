import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrmRetryFields1776400000000 implements MigrationInterface {
  name = 'CrmRetryFields1776400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lead_assignments"
      ADD COLUMN IF NOT EXISTS "crm_retry_count"   INT       NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "crm_next_retry_at" TIMESTAMP WITH TIME ZONE NULL,
      ADD COLUMN IF NOT EXISTS "crm_last_error"    TEXT      NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lead_assignments_crm_retry"
      ON "lead_assignments" ("crm_sync_status", "crm_next_retry_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lead_assignments_crm_retry"`);
    await queryRunner.query(`
      ALTER TABLE "lead_assignments"
      DROP COLUMN IF EXISTS "crm_retry_count",
      DROP COLUMN IF EXISTS "crm_next_retry_at",
      DROP COLUMN IF EXISTS "crm_last_error"
    `);
  }
}
