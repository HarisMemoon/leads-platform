import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase A — Marketplace Simplification (non-breaking additive migration)
 *
 * Adds dual-price fields to leads, exclusivity preference / price ceiling to
 * distribution_rules, exclusivity choice to lead_assignments, and an
 * early-access window minutes setting to distribution_engine_settings.
 *
 * No existing columns are dropped or altered.
 */
export class MarketplaceSimplification1775100000000
  implements MigrationInterface
{
  name = 'MarketplaceSimplification1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── leads ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "leads"
        ADD COLUMN IF NOT EXISTS "exclusive_price_cents"       BIGINT,
        ADD COLUMN IF NOT EXISTS "shared_price_cents"          BIGINT,
        ADD COLUMN IF NOT EXISTS "max_non_exclusive_buyers"    INTEGER NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS "non_exclusive_buyers_count"  INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "early_access_until"          TIMESTAMP WITH TIME ZONE
    `);

    // Backfill: exclusive leads get exclusive_price; shared/semi_exclusive get shared_price.
    await queryRunner.query(`
      UPDATE "leads"
        SET "exclusive_price_cents" = "price_cents"::BIGINT
      WHERE "exclusivity_level" = 'exclusive'
        AND "exclusive_price_cents" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "leads"
        SET "shared_price_cents" = "price_cents"::BIGINT
      WHERE "exclusivity_level" IN ('shared', 'semi_exclusive')
        AND "shared_price_cents" IS NULL
    `);
    // For any leads where one side is still NULL, default it to price_cents so
    // old rows are purchasable via either path until admin re-tunes.
    await queryRunner.query(`
      UPDATE "leads"
        SET "exclusive_price_cents" = "price_cents"::BIGINT
      WHERE "exclusive_price_cents" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "leads"
        SET "shared_price_cents" = "price_cents"::BIGINT
      WHERE "shared_price_cents" IS NULL
    `);

    // Backfill early_access_until = created_at + 60 min for all existing leads.
    // New leads will have this set by the application layer on insert.
    await queryRunner.query(`
      UPDATE "leads"
        SET "early_access_until" = "created_at" + INTERVAL '60 minutes'
      WHERE "early_access_until" IS NULL
    `);

    // ── distribution_rules ───────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
        ADD COLUMN IF NOT EXISTS "exclusivity_preference" VARCHAR NOT NULL DEFAULT 'both',
        ADD COLUMN IF NOT EXISTS "max_lead_price_cents"   BIGINT
    `);

    // ── lead_assignments ─────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "lead_assignments"
        ADD COLUMN IF NOT EXISTS "exclusivity_choice" VARCHAR
    `);

    // ── distribution_engine_settings — early_access_minutes ──────────────────
    await queryRunner.query(`
      ALTER TABLE "distribution_engine_settings"
        ADD COLUMN IF NOT EXISTS "early_access_minutes" INTEGER NOT NULL DEFAULT 60
    `);

    // Update the subscription_plans Pro row to new pricing/copy
    await queryRunner.query(`
      UPDATE "subscription_plans"
        SET
          "monthly_price_cents"            = 4999,
          "display_price"                  = '$49.99',
          "tagline"                        = '10% off every lead, early access to new leads, and priority notifications.',
          "monthly_lead_limit"             = NULL,
          "lead_limit_summary"             = 'No lead limits',
          "priority_rank"                  = 1,
          "priority_label"                 = 'Pro member',
          "distribution_summary"           = 'Auto-distribution with early-access priority during the first 60 minutes.',
          "included_lead_credits_summary"  = NULL,
          "card_highlights"                = '["10% off all leads", "60-min early access", "Priority notifications"]'::jsonb,
          "feature_bullets"                = '["10% discount on every lead purchase", "60-minute early access to new leads (buy before free users)", "Priority notifications when new leads drop", "No monthly lead limits or allocations"]'::jsonb
      WHERE "plan_type" = 'pro'
    `);

    // Hide Basic plan (it's replaced by the free tier concept)
    await queryRunner.query(`
      UPDATE "subscription_plans"
        SET "is_active" = false
      WHERE "plan_type" = 'basic'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "distribution_engine_settings" DROP COLUMN IF EXISTS "early_access_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lead_assignments" DROP COLUMN IF EXISTS "exclusivity_choice"`,
    );
    await queryRunner.query(`
      ALTER TABLE "distribution_rules"
        DROP COLUMN IF EXISTS "exclusivity_preference",
        DROP COLUMN IF EXISTS "max_lead_price_cents"
    `);
    await queryRunner.query(`
      ALTER TABLE "leads"
        DROP COLUMN IF EXISTS "exclusive_price_cents",
        DROP COLUMN IF EXISTS "shared_price_cents",
        DROP COLUMN IF EXISTS "max_non_exclusive_buyers",
        DROP COLUMN IF EXISTS "non_exclusive_buyers_count",
        DROP COLUMN IF EXISTS "early_access_until"
    `);
  }
}
