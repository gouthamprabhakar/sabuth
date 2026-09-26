# Sabuth

This repository is the editable source for the Sabuth legal case-management
application used by Prabhakar Law Group. Google Sheets and Google Drive remain
the production case-data backend. This migration does not move production data
to Firebase and does not replace the existing `sabuth.gaut90.chatgpt.site`
deployment.

## Repository layout

- `web/` — the existing React + TypeScript web application, its components,
  API routes, tests, D1 authentication schema, PWA assets, and build files.
- `google-apps-script/` — the current Google Sheets/Drive bridge and manifest.
- `mobile/` — reserved for a future React Native TypeScript application. The
  current product is the PWA in `web/`; no mobile app was invented during this
  migration.

The source snapshot was copied from the application checkout at commit
`3bbc8dc6ae623504d14281dc387091b31c585044`. Generated folders, installed
dependencies, local databases, and secrets are intentionally excluded.

## Prerequisites

- Git
- Node.js 22.13 or newer
- npm
- A Google account authorized for the existing Apps Script project
- For an independent production deployment: a Cloudflare account

## Clone and run locally on macOS

```bash
git clone https://github.com/gouthamprabhakar/sabuth.git
cd sabuth/web
npm ci
cp .env.example .dev.vars
```

Edit `web/.dev.vars` and replace all placeholders. Then initialize the local
session database and start Sabuth:

```bash
npm run build
npx wrangler d1 execute site-creator-d1 --local --file drizzle/0000_late_the_spike.sql --config dist/server/wrangler.json
npm run dev
```

Open `http://localhost:5173`. After the one-time database initialization, the
normal command for local development is:

```bash
cd sabuth/web && npm run dev
```

The web app reads live case data through the Google Apps Script endpoint named
in `.dev.vars`. Use a test spreadsheet and a separate Apps Script deployment for
local write testing when production writes are not intended.

## Required secrets

No passwords, HMAC secrets, API keys, Google credentials, or private environment
files belong in Git. `.env`, `.env.*`, `.dev.vars*`, credential files, private
keys, local D1 files, and generated build output are ignored.

| Variable | Local location | Independent production location | Source |
| --- | --- | --- | --- |
| `GOOGLE_SCRIPT_URL` | `web/.dev.vars` | Cloudflare Worker secret | Apps Script web-app `/exec` URL |
| `GOOGLE_SCRIPT_SECRET` | `web/.dev.vars` | Cloudflare Worker secret | Must equal Apps Script property `SABUTH_SECRET` |
| `SABUTH_TEAM_CREDENTIALS` | `web/.dev.vars` | Cloudflare Worker secret | Locally generated JSON of salts and password hashes |
| `SABUTH_SECRET` | Never in this repository | Apps Script Project Settings → Script Properties | Private HMAC secret used by the bridge |

Generate a fresh `SABUTH_TEAM_CREDENTIALS` JSON value locally:

```bash
cd web
node scripts/generate-team-credentials.mjs > .team-credentials.tmp
```

The script prompts for each password. Copy the single JSON line from the ignored
temporary file into `.dev.vars` or paste it into the Cloudflare secret prompt,
then delete the temporary file. The application expects the five usernames
`Prabhakar`, `Preetham`, `Raghu`, `Junior2`, and `Junior3`.

## Verify the web source

From `web/`:

```bash
npm ci
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

These checks compile the React/TypeScript source, exercise authentication and
case-save safety, and build the Cloudflare Worker. They do not write test data
to the production spreadsheet or send email.

## Google Apps Script bridge

The editable bridge is in `google-apps-script/Code.gs`; its manifest is
`google-apps-script/appsscript.json`. See
`google-apps-script/SETUP.md` for authorization, migration, deployment, and
schedule details.

To update the existing bridge without changing its URL:

1. Open the existing Apps Script project as `prabhakarlawgroup@gmail.com`.
2. Replace `Code.gs` and `appsscript.json` with the repository versions.
3. Save the project and run any explicitly documented one-time migration.
4. Open **Deploy → Manage deployments**, edit the active web app, choose
   **New version**, preserve **Execute as: Me** and the existing access setting,
   and deploy.
5. Keep the existing deployment ID and `/exec` URL in `GOOGLE_SCRIPT_URL`.

Do not publish `SABUTH_SECRET`, the Worker secret, or Google credentials.

## Deploy without ChatGPT Work

The web app can be deployed directly to Cloudflare Workers. This creates an
independent `workers.dev` URL (or a custom domain you control) and leaves the
existing `sabuth.gaut90.chatgpt.site` deployment available as the fallback.
The `chatgpt.site` hostname itself remains managed by its existing hosting
service and is not overwritten by these commands.

Sign in and create the D1 database once:

```bash
cd web
npx wrangler login
npx wrangler d1 create sabuth-db
```

Copy the returned database ID, then build and prepare the generated Worker
configuration:

```bash
npm ci
npm run build
D1_DATABASE_ID=REPLACE_WITH_DATABASE_ID D1_DATABASE_NAME=sabuth-db CLOUDFLARE_WORKER_NAME=sabuth node scripts/prepare-cloudflare-deploy.mjs
```

Apply the authentication schema once to the production D1 database:

```bash
npx wrangler d1 execute sabuth-db --remote --file drizzle/0000_late_the_spike.sql --config dist/server/wrangler.json
```

Set the three production secrets. Wrangler prompts for each value and does not
store it in the repository:

```bash
npx wrangler secret put GOOGLE_SCRIPT_URL --config dist/server/wrangler.json
npx wrangler secret put GOOGLE_SCRIPT_SECRET --config dist/server/wrangler.json
npx wrangler secret put SABUTH_TEAM_CREDENTIALS --config dist/server/wrangler.json
```

Deploy:

```bash
npx wrangler deploy --config dist/server/wrangler.json
```

For later releases, pull the production branch, run the verification commands,
rebuild, run `prepare-cloudflare-deploy.mjs` with the same D1 values, and deploy.
Do not rerun the first migration after it has already been applied. Add future
Drizzle migrations in order rather than replacing prior files.

## Production branch and safety

The repository's production branch is `main`. Deploy only reviewed commits from
that branch. No command in this migration deletes or disconnects the existing
Sites deployment, Google Sheet, Drive folder, Apps Script project, or its
deployment URL.

Firebase Authentication, Firebase data storage, real-time multi-user conflict
handling, React Native clients, offline operation, and synchronization are
future architecture topics. They are intentionally not implemented here.
