import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * subscription_plans.feature_bullets: string[] → { text, visible }[]
 * so admins can toggle individual bullets. Legacy strings become visible: true.
 */
export class SubscriptionPlanBulletsStructure1775300000000
  implements MigrationInterface
{
  name = 'SubscriptionPlanBulletsStructure1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{
      plan_type: string;
      feature_bullets: unknown;
    }> = await queryRunner.query(
      `SELECT plan_type, feature_bullets FROM subscription_plans`,
    );

    for (const row of rows) {
      const raw = row.feature_bullets;
      const next: Array<{ text: string; visible: boolean }> = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof item === 'string') {
            const t = item.trim();
            if (t.length > 0) next.push({ text: t, visible: true });
          } else if (item && typeof item === 'object' && item !== null && 'text' in item) {
            const t = String((item as { text: unknown }).text).trim();
            const vis =
              'visible' in item
                ? Boolean((item as { visible?: unknown }).visible)
                : true;
            if (t.length > 0) next.push({ text: t, visible: vis });
          }
        }
      }
      await queryRunner.query(
        `UPDATE subscription_plans SET feature_bullets = $1::jsonb WHERE plan_type = $2`,
        [JSON.stringify(next), row.plan_type],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{
      plan_type: string;
      feature_bullets: unknown;
    }> = await queryRunner.query(
      `SELECT plan_type, feature_bullets FROM subscription_plans`,
    );

    for (const row of rows) {
      const raw = row.feature_bullets;
      const texts: string[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof item === 'string') {
            const t = item.trim();
            if (t.length > 0) texts.push(t);
          } else if (item && typeof item === 'object' && item !== null && 'text' in item) {
            const vis =
              'visible' in item
                ? Boolean((item as { visible?: unknown }).visible)
                : true;
            if (!vis) continue;
            const t = String((item as { text: unknown }).text).trim();
            if (t.length > 0) texts.push(t);
          }
        }
      }
      await queryRunner.query(
        `UPDATE subscription_plans SET feature_bullets = $1::jsonb WHERE plan_type = $2`,
        [JSON.stringify(texts), row.plan_type],
      );
    }
  }
}
