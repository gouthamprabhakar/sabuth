# Sabuth team sign-in

Five equal-access accounts are supported: Prabhakar, Preetham, Raghu, Junior2 and Junior3. Usernames ignore case and surrounding spaces. Passwords are case-sensitive. Initial passwords were supplied by the owner; they are not stored in source code or this document.

The login page is accessible without a ChatGPT account. Every workspace API read and write requires a valid Sabuth session. The server supplies the username to the existing Google bridge for its Activity journal. Direct Google Sheets/Drive links still follow Google's existing permissions.

## Storage and sessions

`SABUTH_TEAM_CREDENTIALS` is a Sites secret containing a JSON object keyed by the five canonical usernames. Each account contains a 32-character hexadecimal random `salt` and a 64-character hexadecimal `hash`. Hashes use PBKDF2-HMAC-SHA256, 100,000 iterations, 32 output bytes, with the salt string encoded as UTF-8. Passwords never reach browser storage, the repository, or the Google bridge.

D1 stores hashed session tokens and login attempt counters only. Case records remain in Google Sheets and Drive. Sessions expire after seven days, use Secure/HttpOnly/SameSite=Strict cookies in production, and are revoked on sign-out. Updating an account's salt/hash invalidates its existing sessions after the new environment revision is deployed.

Failed login attempts are limited to five per account in a 15-minute window. The counter reservation is atomic, so concurrent attempts cannot bypass the limit. Unknown usernames share one counter. Successful attempts release their reservation. All users have the same permissions, as requested.

## Deployment

1. Generate and inspect the Drizzle migration when the authentication schema changes. Preserve prior applied migrations.
2. Configure the `SABUTH_TEAM_CREDENTIALS` secret and deploy the verified build. Keep existing Google bridge variables.
3. Only after that deployment succeeds, make the login page public through the Sites audience setting. This removes the outer ChatGPT requirement; the app's server still protects case data.
4. Do not roll back to a version without team authentication while the site is public. Restore owner-only access before any such rollback.

## Verification

Run `node --test tests/safety.test.mjs tests/team-auth.test.mjs` and `node node_modules/typescript/bin/tsc --noEmit`, then the Sites build. Authentication tests use an isolated in-memory SQLite database and a mock Google bridge; no live case records or emails are changed.

A real-device pilot is still needed with the five users. Offline case entry, automated case backups and a restore drill remain separate follow-up work; this login release does not claim those capabilities.
