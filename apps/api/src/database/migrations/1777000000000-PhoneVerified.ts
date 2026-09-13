import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhoneVerified1777000000000 implements MigrationInterface {
  name = 'PhoneVerified1777000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "phone_verified" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "phone_verified"
    `);
  }
}
