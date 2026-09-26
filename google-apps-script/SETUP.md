# Sabuth · Connect Google Sheets

The web app is private. Google Sheets remains the authoritative store. No AI service is used.

## One-time authorization

1. Sign into Google Apps Script with **prabhakarlawgroup@gmail.com**.
2. Create a project named **Sabuth — Prabhakar Law Group**.
3. Replace Code.gs with the supplied Code.gs. Under Project Settings enable the manifest, then replace appsscript.json with the supplied manifest. The timezone must be Asia/Kolkata.
4. Run **setupSabuth**. Review Google's requested permissions yourself. The script requires access to the master spreadsheet, individual status documents, client folders, email sending, and its own schedule. Google grants broad Drive/Sheets scopes; the code confines operations to the configured register and referenced matter documents.
5. Setup adds only three workflow tabs: Sabuth Activity, Sabuth Morning Lists, and Sabuth Runs. It does not rewrite either original tab or enable scheduled emails.
6. In Project Settings → Script Properties, copy **SABUTH_SECRET**. Keep this private.
7. Deploy → New deployment → Web app. Execute as yourself. To allow the private app's server to call it, choose Anyone for endpoint access. The endpoint rejects every request without a valid timestamped HMAC signature. This is a security-sensitive setting: review it explicitly before deploying.
8. Give the resulting `/exec` URL to the app maintainer. Store that as the private Site environment variable **GOOGLE_SCRIPT_URL**, and the secret as **GOOGLE_SCRIPT_SECRET**. Never place the secret in a chat message, URL, public file, or browser storage. Use the private secret-entry mechanism.
9. Refresh Sabuth and verify the register and a known listing. Use a separate copy and test account for write verification before enabling production writes or email schedules.
10. In Sabuth → Workspace settings, enable daily emails only after the connection and write tests pass. Recipient: **prabhakarlawgroup@gmail.com**. The five-minute Google trigger targets 7 AM and 7 PM IST but is not exact-time delivery.

## What is ready

- Read existing Case Register and Daily Court List, including linked Current Status documents.
- Match using internal ID + matter number. Shared client IDs are not treated as unique matters.
- Structured hearing updates, explicit dates and source notes, retry journal and read-back verification.
- New matters under existing clients and new client folders with Current Status documents.
- Morning cross-check and immutable snapshot; evening changes only the next date.
- Morning and evening email previews, missing-date flags, and a send-state guard against automatic duplicate sends.

## Operational limits

- The original register has no active/closed status column. All populated records participate in the morning Next Hearing check. Archive closed cases or add an explicit status mapping before mixing closed and active cases.
- Direct edits in Google Sheets do not acquire the app's lock. App users are serialized; external editors can still race. Avoid editing the same matter in Sheets while an app update is running. Changes detected by read-back are flagged.
- An existing daily-list row with no unique register match blocks preparation; use New matter or repair the matching record explicitly.
- A partial operation remains in Sabuth Activity as Needs review. Retry the same request with the same request ID from the still-open form. After a refresh, the maintainer must inspect its recorded plan and affected records before completing recovery; do not mark it Complete without verification.
- A failed/uncertain email is never automatically resent. Check Sent mail, then a maintainer can correct the Sabuth Runs state after confirming what happened.
- These steps need real Google authorization and sandbox integration tests. Local tests alone do not prove Google deployment or delivery.
- This is a browser-installed PWA for iPhone and Android. App Store and Play Store packages are not included.

## Name

App name: sabuth. The Verisign .com registry returned no registration record for sabuth.com on 25 September 2026. Registrar confirmation is pending. No domain has been bought or connected.

## Client and date fixes (September 2026)

After replacing Code.gs, run `migrateSabuth` once under the firm account before deploying a new version of the existing web app. It creates a backup, adds the eight-column Clients tab and a document-work queue, appends Previous Date and creation/save timestamp columns, and formats unambiguous dates. Existing register columns and locked morning snapshots remain in place. Legacy timestamps without journal evidence are not invented.

Case saves return their refreshed court list. Status documents are processed by `sabuthDocumentTick` every five minutes; failures appear separately in the Sabuth Documents tab and do not invalidate a case save. Source/Confirmation and Court Hall are optional. UI dates use dd/mm/yyyy; sheet and document dates use dd-MMM-yyyy, with clock time and IST retained for actual save timestamps.
