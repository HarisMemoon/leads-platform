import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProPlanPriceUpdate1775700000000 implements MigrationInterface {
  name = 'ProPlanPriceUpdate1775700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "subscription_plans"
      SET "monthly_price_cents" = '9900',
          "display_price" = '$99'
      WHERE "plan_type" = 'pro'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "subscription_plans"
      SET "monthly_price_cents" = '4999',
          "display_price" = '$49.99'
      WHERE "plan_type" = 'pro'
    `);
  }
}
