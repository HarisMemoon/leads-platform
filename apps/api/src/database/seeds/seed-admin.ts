import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import { WalletAccount } from '../../entities/wallet-account.entity';
import { OnboardingProgress } from '../../entities/onboarding-progress.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEFAULT_ADMIN_EMAIL = 'admin@newleey.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';
const DEFAULT_ADMIN_FULL_NAME = 'Local Admin';
const DEFAULT_ADMIN_COMPANY = 'Newleey Admin';

function readSeedValue(envKey: string, fallback: string): string {
  const value = process.env[envKey]?.trim();
  return value && value.length > 0 ? value : fallback;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Add it to apps/api/.env');
    process.exit(1);
  }

  const email = readSeedValue('ADMIN_SEED_EMAIL', DEFAULT_ADMIN_EMAIL).toLowerCase();
  const password = readSeedValue('ADMIN_SEED_PASSWORD', DEFAULT_ADMIN_PASSWORD);
  const fullName = readSeedValue('ADMIN_SEED_FULL_NAME', DEFAULT_ADMIN_FULL_NAME);
  const companyName = readSeedValue('ADMIN_SEED_COMPANY_NAME', DEFAULT_ADMIN_COMPANY);

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [__dirname + '/../../entities/*.{ts,js}'],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connected.');

  const userRepo = dataSource.getRepository(User);
  const walletRepo = dataSource.getRepository(WalletAccount);
  const onboardingRepo = dataSource.getRepository(OnboardingProgress);

  const passwordHash = await bcrypt.hash(password, 10);
  let user = await userRepo.findOne({ where: { email } });

  if (!user) {
    user = userRepo.create({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      company_name: companyName,
      role: UserRole.ADMIN,
      email_verified: true,
      onboarding_completed: true,
      is_active: true,
    });
    await userRepo.save(user);
    console.log(`Created admin user ${email}.`);
  } else {
    user.role = UserRole.ADMIN;
    user.password_hash = passwordHash;
    user.full_name = user.full_name || fullName;
    user.company_name = user.company_name || companyName;
    user.email_verified = true;
    user.onboarding_completed = true;
    user.is_active = true;
    await userRepo.save(user);
    console.log(`Updated existing user ${email} to admin.`);
  }

  const wallet = await walletRepo.findOne({
    where: { user: { id: user.id } },
    relations: { user: true },
  });
  if (!wallet) {
    await walletRepo.save(
      walletRepo.create({
        user,
        balance_cents: '0',
      }),
    );
    console.log('Created wallet account.');
  }

  const onboarding = await onboardingRepo.findOne({
    where: { user: { id: user.id } },
    relations: { user: true },
  });
  if (!onboarding) {
    await onboardingRepo.save(
      onboardingRepo.create({
        user,
        current_step: 1,
        completed_steps: [],
        data: {},
        completed_at: new Date(),
      }),
    );
    console.log('Created onboarding progress.');
  }

  console.log('');
  console.log('Admin credentials');
  console.log(`  email: ${email}`);
  console.log(`  password: ${password}`);

  await dataSource.destroy();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
