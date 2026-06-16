import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeadStatusExpansion1776700000000 implements MigrationInterface {
  name = 'LeadStatusExpansion1776700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add manual_review to the lead_status enum if it uses an enum type
    // (If status is varchar, this is a no-op — values can already be anything)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leads_status_enum') THEN
          ALTER TYPE "leads_status_enum" ADD VALUE IF NOT EXISTS 'manual_review';
        END IF;
      END
      $$
    `);

    // Add crm_delivery_failed flag to leads table
    await queryRunner.query(`
      ALTER TABLE "leads"
      ADD COLUMN IF NOT EXISTS "crm_delivery_failed" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads" DROP COLUMN IF EXISTS "crm_delivery_failed"
    `);
  }
}
