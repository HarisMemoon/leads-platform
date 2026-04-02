/**
 * Seed script: inserts demo leads for marketplace filters, distribution, and purchase history.
 *
 * Run from `apps/api` (requires DATABASE_URL in `.env` and migrations applied):
 *   npm run seed:leads
 *
 * Idempotent: removes any lead whose `external_id` starts with `seed-`, then re-inserts.
 *
 * Coverage for client testing:
 * - Markets & lead types: full cross-product (every filter combo has hits)
 * - Price: buckets below / around / above typical max slider ($250) and wide range for min/max
 * - Exclusivity & tier: premium / standard / value spread
 * - Age: staggered `created_at` so "max age days" filter is testable
 * - LeadStatus: NEW, RESERVED, DISTRIBUTED, ARCHIVED (+ existing AVAILABLE / SOLD)
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import { Lead } from '../../entities/lead.entity';
import { User } from '../../entities/user.entity';
import { LeadAssignment } from '../../entities/lead-assignment.entity';
import { LeadStatus } from '../../../common/enums/lead-status.enum';
import { ExclusivityLevel } from '../../../common/enums/exclusivity-level.enum';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PurchaseType } from '../../../common/enums/purchase-type.enum';
import { GhlSyncStatus } from '../../../common/enums/ghl-sync-status.enum';
import { CrmSyncStatus } from '../../../common/enums/crm-sync-status.enum';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SEED_EXTERNAL_ID_PREFIX = 'seed-';

/** Matches typical marketplace / distribution filter strings */
const MARKETS = [
  'Phoenix, AZ',
  'Dallas, TX',
  'Houston, TX',
  'Atlanta, GA',
  'Las Vegas, NV',
  'Tampa, FL',
  'Miami, FL',
  'Denver, CO',
  'Seattle, WA',
  'Chicago, IL',
  'Austin, TX',
  'Orlando, FL',
  'Nashville, TN',
  'Charlotte, NC',
  'Portland, OR',
] as const;

const LEAD_TYPES = [
  'motivated_seller',
  'probate',
  'foreclosure',
  'tax_delinquent',
  'pre_foreclosure',
  'vacant_property',
  'inherited',
  'divorce',
  'absentee_owner',
  'distressed',
  'high_equity',
  'reo',
  'wholesale',
  'code_violation',
  'estate_sale',
] as const;

function tierFor(score: number, exclusivity: ExclusivityLevel): 'premium' | 'standard' | 'value' {
  if (exclusivity === ExclusivityLevel.EXCLUSIVE || score >= 80) return 'premium';
  if (score >= 55) return 'standard';
  return 'value';
}

/** Price in cents — spread for min/max & default $250 slider tests */
function priceCentsForIndex(idx: number): string {
  const bucket = idx % 11;
  const bases = [
    4_900, // under $50
    7_500,
    12_000, // ~$120
    18_000,
    24_000, // just under $250
    25_000, // exactly $250
    32_000,
    55_000,
    89_000,
    150_000,
    280_000, // high-ticket
  ];
  const jitter = ((idx * 7919) % 2_400) - 1_200; // ±$12
  const v = Math.max(2_500, bases[bucket] + jitter);
  return String(v);
}

function exclusivityForIndex(idx: number): ExclusivityLevel {
  if (idx % 7 === 0) return ExclusivityLevel.EXCLUSIVE;
  if (idx % 4 === 0) return ExclusivityLevel.SEMI_EXCLUSIVE;
  return ExclusivityLevel.SHARED;
}

/** Days since created — mix so "max age days" returns subsets */
function ageDaysForIndex(idx: number): number {
  const r = idx % 23;
  if (r < 8) return 0;
  if (r < 11) return 2;
  if (r < 14) return 5;
  if (r < 16) return 9;
  if (r < 18) return 14;
  if (r < 20) return 21;
  if (r < 22) return 35;
  return 55;
}

