import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills the admin console with real data sources:
 *  - subscription_plans (admin-editable plan catalog, replaces hardcoded plans)
 *  - lead_ingestion_batches (CSV / vendor batch tracking)
 *  - lead_grade_overrides (manual grading reviewer audit trail)
 */
export class AdminConsoleBackend1775000000000 implements MigrationInterface {
  name = 'AdminConsoleBackend1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "plan_type" "public"."subscriptions_plan_type_enum" NOT NULL,
        "name" character varying NOT NULL,
        "tagline" text NOT NULL,
        "monthly_price_cents" bigint NOT NULL DEFAULT 0,
        "display_price" character varying NOT NULL,
        "billing_period_label" character varying NOT NULL DEFAULT 'per month',
        "monthly_lead_limit" integer,
        "lead_limit_summary" character varying NOT NULL,
        "priority_rank" integer NOT NULL DEFAULT 1,
        "priority_label" character varying NOT NULL,
        "distribution_summary" text NOT NULL,
        "included_lead_credits_summary" text,
        "filter_scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "card_highlights" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "feature_bullets" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_plans" PRIMARY KEY ("plan_type")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "subscription_plans" (
        "plan_type", "name", "tagline", "monthly_price_cents", "display_price",
        "billing_period_label", "monthly_lead_limit", "lead_limit_summary",
        "priority_rank", "priority_label", "distribution_summary",
        "included_lead_credits_summary", "filter_scope", "card_highlights",
        "feature_bullets", "is_active"
      ) VALUES (
        'basic',
        'Basic',
        'Premium subscription leads plus a monthly wallet allowance.',
        19900,
        '$199',
        'per month',
        25,
        'Up to 25 premium leads / billing period',
        1,
        'Standard merry-go-round priority',
        'Included in automated distribution when leads match your geography.',
        '25 premium lead credits / month + $50 wallet credit / month',
        '{"state": true, "county": true, "zip": false, "leadType": false}'::jsonb,
        '["25 premium leads / month", "$50 wallet credit / month", "Stripe subscription billing"]'::jsonb,
        '["Recurring billing through Stripe (cancel anytime from billing portal)", "25 included premium lead credits per monthly period", "$50 wallet credit each billing cycle (posted when Stripe invoices are paid)", "Geography-first market selection in onboarding"]'::jsonb,
        true
      )
      ON CONFLICT ("plan_type") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "subscription_plans" (
        "plan_type", "name", "tagline", "monthly_price_cents", "display_price",
        "billing_period_label", "monthly_lead_limit", "lead_limit_summary",
        "priority_rank", "priority_label", "distribution_summary",
        "included_lead_credits_summary", "filter_scope", "card_highlights",
        "feature_bullets", "is_active"
      ) VALUES (
        'pro',
        'Pro',
        'Higher volume premium leads and a larger monthly wallet allowance.',
        34900,
        '$349',
        'per month',
        40,
        'Up to 40 premium leads / billing period',
        2,
        'Elevated merry-go-round priority',
        'Ahead of Basic in the rotation when leads match your filters.',
        '40 premium lead credits / month + $100 wallet credit / month',
        '{"state": true, "county": true, "zip": true, "leadType": false}'::jsonb,
        '["40 premium leads / month", "$100 wallet credit / month", "Higher rotation priority"]'::jsonb,
        '["Recurring billing through Stripe", "40 included premium lead credits per monthly period", "$100 wallet credit each billing cycle (posted when Stripe invoices are paid)", "Geography-first market selection in onboarding"]'::jsonb,
        true
      )
      ON CONFLICT ("plan_type") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lead_ingestion_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "filename" character varying NOT NULL,
        "vendor" character varying,
        "status" character varying NOT NULL DEFAULT 'pending',
        "total_rows" integer NOT NULL DEFAULT 0,
        "processed_rows" integer NOT NULL DEFAULT 0,
        "failed_rows" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "uploaded_by_user_id" uuid,
        "failure_samples" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_lead_ingestion_batches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lead_ingestion_batches_uploaded_by"
          FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lead_ingestion_batches_status_created_at" ON "lead_ingestion_batches" ("status", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lead_grade_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lead_id" uuid NOT NULL,
        "original_score" integer NOT NULL,
        "override_score" integer NOT NULL,
        "notes" text,
        "reviewer_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lead_grade_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lead_grade_overrides_lead"
          FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_lead_grade_overrides_reviewer"
          FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lead_grade_overrides_lead_created_at" ON "lead_grade_overrides" ("lead_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lead_grade_overrides"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lead_ingestion_batches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans"`);
  }
}
