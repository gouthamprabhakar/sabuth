import {authDatabase, credentials, getTeamUser, sameOrigin} from '@/lib/team-auth';
import {canonicalName, digest, equalHash, hex, passwordHash, readSessionCookie, sessionCookie} from '@/lib/team-crypto';
export const dynamic = 'force-dynamic';
function reply(value: unknown, status = 200, cookie?: string) {
  return Response.json(value, {status, headers: {'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', ...(cookie ? {'Set-Cookie': cookie} : {})}});
}
export async function GET(req: Request) {
  try { return reply({user: await getTeamUser(req)}); }
  catch { return reply({error: 'Team sign-in is temporarily unavailable. Please try again.'}, 503); }
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({error: 'Request origin is not allowed.'}, 403);
  try {
    const text = await req.text();
    if (text.length > 1024) return reply({error: 'Sign-in request is too large.'}, 413);
    let input;
    try { input = JSON.parse(text); } catch { return reply({error: 'Enter your username and password.'}, 400); }
    const username = canonicalName(input?.username);
    if (typeof input?.password !== 'string' || input.password.length > 128) return reply({error: 'Enter your username and password.'}, 400);
    const db = authDatabase(), accounts = credentials(), now = Date.now();
    // Reserve an attempt atomically before checking the password, including concurrent requests.
    const limit = await db.prepare(`INSERT INTO team_login_limits (username, attempts, window_start) VALUES (?, 1, ?)
      ON CONFLICT(username) DO UPDATE SET attempts = CASE WHEN window_start <= ? THEN 1 ELSE attempts + 1 END,
      window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END RETURNING attempts, window_start`)
      .bind(username || 'unknown', now, now - 900000, now - 900000).first<{attempts: number; window_start: number}>();
    if (!limit || limit.attempts > 5) return reply({error: 'Too many sign-in attempts. Please wait 15 minutes and try again.'}, 429);
    const account = accounts[username || 'Prabhakar'];
    const calculated = await passwordHash(input.password, account.salt);
    if (!username || !equalHash(calculated, account.hash)) return reply({error: 'The username or password is incorrect.'}, 401);
    const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
    await db.batch([
      db.prepare('UPDATE team_login_limits SET attempts = MAX(0, attempts - 1) WHERE username = ? AND window_start = ?').bind(username, limit.window_start),
      db.prepare('DELETE FROM team_sessions WHERE expires_at <= ?').bind(now),
      db.prepare('INSERT INTO team_sessions (token_hash, username, credential_version, expires_at) VALUES (?, ?, ?, ?)')
        .bind(await digest(token), username, await digest(JSON.stringify(account)), now + 604800000),
    ]);
    return reply({user: {username}}, 200, sessionCookie(token, new URL(req.url).protocol === 'https:'));
  } catch { return reply({error: 'Team sign-in is temporarily unavailable. Please try again.'}, 503); }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return reply({error: 'Request origin is not allowed.'}, 403);
  try {
    const token = readSessionCookie(req.headers.get('cookie'));
    if (token) await authDatabase().prepare('DELETE FROM team_sessions WHERE token_hash = ?').bind(await digest(token)).run();
    return reply({ok: true}, 200, sessionCookie('', new URL(req.url).protocol === 'https:', 0));
  } catch { return reply({error: 'Could not sign out. Please try again.'}, 503); }
}
