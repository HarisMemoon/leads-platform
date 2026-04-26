/**
 * Resets lead data and inserts demo leads shaped for the Marketplace and My Leads UI.
 *
 * Run from apps/api:
 *   npm run seed:leads
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { DataSource } from 'typeorm';
import { Lead } from '../../entities/lead.entity';
import { LeadAssignment } from '../../entities/lead-assignment.entity';
import { LeadAssignmentEvent } from '../../entities/lead-assignment-event.entity';
import { User } from '../../entities/user.entity';
import { LeadStatus } from '../../../common/enums/lead-status.enum';
import { ExclusivityLevel } from '../../../common/enums/exclusivity-level.enum';
import { PurchaseType } from '../../../common/enums/purchase-type.enum';
import { CrmSyncStatus } from '../../../common/enums/crm-sync-status.enum';
import { GhlSyncStatus } from '../../../common/enums/ghl-sync-status.enum';
import { UserRole } from '../../../common/enums/user-role.enum';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type DemoLead = {
  category: 'premium' | 'exclusive';
  name: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  leadType: string;
  propertyType: string;
  timeline: string;
  condition: string;
  priceCents: string;
  quality: number;
};

const baseMarketplaceLeads: DemoLead[] = [
  {
    category: 'premium',
    name: 'Marcus Reed',
    phone: '(602) 555-0184',
    email: 'marcus.reed@example.com',
    street: '1428 W Pierce St',
    city: 'Phoenix',
    state: 'AZ',
    zip: '85007',
    leadType: 'motivated_seller',
    propertyType: 'Single family',
    timeline: '0-30 days',
    condition: 'Needs light repairs',
    priceCents: '8900',
    quality: 86,
  },
  {
    category: 'premium',
    name: 'Angela Porter',
    phone: '(214) 555-0138',
    email: 'angela.porter@example.com',
    street: '907 N Bishop Ave',
    city: 'Dallas',
    state: 'TX',
    zip: '75208',
    leadType: 'probate',
    propertyType: 'Duplex',
    timeline: '30-60 days',
    condition: 'Vacant, deferred maintenance',
    priceCents: '11200',
    quality: 81,
  },
  {
    category: 'premium',
    name: 'Derrick Shaw',
    phone: '(813) 555-0199',
    email: 'derrick.shaw@example.com',
    street: '3312 W San Carlos St',
    city: 'Tampa',
    state: 'FL',
    zip: '33629',
    leadType: 'pre_foreclosure',
    propertyType: 'Townhome',
    timeline: 'ASAP',
    condition: 'Owner occupied, needs roof',
    priceCents: '12900',
    quality: 84,
  },
  {
    category: 'premium',
    name: 'Tanya Brooks',
    phone: '(704) 555-0116',
    email: 'tanya.brooks@example.com',
    street: '518 E 35th St',
    city: 'Charlotte',
    state: 'NC',
    zip: '28205',
    leadType: 'vacant_property',
    propertyType: 'Single family',
    timeline: '60-90 days',
    condition: 'Vacant, cosmetic rehab',
    priceCents: '7600',
    quality: 77,
  },
  {
    category: 'exclusive',
    name: 'Evelyn Harris',
    phone: '(702) 555-0144',
    email: 'evelyn.harris@example.com',
    street: '7468 Desert Bloom Ave',
    city: 'Las Vegas',
    state: 'NV',
    zip: '89117',
    leadType: 'absentee_owner',
    propertyType: 'Single family',
    timeline: '0-14 days',
    condition: 'High equity, clean interior',
    priceCents: '21900',
    quality: 92,
  },
  {
    category: 'exclusive',
    name: 'Carlos Vega',
    phone: '(305) 555-0177',
    email: 'carlos.vega@example.com',
    street: '1221 SW 11th Ter',
    city: 'Miami',
    state: 'FL',
    zip: '33135',
    leadType: 'divorce',
    propertyType: 'Condo',
    timeline: '0-30 days',
    condition: 'Updated, motivated to sell',
    priceCents: '24500',
    quality: 90,
  },
  {
    category: 'exclusive',
    name: 'Priya Nair',
    phone: '(720) 555-0129',
    email: 'priya.nair@example.com',
    street: '2840 W 29th Ave',
    city: 'Denver',
    state: 'CO',
    zip: '80211',
    leadType: 'inherited',
    propertyType: 'Triplex',
    timeline: '30 days',
    condition: 'Estate sale, dated units',
    priceCents: '26500',
    quality: 88,
  },
  {
    category: 'exclusive',
    name: 'James Wilson',
    phone: '(206) 555-0191',
    email: 'james.wilson@example.com',
    street: '4407 S Brandon St',
    city: 'Seattle',
    state: 'WA',
    zip: '98118',
    leadType: 'tax_delinquent',
    propertyType: 'Single family',
    timeline: '45 days',
    condition: 'Behind taxes, tenant occupied',
    priceCents: '23800',
    quality: 87,
  },
];

const extraMarkets = [
  { city: 'Atlanta', state: 'GA', zip: '30308' },
  { city: 'Austin', state: 'TX', zip: '78704' },
  { city: 'Chicago', state: 'IL', zip: '60618' },
  { city: 'Houston', state: 'TX', zip: '77007' },
  { city: 'Nashville', state: 'TN', zip: '37203' },
  { city: 'Orlando', state: 'FL', zip: '32803' },
  { city: 'Portland', state: 'OR', zip: '97205' },
  { city: 'Raleigh', state: 'NC', zip: '27601' },
];

const extraNames = [
  'Adrian Price',
  'Bianca Stone',
  'Caleb Morgan',
  'Danielle Kim',
  'Ethan Flores',
  'Felicia Moore',
  'Gavin Ross',
  'Hannah Young',
  'Isaac Bennett',
  'Jasmine Clark',
  'Keira Ellis',
  'Landon Ford',
  'Maya Hughes',
  'Noah Jenkins',
  'Riley Knight',
  'Sofia Lewis',
  'Trevor Martin',
  'Uma Nelson',
  'Victor Owens',
  'Willow Parker',
  'Xavier Quinn',
  'Yara Russell',
  'Zane Simmons',
  'Avery Turner',
];

const streets = [
  'Oak',
  'Maple',
  'Cedar',
  'Pine',
  'Elm',
  'River',
  'Park',
  'Lake',
  'Hill',
  'Sunset',
  'Walnut',
  'Spruce',
];

const leadTypes = [
  'motivated_seller',
  'probate',
  'pre_foreclosure',
  'vacant_property',
  'absentee_owner',
  'divorce',
  'inherited',
  'tax_delinquent',
];

const propertyTypes = [
  'Single family',
  'Duplex',
  'Townhome',
  'Condo',
  'Triplex',
  'Small multifamily',
];

const timelines = ['ASAP', '0-14 days', '0-30 days', '30 days', '30-60 days', '60-90 days'];

const conditions = [
  'Needs light repairs',
  'Vacant, deferred maintenance',
  'Owner occupied, needs roof',
  'Cosmetic rehab',
  'High equity, clean interior',
  'Tenant occupied',
  'Estate sale, dated interior',
  'Behind taxes, motivated',
];

const marketplaceLeads: DemoLead[] = [
  ...baseMarketplaceLeads,
  ...Array.from({ length: 24 }, (_, index): DemoLead => {
    const market = extraMarkets[index % extraMarkets.length];
    const name = extraNames[index];
    const streetName = streets[index % streets.length];
    const category = index % 3 === 0 ? 'exclusive' : 'premium';
    const priceCents = category === 'exclusive' ? 19500 + index * 450 : 6900 + index * 325;

    return {
      category,
      name,
      phone: `(${200 + (index % 700)}) 555-${String(2000 + index).padStart(4, '0')}`,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      street: `${1000 + index * 37} ${streetName} Ave`,
      city: market.city,
      state: market.state,
      zip: market.zip,
      leadType: leadTypes[index % leadTypes.length],
      propertyType: propertyTypes[index % propertyTypes.length],
      timeline: timelines[index % timelines.length],
      condition: conditions[index % conditions.length],
      priceCents: String(priceCents),
      quality: category === 'exclusive' ? 88 + (index % 8) : 72 + (index % 15),
    };
  }),
];

const lifecyclePhases = ['open', 'contacted', 'under_contract', 'closed_won'] as const;
const lifecycleLeads: Array<DemoLead & {
  phase: 'open' | 'contacted' | 'under_contract' | 'closed_won';
  contractPriceCents: string | null;
  sellPriceCents: string | null;
  crm: CrmSyncStatus;
  ghl: GhlSyncStatus;
}> = Array.from({ length: 30 }, (_, index) => {
  const source = marketplaceLeads[index % marketplaceLeads.length];
  const phase = lifecyclePhases[index % lifecyclePhases.length];
  const contractPrice =
    phase === 'under_contract' || phase === 'closed_won'
      ? 18500000 + index * 725000
      : null;
  const sellPrice = phase === 'closed_won' && contractPrice ? contractPrice + 3250000 : null;
  const displayName = `${source.name.split(' ')[0]} ${index + 11}`;

  return {
    ...source,
    name: displayName,
    phone: `(${300 + (index % 600)}) 555-${String(3100 + index).padStart(4, '0')}`,
    email: `${displayName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    street: `${2100 + index * 29} ${streets[index % streets.length]} Dr`,
    phase,
    contractPriceCents: contractPrice ? String(contractPrice) : null,
    sellPriceCents: sellPrice ? String(sellPrice) : null,
    crm:
      index % 9 === 0
        ? CrmSyncStatus.FAILED
        : index % 5 === 0
          ? CrmSyncStatus.PENDING
          : CrmSyncStatus.SYNCED,
    ghl:
      index % 10 === 0
        ? GhlSyncStatus.FAILED
        : index % 4 === 0
          ? GhlSyncStatus.PENDING
          : GhlSyncStatus.SYNCED,
  };
});

function metadataFor(row: DemoLead) {
  const fullAddress = `${row.street}, ${row.city}, ${row.state} ${row.zip}`;
  return {
    name: row.name,
    full_name: row.name,
    phone: row.phone,
    email: row.email,
    address: fullAddress,
    full_address: fullAddress,
    street: row.street,
    city: row.city,
    state: row.state,
    zip: row.zip,
    property_type: row.propertyType,
    timeline: row.timeline,
    condition: row.condition,
  };
}

function marketFor(row: DemoLead) {
  return `${row.city}, ${row.state}`;
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

  await dataSource.transaction(async (manager) => {
    await manager.createQueryBuilder().delete().from(LeadAssignmentEvent).execute();
    await manager.createQueryBuilder().delete().from(LeadAssignment).execute();
    await manager.createQueryBuilder().delete().from(Lead).execute();
    console.log('Deleted all existing lead data.');

    const leadRepo = manager.getRepository(Lead);
    const assignmentRepo = manager.getRepository(LeadAssignment);
    const eventRepo = manager.getRepository(LeadAssignmentEvent);
    const userRepo = manager.getRepository(User);

    const available = marketplaceLeads.map((row, index) =>
      leadRepo.create({
        external_id: `mock-marketplace-${index + 1}`,
        source: 'mock_seed',
        market: marketFor(row),
        lead_type: row.leadType,
        status: LeadStatus.AVAILABLE,
        exclusivity_level:
          row.category === 'exclusive'
            ? ExclusivityLevel.EXCLUSIVE
            : ExclusivityLevel.SHARED,
        quality_score: row.quality,
        price_cents: row.priceCents,
        list_price_anchor_cents: String(Number(row.priceCents) + 4000),
        marketplace_tier: row.category === 'exclusive' ? 'premium' : 'standard',
        title: `${row.propertyType} lead in ${row.city}, ${row.state}`,
        metadata: metadataFor(row),
        canonical_lead_source: null,
        utm: {},
        distribution_run_count: 0,
        last_distribution_at: null,
        reserved_by_user: null,
        reserved_until: null,
        acquired_at: null,
      }),
    );

    await leadRepo.save(available);

    const buyers = await userRepo.find({
      where: { role: UserRole.BUYER },
      order: { created_at: 'ASC' },
    });

    for (const buyer of buyers) {
      const purchasedLeads = lifecycleLeads.map((row, index) =>
        leadRepo.create({
          external_id: `mock-my-leads-${buyer.id}-${index + 1}`,
          source: 'mock_seed',
          market: marketFor(row),
          lead_type: row.leadType,
          status: LeadStatus.SOLD,
          exclusivity_level:
            row.category === 'exclusive'
              ? ExclusivityLevel.EXCLUSIVE
              : ExclusivityLevel.SHARED,
          quality_score: row.quality,
          price_cents: row.priceCents,
          list_price_anchor_cents: null,
          marketplace_tier: row.category === 'exclusive' ? 'premium' : 'standard',
          title: `${row.propertyType} purchased lead in ${row.city}, ${row.state}`,
          metadata: metadataFor(row),
          canonical_lead_source: null,
          utm: {},
          acquired_at: new Date(),
        }),
      );

      const savedPurchased = await leadRepo.save(purchasedLeads);
      const assignments = await assignmentRepo.save(
        savedPurchased.map((lead, index) => {
          const row = lifecycleLeads[index];
          return assignmentRepo.create({
            lead,
            buyer,
            purchase_type:
              index % 2 === 0
                ? PurchaseType.MANUAL
                : PurchaseType.AUTO_BUY,
            amount_charged_cents: lead.price_cents,
            wallet_transaction: null,
            ghl_sync_status: row.ghl,
            crm_sync_status: row.crm,
            disposition: null,
            lifecycle_phase: row.phase,
            contract_price_cents: row.contractPriceCents,
            sell_price_cents: row.sellPriceCents,
            buyer_notes:
              row.phase === 'open'
                ? 'New mock lead. Call and qualify motivation.'
                : row.phase === 'contacted'
                  ? 'Seller answered. Follow-up scheduled.'
                  : row.phase === 'under_contract'
                    ? 'Contract sent and pricing under review.'
                    : 'Closed mock deal. Track final resale spread.',
          });
        }),
      );

      await eventRepo.save(
        assignments.map((assignment) =>
          eventRepo.create({
            assignment,
            event_type: 'mock_seed_created',
            body: {
              lifecycle_phase: assignment.lifecycle_phase,
              crm_sync_status: assignment.crm_sync_status,
              ghl_sync_status: assignment.ghl_sync_status,
            },
          }),
        ),
      );

      console.log(`Inserted ${lifecycleLeads.length} purchased mock leads for ${buyer.email}.`);
    }

    console.log(`Inserted ${available.length} marketplace mock leads.`);
    if (buyers.length === 0) {
      console.log('No buyer users found, so My Leads mock assignments were skipped.');
    }
  });

  await dataSource.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
