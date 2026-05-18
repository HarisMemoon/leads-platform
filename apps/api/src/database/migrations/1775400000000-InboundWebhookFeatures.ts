import { MigrationInterface, QueryRunner } from 'typeorm';

export class InboundWebhookFeatures1775400000000 implements MigrationInterface {
  name = 'InboundWebhookFeatures1775400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendor_webhook_hits" (
        "id"                uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "vendor_id"         uuid,
        "lead_id"           uuid,
        "status"            varchar     NOT NULL DEFAULT 'accepted',
        "rejection_reason"  text,
        "ip_address"        varchar,
        "payload_snapshot"  jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "created_at"        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendor_webhook_hits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vendor_webhook_hits_vendor"
          FOREIGN KEY ("vendor_id") REFERENCES "vendor_integrations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_vendor_webhook_hits_lead"
          FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendor_webhook_hits_vendor_created"
        ON "vendor_webhook_hits" ("vendor_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vendor_webhook_hits"`);
  }
}
