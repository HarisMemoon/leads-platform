import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeadStatusSoldOutAndExpirationDate1774700000000
  implements MigrationInterface
{
  name = 'LeadStatusSoldOutAndExpirationDate1774700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'sold_out' to the leads_status_enum (TypeORM names it "leads_status_enum")
    await queryRunner.query(`
      ALTER TYPE "public"."leads_status_enum" ADD VALUE IF NOT EXISTS 'sold_out'
    `);

    // Add expiration_date column for optional lead expiry
    await queryRunner.query(`
      ALTER TABLE "leads"
      ADD COLUMN IF NOT EXISTS "expiration_date" timestamp with time zone
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads" DROP COLUMN IF EXISTS "expiration_date"
    `);
    // Note: PostgreSQL does not support removing values from enums directly.
    // To roll back the enum change, recreate the type without 'sold_out'.
  }
}
