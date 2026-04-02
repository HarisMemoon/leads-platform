import 'reflect-metadata';
import * as dns from 'node:dns';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dns.setDefaultResultOrder('ipv4first');

dotenv.config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../entities/*.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: true,
});