function parseMarketCityState(market: string): { city: string; state: string } {
  const parts = market.split(',').map((s) => s.trim());
  return { city: parts[0] ?? market, state: parts[1] ?? '' };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Add it to apps/api/.env');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [__dirname + '/../../entities/*.{ts,js}'],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connected.');

  const leadRepo = dataSource.getRepository(Lead);
  const userRepo = dataSource.getRepository(User);
  const assignmentRepo = dataSource.getRepository(LeadAssignment);

  const removed = await leadRepo
    .createQueryBuilder()
    .delete()
    .from(Lead)
    .where('external_id LIKE :prefix', { prefix: `${SEED_EXTERNAL_ID_PREFIX}%` })
    .execute();
  console.log(`Removed ${removed.affected ?? 0} previous seed lead(s).`);

  const zipByState: Record<string, string> = {
    AZ: '85009',
    TX: '75208',
    GA: '30308',
    NV: '89117',
    FL: '33602',
    CO: '80202',
    WA: '98101',
    IL: '60606',
    TN: '37203',
    NC: '28202',
    OR: '97205',
  };

  const availableLeads: Partial<Lead>[] = [];
  let idx = 0;

  for (const market of MARKETS) {
    for (const leadType of LEAD_TYPES) {
      const { city, state } = parseMarketCityState(market);
      const zip = zipByState[state] ?? '00000';
      const streetNum = 1200 + (idx % 900);
      const streetNames = ['Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Park', 'Lake', 'River'];
      const street = `${streetNum} ${streetNames[idx % streetNames.length]} St`;
      const exclusivity = exclusivityForIndex(idx);
      const quality = 38 + ((idx * 11) % 55);
      const priceCents = priceCentsForIndex(idx);
      const withAnchor = idx % 3 === 0;
      const anchorExtra = withAnchor ? 15_000 + (idx % 8) * 2_500 : 0;
      const anchor = withAnchor ? String(Number(priceCents) + anchorExtra) : null;
      const title = `${street}, ${city}, ${state}`;
      const ageDays = ageDaysForIndex(idx);

      availableLeads.push({
        external_id: `${SEED_EXTERNAL_ID_PREFIX}avail-${idx + 1}`,
        source: 'seed',
        market,
        lead_type: leadType,
        status: LeadStatus.AVAILABLE,
        exclusivity_level: exclusivity,
        quality_score: quality,
        price_cents: priceCents,
        list_price_anchor_cents: anchor,
        marketplace_tier: tierFor(quality, exclusivity),
        distribution_run_count: 0,
        last_distribution_at: null,
        title,
        metadata: {
          address: title,
          street,
          city,
          state,
          zip,
          seed_index: idx,
          demo_age_days: ageDays,
        },
        reserved_until: null,
        acquired_at: null,
      });
      idx++;
    }
  }

  await leadRepo.save(availableLeads.map((row) => leadRepo.create(row)));

  /** Ensure listing age reflects `demo_age_days` (CreateDateColumn can ignore manual timestamps on insert). */
  await dataSource.query(
    `UPDATE leads SET
      created_at = NOW() - (COALESCE((metadata->>'demo_age_days')::int, 0) * INTERVAL '1 day'),
      updated_at = CURRENT_TIMESTAMP
     WHERE external_id LIKE $1`,
    [`${SEED_EXTERNAL_ID_PREFIX}avail-%`],
  );

  const span = await leadRepo
    .createQueryBuilder('l')
    .select('MIN(l.created_at)', 'min')
    .addSelect('MAX(l.created_at)', 'max')
    .where('l.external_id LIKE :p', { p: `${SEED_EXTERNAL_ID_PREFIX}avail-%` })
    .getRawOne<{ min: Date; max: Date }>();
  console.log(
    `Inserted ${availableLeads.length} AVAILABLE leads (${MARKETS.length} markets × ${LEAD_TYPES.length} lead types).`,
  );
  console.log(
    `  Listing age filter: created_at ranges from ${span?.min?.toISOString?.() ?? span?.min} to ${span?.max?.toISOString?.() ?? span?.max}`,
  );

  const buyer = await userRepo.findOne({
    where: { role: UserRole.BUYER },
    order: { created_at: 'ASC' },
  });

  if (buyer) {
    const past1 = leadRepo.create({
      external_id: `${SEED_EXTERNAL_ID_PREFIX}sold-manual-1`,
      source: 'seed',
      market: 'Nashville, TN',
      lead_type: 'motivated_seller',
      status: LeadStatus.SOLD,
      exclusivity_level: ExclusivityLevel.SHARED,
      quality_score: 72,
      price_cents: '8900',
      list_price_anchor_cents: '12000',
      marketplace_tier: 'standard',
      title: '612 Rep John Lewis Way S, Nashville, TN',
      metadata: {
        address: '612 Rep John Lewis Way S, Nashville, TN',
        seed: true,
      },
    });
    const past2 = leadRepo.create({
      external_id: `${SEED_EXTERNAL_ID_PREFIX}sold-auto-1`,
      source: 'seed',
      market: 'Charlotte, NC',
      lead_type: 'probate',
      status: LeadStatus.SOLD,
      exclusivity_level: ExclusivityLevel.SEMI_EXCLUSIVE,
      quality_score: 81,
      price_cents: '12400',
      list_price_anchor_cents: null,
      marketplace_tier: 'premium',
      title: '201 S College St, Charlotte, NC',
      metadata: {
        address: '201 S College St, Charlotte, NC',
        seed: true,
      },
    });
    const [savedManual, savedAuto] = await leadRepo.save([past1, past2]);

    await assignmentRepo.save([
      assignmentRepo.create({
        lead: savedManual,
        buyer,
        purchase_type: PurchaseType.MANUAL,
        amount_charged_cents: savedManual.price_cents,
        wallet_transaction: null,
        ghl_sync_status: GhlSyncStatus.SYNCED,
        crm_sync_status: CrmSyncStatus.SYNCED,
        disposition: null,
        lifecycle_phase: 'contacted',
      }),
      assignmentRepo.create({
        lead: savedAuto,
        buyer,
        purchase_type: PurchaseType.AUTO_BUY,
        amount_charged_cents: savedAuto.price_cents,
        wallet_transaction: null,
        ghl_sync_status: GhlSyncStatus.PENDING,
        crm_sync_status: CrmSyncStatus.PENDING,
        disposition: null,
        lifecycle_phase: 'new',
      }),
    ]);
    console.log(
      `Inserted 2 SOLD leads + assignments for buyer ${buyer.email} (visible on /leads).`,
    );
  } else {
    console.log(
      'No buyer user found — skipped seed purchases. Register a buyer account to test /leads history.',
    );
  }

  /** One lead per non-marketplace status for admin / “my leads” / metrics testing */
  const statusShowcaseBase = {
    source: 'seed',
    market: 'Phoenix, AZ',
    lead_type: 'motivated_seller',
    exclusivity_level: ExclusivityLevel.SHARED,
    quality_score: 65,
    price_cents: '15000',
    list_price_anchor_cents: null,
    marketplace_tier: 'standard',
    title: 'Status showcase — Phoenix, AZ',
    metadata: { address: 'Status showcase — Phoenix, AZ', seed_status_row: true },
  };

  const statusRows: Partial<Lead>[] = [
    {
      ...statusShowcaseBase,
      external_id: `${SEED_EXTERNAL_ID_PREFIX}status-new`,
      status: LeadStatus.NEW,
      title: 'Seed NEW — Phoenix, AZ',
      distribution_run_count: 0,
      last_distribution_at: null,
      reserved_until: null,
      acquired_at: null,
    },
    {
      ...statusShowcaseBase,
      external_id: `${SEED_EXTERNAL_ID_PREFIX}status-distributed`,
      status: LeadStatus.DISTRIBUTED,
      title: 'Seed DISTRIBUTED — Phoenix, AZ',
      distribution_run_count: 4,
      last_distribution_at: new Date(),
      reserved_until: null,
      acquired_at: null,
    },
    {
      ...statusShowcaseBase,
      external_id: `${SEED_EXTERNAL_ID_PREFIX}status-archived`,
      status: LeadStatus.ARCHIVED,
      title: 'Seed ARCHIVED — Phoenix, AZ',
      distribution_run_count: 0,
      last_distribution_at: null,
      reserved_until: null,
      acquired_at: null,
    },
  ];

  if (buyer) {
    statusRows.push({
      ...statusShowcaseBase,
      external_id: `${SEED_EXTERNAL_ID_PREFIX}status-reserved`,
      status: LeadStatus.RESERVED,
      title: 'Seed RESERVED — Phoenix, AZ',
      reserved_by_user: buyer,
      reserved_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      distribution_run_count: 0,
      last_distribution_at: null,
      acquired_at: null,
    });
  }

  await leadRepo.save(statusRows.map((row) => leadRepo.create(row)));
  console.log(
    `Inserted ${statusRows.length} status-showcase lead(s) (NEW, DISTRIBUTED, ARCHIVED${buyer ? ', RESERVED' : ''}).`,
  );

  await dataSource.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
