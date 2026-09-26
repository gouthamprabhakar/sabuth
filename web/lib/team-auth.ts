import {env} from 'cloudflare:workers';
import {canonicalName, digest, readSessionCookie} from './team-crypto';

export function authDatabase() {
  if (!env.DB) throw new Error('Team sign-in is temporarily unavailable. Please try again.');
  return env.DB;
}
export function credentials(): Record<string, {salt: string; hash: string}> {
  const value = (env as unknown as Record<string, string>).SABUTH_TEAM_CREDENTIALS;
  if (!value) throw new Error('Team sign-in is not configured yet.');
  const result = JSON.parse(value);
  for (const name of ['Prabhakar', 'Preetham', 'Raghu', 'Junior2', 'Junior3']) {
    if (!/^[a-f0-9]{32}$/.test(result[name]?.salt) || !/^[a-f0-9]{64}$/.test(result[name]?.hash)) throw new Error('Team sign-in configuration needs attention.');
  }
  return result;
}
export async function getTeamUser(req: Request) {
  const token = readSessionCookie(req.headers.get('cookie'));
  if (!token) return null;
  const row = await authDatabase().prepare('SELECT username, credential_version FROM team_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await digest(token), Date.now()).first<{username: string; credential_version: string}>();
  if (!row || !canonicalName(row.username)) return null;
  if (row.credential_version !== await digest(JSON.stringify(credentials()[row.username]))) return null;
  return {username: row.username};
}
export function sameOrigin(req: Request) {
  return req.headers.get('origin') === new URL(req.url).origin;
}
