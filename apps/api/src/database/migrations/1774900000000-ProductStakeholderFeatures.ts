import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductStakeholderFeatures1774900000000 implements MigrationInterface {
  name = 'ProductStakeholderFeatures1774900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_sub" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_google_sub" ON "users" ("google_sub") WHERE "google_sub" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "distribution_locked" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_source" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_medium" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_campaign" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_content" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_term" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "canonical_lead_source" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "duplicate_of_lead_id" uuid`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "leads" ADD CONSTRAINT "FK_leads_duplicate_of_lead"
          FOREIGN KEY ("duplicate_of_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "lead_assignments" ADD COLUMN IF NOT EXISTS "contract_price_cents" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "lead_assignments" ADD COLUMN IF NOT EXISTS "sell_price_cents" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "lead_assignments" ADD COLUMN IF NOT EXISTS "buyer_notes" text`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lead_refund_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "status" character varying NOT NULL DEFAULT 'pending',
        "reason" text NOT NULL,
        "admin_notes" text,
        "resolution" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lead_assignment_id" uuid NOT NULL,
        "buyer_id" uuid NOT NULL,
        CONSTRAINT "PK_lead_refund_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lead_refund_requests_assignment" FOREIGN KEY ("lead_assignment_id") REFERENCES "lead_assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_lead_refund_requests_buyer" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lead_refund_requests_status" ON "lead_refund_requests" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resources_content" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" character varying NOT NULL,
        "title" character varying NOT NULL,
        "body" text,
        "url" character varying,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_published" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resources_content" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "resources_content"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lead_refund_requests"`);

    await queryRunner.query(
      `ALTER TABLE "lead_assignments" DROP COLUMN IF EXISTS "buyer_notes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lead_assignments" DROP COLUMN IF EXISTS "sell_price_cents"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lead_assignments" DROP COLUMN IF EXISTS "contract_price_cents"`,
    );

    await queryRunner.query(
      `ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "FK_leads_duplicate_of_lead"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN IF EXISTS "duplicate_of_lead_id"`,
    );
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN IF EXISTS "utm"`);
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN IF EXISTS "canonical_lead_source"`,
    );

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "utm_term"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "utm_content"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "utm_campaign"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "utm_medium"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "utm_source"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "distribution_locked"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_google_sub"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "google_sub"`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`,
    );
  }
}
