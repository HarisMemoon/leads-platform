import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1773758489080 implements MigrationInterface {
    name = 'InitSchema1773758489080'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'buyer', 'support')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "full_name" character varying, "company_name" character varying, "phone" character varying, "role" "public"."users_role_enum" NOT NULL, "stripe_customer_id" character varying, "email_verified" boolean NOT NULL DEFAULT false, "onboarding_completed" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "wallet_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "balance_cents" bigint NOT NULL DEFAULT '0', "currency" character varying NOT NULL DEFAULT 'usd', "auto_reload_enabled" boolean NOT NULL DEFAULT false, "auto_reload_threshold_cents" bigint, "auto_reload_amount_cents" bigint, "stripe_payment_method_id" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "REL_2fd289edcdb11bce54a50b191b" UNIQUE ("user_id"), CONSTRAINT "PK_7d29a782bf4203c2ed2b613353d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."wallet_transactions_type_enum" AS ENUM('credit', 'debit')`);
        await queryRunner.query(`CREATE TABLE "wallet_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."wallet_transactions_type_enum" NOT NULL, "amount_cents" bigint NOT NULL, "balance_after_cents" bigint NOT NULL, "reference_type" character varying NOT NULL, "reference_id" character varying, "description" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "walletId" uuid, CONSTRAINT "PK_5120f131bde2cda940ec1a621db" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1738fc8d8ee34892e5962ab8fc" ON "wallet_transactions" ("walletId", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_plan_type_enum" AS ENUM('basic', 'pro', 'market_specific', 'premium')`);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('active', 'paused', 'cancelled', 'past_due')`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plan_type" "public"."subscriptions_plan_type_enum" NOT NULL, "stripe_subscription_id" character varying NOT NULL, "stripe_price_id" character varying NOT NULL, "status" "public"."subscriptions_status_enum" NOT NULL, "priority_weight" integer NOT NULL DEFAULT '1', "current_period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "current_period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "monthly_lead_limit" integer, "leads_used_this_period" integer NOT NULL DEFAULT '0', "markets" text array NOT NULL DEFAULT ARRAY[]::text[], "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "UQ_3a2d09d943f39912a01831a9272" UNIQUE ("stripe_subscription_id"), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "onboarding_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "current_step" integer NOT NULL DEFAULT '1', "completed_steps" integer array NOT NULL DEFAULT ARRAY[]::integer[], "data" jsonb NOT NULL DEFAULT '{}'::jsonb, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "REL_24f158c08586f16fc114147688" UNIQUE ("user_id"), CONSTRAINT "PK_070eb6e4f3132f9d7f29651aa3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notification_logs_channel_enum" AS ENUM('email', 'sms', 'in_app', 'push')`);
        await queryRunner.query(`CREATE TABLE "notification_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying NOT NULL, "title" character varying NOT NULL, "body" text NOT NULL, "channel" "public"."notification_logs_channel_enum" NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "reference_type" character varying, "reference_id" character varying, "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ba036ef713b62565d50e9dbf29" ON "notification_logs" ("user_id", "is_read", "sent_at") `);
        await queryRunner.query(`CREATE TABLE "market_alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "market" character varying NOT NULL, "filters" jsonb NOT NULL DEFAULT '{}'::jsonb, "delivery_channels" text array NOT NULL DEFAULT ARRAY['email']::text[], "frequency" character varying NOT NULL, "dnd_start" TIME, "dnd_end" TIME, "max_per_day" integer, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_e5db7afc45a72e26148aeefc815" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c9e5a4adc07f85f0455c53b249" ON "market_alerts" ("market", "is_active") `);
        await queryRunner.query(`CREATE TABLE "lead_price_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "old_price_cents" bigint NOT NULL, "new_price_cents" bigint NOT NULL, "reason" character varying NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lead_id" uuid, CONSTRAINT "PK_3e76e7b8d34f2940341ab41cc92" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."lead_assignments_purchase_type_enum" AS ENUM('auto_buy', 'manual', 'subscription_distribution')`);
        await queryRunner.query(`CREATE TYPE "public"."lead_assignments_ghl_sync_status_enum" AS ENUM('pending', 'synced', 'failed')`);
        await queryRunner.query(`CREATE TYPE "public"."lead_assignments_crm_sync_status_enum" AS ENUM('pending', 'synced', 'failed', 'skipped')`);
        await queryRunner.query(`CREATE TABLE "lead_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purchase_type" "public"."lead_assignments_purchase_type_enum" NOT NULL, "amount_charged_cents" bigint NOT NULL, "ghl_sync_status" "public"."lead_assignments_ghl_sync_status_enum" NOT NULL DEFAULT 'pending', "twilio_contacted" boolean NOT NULL DEFAULT false, "crm_sync_status" "public"."lead_assignments_crm_sync_status_enum" NOT NULL DEFAULT 'pending', "disposition" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lead_id" uuid, "buyer_id" uuid, "wallet_transaction_id" uuid, CONSTRAINT "PK_4478e8c2c0483fd8f3ff0f194e4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9c89a0a3d53d5bd7193e081b25" ON "lead_assignments" ("buyer_id", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."leads_status_enum" AS ENUM('new', 'available', 'reserved', 'sold', 'distributed', 'archived')`);
        await queryRunner.query(`CREATE TYPE "public"."leads_exclusivity_level_enum" AS ENUM('shared', 'semi_exclusive', 'exclusive')`);
        await queryRunner.query(`CREATE TABLE "leads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying, "source" character varying NOT NULL, "market" character varying NOT NULL, "lead_type" character varying NOT NULL, "status" "public"."leads_status_enum" NOT NULL, "exclusivity_level" "public"."leads_exclusivity_level_enum" NOT NULL, "quality_score" integer NOT NULL, "price_cents" bigint NOT NULL, "title" character varying NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "reserved_until" TIMESTAMP WITH TIME ZONE, "acquired_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reserved_by_user_id" uuid, CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_207d0fa1771421ebd8f94c12d3" ON "leads" ("reserved_by_user_id", "reserved_until") `);
        await queryRunner.query(`CREATE INDEX "IDX_1973f4408757cb640bdec0fcc7" ON "leads" ("status", "exclusivity_level", "price_cents") `);
        await queryRunner.query(`CREATE INDEX "IDX_f079fdc871245a3b2d0516a26f" ON "leads" ("market", "status", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."integrations_provider_enum" AS ENUM('twilio', 'gohighlevel', 'zapier', 'custom_webhook')`);
        await queryRunner.query(`CREATE TYPE "public"."integrations_status_enum" AS ENUM('connected', 'disconnected', 'error')`);
        await queryRunner.query(`CREATE TABLE "integrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" "public"."integrations_provider_enum" NOT NULL, "status" "public"."integrations_status_enum" NOT NULL, "config" jsonb NOT NULL DEFAULT '{}'::jsonb, "last_sync_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_9adcdc6d6f3922535361ce641e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "distribution_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "market" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "max_leads_per_day" integer, "max_leads_per_week" integer, "max_leads_per_month" integer, "max_spend_per_day_cents" bigint, "max_spend_per_week_cents" bigint, "max_spend_per_month_cents" bigint, "min_wallet_balance_cents" bigint NOT NULL DEFAULT '0', "lead_type_filters" text array NOT NULL DEFAULT ARRAY[]::text[], "rotation_position" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_5af9b25330349b0d9bfb4567e30" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_24bc5fd299fbf6ec5b98c336ed" ON "distribution_rules" ("user_id", "market", "is_active") `);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "target_type" character varying NOT NULL, "target_id" character varying NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "ip_address" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actor_id" uuid, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "wallet_accounts" ADD CONSTRAINT "FK_2fd289edcdb11bce54a50b191bc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wallet_transactions" ADD CONSTRAINT "FK_8a94d9d61a2b05123710b325fbf" FOREIGN KEY ("walletId") REFERENCES "wallet_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "onboarding_progress" ADD CONSTRAINT "FK_24f158c08586f16fc114147688b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification_logs" ADD CONSTRAINT "FK_f803d5e1bd85942b24ee4248701" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "market_alerts" ADD CONSTRAINT "FK_a100329b0dae96b58785258d6fd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lead_price_history" ADD CONSTRAINT "FK_15bc197d2a34021bc4c6fbb126a" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lead_assignments" ADD CONSTRAINT "FK_df57ae2f3bbe81624285bf3542d" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lead_assignments" ADD CONSTRAINT "FK_a696ad15f764cd5b24b5d272dc5" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lead_assignments" ADD CONSTRAINT "FK_2de0de0402a68f6ce51d104d675" FOREIGN KEY ("wallet_transaction_id") REFERENCES "wallet_transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leads" ADD CONSTRAINT "FK_bfe22a28b02f0bfb97db0343049" FOREIGN KEY ("reserved_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integrations" ADD CONSTRAINT "FK_75c40bb6e2430dd4b7a0b109d00" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "distribution_rules" ADD CONSTRAINT "FK_0e3aea84e7b7892e069dff8d16e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_177183f29f438c488b5e8510cdb"`);
        await queryRunner.query(`ALTER TABLE "distribution_rules" DROP CONSTRAINT "FK_0e3aea84e7b7892e069dff8d16e"`);
        await queryRunner.query(`ALTER TABLE "integrations" DROP CONSTRAINT "FK_75c40bb6e2430dd4b7a0b109d00"`);
        await queryRunner.query(`ALTER TABLE "leads" DROP CONSTRAINT "FK_bfe22a28b02f0bfb97db0343049"`);
        await queryRunner.query(`ALTER TABLE "lead_assignments" DROP CONSTRAINT "FK_2de0de0402a68f6ce51d104d675"`);
        await queryRunner.query(`ALTER TABLE "lead_assignments" DROP CONSTRAINT "FK_a696ad15f764cd5b24b5d272dc5"`);
        await queryRunner.query(`ALTER TABLE "lead_assignments" DROP CONSTRAINT "FK_df57ae2f3bbe81624285bf3542d"`);
        await queryRunner.query(`ALTER TABLE "lead_price_history" DROP CONSTRAINT "FK_15bc197d2a34021bc4c6fbb126a"`);
        await queryRunner.query(`ALTER TABLE "market_alerts" DROP CONSTRAINT "FK_a100329b0dae96b58785258d6fd"`);
        await queryRunner.query(`ALTER TABLE "notification_logs" DROP CONSTRAINT "FK_f803d5e1bd85942b24ee4248701"`);
        await queryRunner.query(`ALTER TABLE "onboarding_progress" DROP CONSTRAINT "FK_24f158c08586f16fc114147688b"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1"`);
        await queryRunner.query(`ALTER TABLE "wallet_transactions" DROP CONSTRAINT "FK_8a94d9d61a2b05123710b325fbf"`);
        await queryRunner.query(`ALTER TABLE "wallet_accounts" DROP CONSTRAINT "FK_2fd289edcdb11bce54a50b191bc"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_24bc5fd299fbf6ec5b98c336ed"`);
        await queryRunner.query(`DROP TABLE "distribution_rules"`);
        await queryRunner.query(`DROP TABLE "integrations"`);
        await queryRunner.query(`DROP TYPE "public"."integrations_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."integrations_provider_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f079fdc871245a3b2d0516a26f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1973f4408757cb640bdec0fcc7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_207d0fa1771421ebd8f94c12d3"`);
        await queryRunner.query(`DROP TABLE "leads"`);
        await queryRunner.query(`DROP TYPE "public"."leads_exclusivity_level_enum"`);
        await queryRunner.query(`DROP TYPE "public"."leads_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c89a0a3d53d5bd7193e081b25"`);
        await queryRunner.query(`DROP TABLE "lead_assignments"`);
        await queryRunner.query(`DROP TYPE "public"."lead_assignments_crm_sync_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."lead_assignments_ghl_sync_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."lead_assignments_purchase_type_enum"`);
        await queryRunner.query(`DROP TABLE "lead_price_history"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9e5a4adc07f85f0455c53b249"`);
        await queryRunner.query(`DROP TABLE "market_alerts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ba036ef713b62565d50e9dbf29"`);
        await queryRunner.query(`DROP TABLE "notification_logs"`);
        await queryRunner.query(`DROP TYPE "public"."notification_logs_channel_enum"`);
        await queryRunner.query(`DROP TABLE "onboarding_progress"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."subscriptions_plan_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1738fc8d8ee34892e5962ab8fc"`);
        await queryRunner.query(`DROP TABLE "wallet_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."wallet_transactions_type_enum"`);
        await queryRunner.query(`DROP TABLE "wallet_accounts"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
