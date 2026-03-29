import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformPhaseFeatures1774627200000 implements MigrationInterface {
  name = 'PlatformPhaseFeatures1774627200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "marketplace_tier" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "list_price_anchor_cents" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distribution_run_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_distribution_at" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(
      `ALTER TABLE "lead_assignments" ADD COLUMN IF NOT EXISTS "lifecycle_phase" character varying`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lead_assignment_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_type" character varying NOT NULL,
        "body" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "assignment_id" uuid,
        CONSTRAINT "PK_lead_assignment_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lead_assignment_events_assignment" FOREIGN KEY ("assignment_id") REFERENCES "lead_assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lead_assignment_events_assignment_created" ON "lead_assignment_events" ("assignment_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "distribution_engine_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "queue_paused" boolean NOT NULL DEFAULT false,
        "max_auto_distribution_runs" integer NOT NULL DEFAULT 10,
        "cooldown_minutes_between_runs" integer NOT NULL DEFAULT 15,
        "markdown_after_days" integer NOT NULL DEFAULT 7,
        "markdown_percent" integer NOT NULL DEFAULT 10,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_distribution_engine_settings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "distribution_engine_settings" ("id")
      SELECT '00000000-0000-4000-8000-000000000001'
      WHERE NOT EXISTS (
        SELECT 1 FROM "distribution_engine_settings" WHERE "id" = '00000000-0000-4000-8000-000000000001'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lead_assignment_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "distribution_engine_settings"`);
    await queryRunner.query(
      `ALTER TABLE "lead_assignments" DROP COLUMN IF EXISTS "lifecycle_phase"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN IF EXISTS "last_distribution_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN IF EXISTS "distribution_run_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN IF EXISTS "list_price_anchor_cents"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" DROP COLUMN IF EXISTS "marketplace_tier"`,
    );
  }
}
