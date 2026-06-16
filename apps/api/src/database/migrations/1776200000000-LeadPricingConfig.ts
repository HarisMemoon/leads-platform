import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeadPricingConfig1776200000000 implements MigrationInterface {
  name = 'LeadPricingConfig1776200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lead_pricing_config" (
        "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
        "lead_type"             VARCHAR     NOT NULL,
        "new_lead_price_cents"  BIGINT      NOT NULL,
        "shared_price_cents"    BIGINT,
        "discount_after_days"   INT         NOT NULL DEFAULT 7,
        "discount_amount_cents" BIGINT      NOT NULL DEFAULT 0,
        "min_price_floor_cents" BIGINT,
        "created_at"            TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lead_pricing_config" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lead_pricing_config_type" UNIQUE ("lead_type")
      )
    `);

    // Seed defaults: inbound $150 exclusive / $25 shared, outbound $75 exclusive / $15 shared
    await queryRunner.query(`
      INSERT INTO "lead_pricing_config"
        ("lead_type", "new_lead_price_cents", "shared_price_cents", "discount_after_days", "discount_amount_cents", "min_price_floor_cents")
      VALUES
        ('inbound',  15000, 2500, 7, 12500, 2000),
        ('outbound',  7500, 1500, 7,  6000, 1500)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lead_pricing_config"`);
  }
}
