import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProPlanFixedAt491775800000000 implements MigrationInterface {
  name = 'ProPlanFixedAt491775800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "subscription_plans"
      SET
        "monthly_price_cents" = '4900',
        "display_price"       = '$49',
        "feature_bullets"     = '["$25 shared inbound leads (up to 5 buyers per lead)", "$150 exclusive leads", "60-minute early access to new leads", "Auto-delivery of fresh matching leads", "Cancel anytime"]'::jsonb
      WHERE "plan_type" = 'pro'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "subscription_plans"
      SET "monthly_price_cents" = '9900', "display_price" = '$99'
      WHERE "plan_type" = 'pro'
    `);
  }
}
