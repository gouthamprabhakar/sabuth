# LawPal · Google Sheets and Drive bridge

Google Sheets is LawPal's production case database. Google Drive stores the
client folders and status-history documents. No AI service is used for normal
reads or saves.

## Existing production resources

- Master spreadsheet: `MASTER CASE REGISTER - PROTOTYPE`
- Spreadsheet ID: `1VgPwvFufx8UBz5JKMpZDWjJ9Z6FVoR9H73R9eDEC1u0`
- Apps Script project: the existing project under
  `prabhakarlawgroup@gmail.com`
- Client-folder root: configured as `ACTIVE_FOLDER` in `Code.gs`
- Legacy recovery backup: `Sabuth backup before simplified workflow 2026-09-28`

The public app name is LawPal. Existing `Sabuth Activity`, `Sabuth Documents`
and `Sabuth Reviews` sheet names and the `SABUTH_SECRET` environment name are
retained as internal compatibility identifiers.

## One-time authorization or a fresh installation

1. Sign into Google Apps Script as `prabhakarlawgroup@gmail.com`.
2. Open the existing Apps Script project. For a fresh copy, create a project
   named `LawPal — Prabhakar Law Group`.
3. Replace `Code.gs` and `appsscript.json` with the repository versions. The
   project timezone must be `Asia/Kolkata`.
4. Run `setupLawPal`. The older `setupSabuth` function remains as a compatible
   alias. Review Google's requested permissions yourself.
5. Store the generated `SABUTH_SECRET` Script Property securely. It must match
   the website secret named `GOOGLE_SCRIPT_SECRET`.
6. Add `ECOURTSINDIA_API_TOKEN` under Project Settings → Script Properties.
   Use the same eCourts Partner API token configured as the Site's server-side
   secret. Never place the token in `Code.gs` or a Sheet cell.
7. Update the existing web-app deployment with a new version. Preserve its
   deployment ID, Execute as Me setting and current access setting so the
   `/exec` URL does not change.

## Current data model

`Case Register` is the complete list of matters. Each row is one case. A matter
is uniquely matched by Internal Case ID plus normalized case number, so one
client ID may correctly own several cases. The client selector and Case
Register screen are built from this complete tab.

`Daily Court List` is the dated index used by the home screen. Hearing Date is
the date on which that row appears. Previous Date may be empty. Next Hearing in
`Case Register` is also consulted, so a case still appears on its current next
date if its daily-list row is missing.

`Clients` is a helper search index. It is not the authoritative list of cases.
`Sabuth Activity` is the save journal. `Sabuth Documents` is the status-document
queue. `Sabuth Reviews` stores review acknowledgements. `Sabuth Morning Lists`
and `Sabuth Runs` are retained legacy tabs and are not used by the current app.
`LawPal Court Sync` stores automatic eCourts date changes and API errors shown
in the app's AI changes section.

The CNR column belongs to `Case Register`. It stores one 16-character CNR for
one matter. A multi-matter client can therefore have several CNRs. The app
requires a user to review and confirm a search candidate before saving it.

Every save performs these steps synchronously:

1. Update the current values in `Case Register`.
2. Add or update the row for the Next Hearing date in `Daily Court List`.
3. Refresh the client's helper row in `Clients`.
4. Write the signed-in username and operation to `Sabuth Activity`.
5. Queue the client-document update in `Sabuth Documents`.

The save returns after the Sheet writes. `sabuthDocumentTick` runs once each
night at 11 PM IST and appends pending updates to the correct client status
document while preserving the existing table. A document error is recorded in
`Sabuth Documents` and does not undo the Sheet save.

`lawPalCourtSyncTick` runs at approximately 8 PM IST. It reads only matters
with a confirmed CNR. When eCourts returns a later Next Hearing date, the job
updates Next Hearing and Previous Date, adds an `AI updated from eCourts` note
to the dated Daily Court List row, and queues the existing 11 PM document job.
It does not change Stage / Purpose, court, parties, case status or order data.
API errors are written to `LawPal Court Sync`; the affected legal record stays
unchanged.

The Apps Script trigger service runs in Google's cloud. Both the 8 PM court
check and 11 PM document update continue when every office laptop is off.

## Restoring the older register

The first simplified-schema migration created the backup spreadsheet before it
changed the live columns. Some older Case Register rows were absent from the
live simplified register afterward. Run `migrateLawPal` to repair this safely.

The recovery reads the backup, compares Internal Case ID plus normalized case
number, and appends only cases missing from the live register. It never replaces
a matching live row, so current hearing dates and newer app-entered cases win.
The function also labels column J as `Status Document`, installs the 11 PM IST
document trigger and records data-model version 2. It is safe to rerun.

After migration, verify a known multi-case client such as Yani Dasoor in the
app. Selecting Yani Dasoor must show `Crl. Misc. 163/12`.

## Operational limits

- Avoid editing the same matter directly in Sheets while a LawPal save is in
  progress. App saves use a lock; direct spreadsheet edits do not.
- `Case Register` has no active/closed field. Every populated row appears in the
  register until an explicit archive model is added.
- A partial operation remains in `Sabuth Activity` as `Needs review`; inspect its
  saved plan before completing any manual recovery.
- This is a browser-installed PWA for Android and iPhone. Native App Store and
  Play Store packages are not included.
