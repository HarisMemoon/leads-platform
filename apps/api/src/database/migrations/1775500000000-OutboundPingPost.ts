import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboundPingPost1775500000000 implements MigrationInterface {
  name = 'OutboundPingPost1775500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbound_buyer_endpoints" (
        "id"                  UUID              NOT NULL DEFAULT uuid_generate_v4(),
        "name"                VARCHAR(200)      NOT NULL,
        "ping_url"            TEXT              NOT NULL,
        "post_url"            TEXT,
        "auth_header_name"    VARCHAR(100),
        "auth_header_value"   TEXT,
        "field_map"           JSONB             NOT NULL DEFAULT '{}',
        "price_floor_cents"   BIGINT            NOT NULL DEFAULT 0,
        "timeout_ms"          INTEGER           NOT NULL DEFAULT 3000,
        "is_active"           BOOLEAN           NOT NULL DEFAULT TRUE,
        "created_at"          TIMESTAMP         NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbound_buyer_endpoints" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "outbound_ping_logs" (
        "id"                  UUID              NOT NULL DEFAULT uuid_generate_v4(),
        "lead_id"             UUID,
        "buyer_endpoint_id"   UUID              NOT NULL,
        "status"              VARCHAR(20)       NOT NULL,
        "bid_price_cents"     BIGINT,
        "floor_price_cents"   BIGINT            NOT NULL DEFAULT 0,
        "response_payload"    JSONB,
        "latency_ms"          INTEGER,
        "error_message"       TEXT,
        "is_test"             BOOLEAN           NOT NULL DEFAULT FALSE,
        "created_at"          TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbound_ping_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_outbound_ping_logs_lead_id" ON "outbound_ping_logs" ("lead_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbound_ping_logs_created_at" ON "outbound_ping_logs" ("created_at" DESC)`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "outbound_ping_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbound_buyer_endpoints"`);
  }
}
