import { MigrationInterface, QueryRunner } from 'typeorm';

export class PingRoutingEngine1775200000000 implements MigrationInterface {
  name = 'PingRoutingEngine1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_assignments_purchase_type_enum')
           AND NOT EXISTS (
             SELECT 1
             FROM pg_enum e
             JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'lead_assignments_purchase_type_enum'
               AND e.enumlabel = 'vendor_ping'
           ) THEN
          ALTER TYPE "lead_assignments_purchase_type_enum" ADD VALUE 'vendor_ping';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendor_integrations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "api_key_hash" varchar NOT NULL UNIQUE,
        "enabled" boolean NOT NULL DEFAULT true,
        "allowed_sources" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "ping_timeout_ms" integer NOT NULL DEFAULT 750,
        "ping_ttl_seconds" integer NOT NULL DEFAULT 900,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "buyer_pricing_rules" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "paused" boolean NOT NULL DEFAULT false,
        "priority" integer NOT NULL DEFAULT 0,
        "markets" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "states" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "cities" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "zips" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "counties" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "property_types" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "lead_types" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "fixed_price_cents" bigint,
        "max_bid_cents" bigint,
        "exclusivity_preference" varchar NOT NULL DEFAULT 'both',
        "routing_strategy" varchar NOT NULL DEFAULT 'highest_bid',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lead_pings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "vendor_id" uuid NOT NULL REFERENCES "vendor_integrations"("id") ON DELETE CASCADE,
        "vendor_ping_id" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "market" varchar,
        "city" varchar,
        "state" varchar,
        "zip" varchar,
        "county" varchar,
        "property_type" varchar,
        "lead_type" varchar NOT NULL,
        "source" varchar,
        "exclusivity_choice" varchar NOT NULL DEFAULT 'exclusive',
        "matched_buyer_id" uuid REFERENCES "users"("id"),
        "matched_pricing_rule_id" uuid REFERENCES "buyer_pricing_rules"("id"),
        "matched_price_cents" bigint,
        "rejection_reason" varchar,
        "latency_ms" integer,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_lead_pings_vendor_ping" UNIQUE ("vendor_id", "vendor_ping_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lead_posts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "vendor_id" uuid NOT NULL REFERENCES "vendor_integrations"("id") ON DELETE CASCADE,
        "ping_id" uuid NOT NULL REFERENCES "lead_pings"("id") ON DELETE CASCADE,
        "vendor_lead_id" varchar NOT NULL,
        "lead_id" uuid REFERENCES "leads"("id"),
        "status" varchar NOT NULL DEFAULT 'pending',
        "delivery_status" varchar,
        "error_message" varchar,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_lead_posts_vendor_lead" UNIQUE ("vendor_id", "vendor_lead_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ping_match_audit" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ping_id" uuid NOT NULL REFERENCES "lead_pings"("id") ON DELETE CASCADE,
        "buyer_id" uuid REFERENCES "users"("id"),
        "pricing_rule_id" uuid REFERENCES "buyer_pricing_rules"("id"),
        "eligible" boolean NOT NULL DEFAULT false,
        "price_cents" bigint,
        "ranking_score" integer NOT NULL DEFAULT 0,
        "rejection_reason" varchar,
        "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_vendor_integrations_enabled" ON "vendor_integrations" ("enabled")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_buyer_pricing_user_active" ON "buyer_pricing_rules" ("user_id", "is_active", "paused")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_buyer_pricing_active_priority" ON "buyer_pricing_rules" ("is_active", "priority")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lead_pings_status_expiry" ON "lead_pings" ("status", "expires_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lead_pings_market" ON "lead_pings" ("state", "city", "zip")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lead_pings_buyer" ON "lead_pings" ("matched_buyer_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lead_posts_ping" ON "lead_posts" ("ping_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lead_posts_status" ON "lead_posts" ("status", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ping_audit_ping" ON "ping_match_audit" ("ping_id", "eligible")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ping_audit_buyer" ON "ping_match_audit" ("buyer_id", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ping_match_audit"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lead_posts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lead_pings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "buyer_pricing_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vendor_integrations"`);
  }
}
