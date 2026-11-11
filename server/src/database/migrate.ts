import { join } from 'node:path';

import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';

const logger = new Logger('Migrate');

/** 작업 디렉터리의 `drizzle/`를 적용한다. 운영 이미지는 `/app/server`에서 뜬다. */
export async function applyMigrations(pool: Pool): Promise<void> {
  const folder = join(process.cwd(), 'drizzle');
  await migrate(drizzle(pool), { migrationsFolder: folder });
  logger.log(`Database migrations are current (${folder})`);
}
