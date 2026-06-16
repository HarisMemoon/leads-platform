import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeadInternalCost1776300000000 implements MigrationInterface {
  name = 'LeadInternalCost1776300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads"
      ADD COLUMN IF NOT EXISTS "internal_cost_cents"   BIGINT       NULL,
      ADD COLUMN IF NOT EXISTS "ping_post_cost_cents"  BIGINT       NULL,
      ADD COLUMN IF NOT EXISTS "campaign_name"          VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS "ad_source"              VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS "cost_notes"             TEXT         NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads"
      DROP COLUMN IF EXISTS "internal_cost_cents",
      DROP COLUMN IF EXISTS "ping_post_cost_cents",
      DROP COLUMN IF EXISTS "campaign_name",
      DROP COLUMN IF EXISTS "ad_source",
      DROP COLUMN IF EXISTS "cost_notes"
    `);
  }
}
