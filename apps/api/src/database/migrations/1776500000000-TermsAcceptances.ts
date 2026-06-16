import { MigrationInterface, QueryRunner } from 'typeorm';

export class TermsAcceptances1776500000000 implements MigrationInterface {
  name = 'TermsAcceptances1776500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "terms_acceptances" (
        "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"       UUID        NOT NULL,
        "terms_version" VARCHAR(32) NOT NULL DEFAULT '2025-01',
        "ip_address"    VARCHAR,
        "accepted_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_terms_acceptances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_terms_acceptances_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_terms_acceptances_user"
      ON "terms_acceptances" ("user_id", "terms_version")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "terms_acceptances"`);
  }
}
