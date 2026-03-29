/**
 * Seed script: inserts demo leads for marketplace, distribution, and (optionally) purchase history.
 *
 * Run from `apps/api` (requires DATABASE_URL in `.env` and migrations applied):
 *   npm run seed:leads
 *
 * Idempotent: removes any lead whose `external_id` starts with `seed-`, then re-inserts.
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
] as const;

function tierFor(score: number, exclusivity: ExclusivityLevel): 'premium' | 'standard' | 'value' {
  if (exclusivity === ExclusivityLevel.EXCLUSIVE || score >= 80) return 'premium';
  if (score >= 55) return 'standard';
  return 'value';
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

  const demoAddresses: Array<{ street: string; city: string; state: string; zip: string }> = [
    { street: '1842 W Elm St', city: 'Phoenix', state: 'AZ', zip: '85009' },
    { street: '920 Maple Ave', city: 'Dallas', state: 'TX', zip: '75208' },
    { street: '55 Briar Hollow Ln', city: 'Houston', state: 'TX', zip: '77027' },
    { street: '410 Peachtree St NE', city: 'Atlanta', state: 'GA', zip: '30308' },
    { street: '7711 W Sahara Ave', city: 'Las Vegas', state: 'NV', zip: '89117' },
    { street: '2908 N Florida Ave', city: 'Tampa', state: 'FL', zip: '33602' },
    { street: '1450 Brickell Ave', city: 'Miami', state: 'FL', zip: '33131' },
    { street: '1624 Market St', city: 'Denver', state: 'CO', zip: '80202' },
    { street: '400 Pine St', city: 'Seattle', state: 'WA', zip: '98101' },
    { street: '233 S Wacker Dr', city: 'Chicago', state: 'IL', zip: '60606' },
  ];

  const availableLeads: Partial<Lead>[] = [];
  let idx = 0;
  for (let m = 0; m < MARKETS.length; m++) {
    for (let t = 0; t < LEAD_TYPES.length; t++) {
      if (availableLeads.length >= 28) break;
      const market = MARKETS[m];
      const leadType = LEAD_TYPES[t];
      const exclusivity =
        idx % 5 === 0
          ? ExclusivityLevel.EXCLUSIVE
          : idx % 3 === 0
            ? ExclusivityLevel.SEMI_EXCLUSIVE
            : ExclusivityLevel.SHARED;
      const quality = 42 + ((idx * 7) % 49);
      const priceCents = String(15_000 + ((idx * 3_700) % 185_000));
      const anchorExtra = idx % 4 === 0 ? 12_000 : 0;
      const anchor = String(Number(priceCents) + anchorExtra);
      const addr = demoAddresses[idx % demoAddresses.length];
      const title = `${addr.street}, ${addr.city}, ${addr.state}`;

      availableLeads.push({
        external_id: `${SEED_EXTERNAL_ID_PREFIX}avail-${idx + 1}`,
        source: 'seed',
        market,
        lead_type: leadType,
        status: LeadStatus.AVAILABLE,
        exclusivity_level: exclusivity,
        quality_score: quality,
        price_cents: priceCents,
        list_price_anchor_cents: anchorExtra ? anchor : null,
        marketplace_tier: tierFor(quality, exclusivity),
        distribution_run_count: 0,
        last_distribution_at: null,
        title,
        metadata: {
          address: title,
          street: addr.street,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
          seed_index: idx,
        },
        reserved_until: null,
        acquired_at: null,
      });
      idx++;
    }
    if (availableLeads.length >= 28) break;
  }

  await leadRepo.save(availableLeads.map((row) => leadRepo.create(row)));
  console.log(`Inserted ${availableLeads.length} AVAILABLE marketplace leads.`);

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

  await dataSource.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
