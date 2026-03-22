import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

dotenv.config({ path: '.env' });

// #region agent log
(() => {
  const payload = {
    sessionId: 'ca5ac8',
    runId: 'pre-fix',
    hypothesisId: 'H_tsconfig_not_used',
    location: 'src/database/data-source.ts:__INIT__',
    message: 'Migration CLI runtime context',
    data: {
      cwd: process.cwd(),
      tsNodeProject: process.env.TS_NODE_PROJECT ?? null,
      tsNodeCompilerOptions: process.env.TS_NODE_COMPILER_OPTIONS ?? null,
      nodeOptions: process.env.NODE_OPTIONS ?? null,
      argv: process.argv.slice(0, 8),
      nodeVersion: process.version,
      hasGlobalFetch: typeof (globalThis as any).fetch === 'function',
      typescriptVersion: (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          return require('typescript').version as string;
        } catch {
          return null;
        }
      })(),
    },
    timestamp: Date.now(),
  };

  fetch('http://127.0.0.1:7674/ingest/59bc3920-30e9-43c7-af4b-f265c5917562', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ca5ac8' },
    body: JSON.stringify(payload),
  }).catch(() => {});

  // Backup: write NDJSON locally for reliability.
  try {
    const logPath = path.resolve(__dirname, '../../../../debug-ca5ac8.log');
    fs.appendFileSync(logPath, JSON.stringify(payload) + '\n', 'utf8');
  } catch {}
})();
// #endregion

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../entities/*.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: true,
});