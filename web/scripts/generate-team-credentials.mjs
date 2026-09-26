import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const names = ['Prabhakar', 'Preetham', 'Raghu', 'Junior2', 'Junior3'];
const terminal = createInterface({ input: process.stdin, output: process.stderr });
const credentials = {};

for (const name of names) {
  const password = await terminal.question(`Password for ${name}: `);
  if (!password) throw new Error(`Password for ${name} cannot be empty.`);
  const salt = randomBytes(16).toString('hex');
  credentials[name] = {
    salt,
    hash: pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex'),
  };
}

terminal.close();
process.stdout.write(`${JSON.stringify(credentials)}\n`);
