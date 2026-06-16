import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefundStatusExpansion1776200000000 implements MigrationInterface {
  name = 'RefundStatusExpansion1776200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add support_evidence_url column
    await queryRunner.query(`
      ALTER TABLE "lead_refund_requests"
      ADD COLUMN IF NOT EXISTS "support_evidence_url" VARCHAR
    `);

    // The status column is varchar(32) — just ensure the new values fit (they all do)
    // No constraint change needed since it stores arbitrary strings
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lead_refund_requests"
      DROP COLUMN IF EXISTS "support_evidence_url"
    `);
  }
}
