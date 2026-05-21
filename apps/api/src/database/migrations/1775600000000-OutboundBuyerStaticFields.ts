import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboundBuyerStaticFields1775600000000 implements MigrationInterface {
  name = 'OutboundBuyerStaticFields1775600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbound_buyer_endpoints"
      ADD COLUMN IF NOT EXISTS "static_fields" JSONB NOT NULL DEFAULT '{}'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbound_buyer_endpoints"
      DROP COLUMN IF EXISTS "static_fields"
    `);
  }
}
