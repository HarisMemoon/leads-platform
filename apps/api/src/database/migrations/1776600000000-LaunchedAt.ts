import { MigrationInterface, QueryRunner } from 'typeorm';

export class LaunchedAt1776600000000 implements MigrationInterface {
  name = 'LaunchedAt1776600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      ADD COLUMN IF NOT EXISTS "launched_at" TIMESTAMP WITH TIME ZONE NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
      DROP COLUMN IF EXISTS "launched_at"
    `);
  }
}
