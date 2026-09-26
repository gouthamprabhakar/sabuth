import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../dist/server/wrangler.json', import.meta.url);
const databaseId = process.env.D1_DATABASE_ID?.trim();
const databaseName = process.env.D1_DATABASE_NAME?.trim() || 'sabuth-db';
const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim() || 'sabuth';

if (!databaseId || !/^[0-9a-f-]{36}$/i.test(databaseId)) {
  throw new Error('Set D1_DATABASE_ID to the ID returned by `npx wrangler d1 create sabuth-db`.');
}

const config = JSON.parse(await readFile(path, 'utf8'));
const database = config.d1_databases?.find(item => item.binding === 'DB');
if (!database) throw new Error('The generated Worker configuration has no DB binding.');

config.name = workerName;
database.database_name = databaseName;
database.database_id = databaseId;
await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Prepared ${workerName} with D1 database ${databaseName}.`);
