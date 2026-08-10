# Project Status — Switchblade Unified Platform

**Version:** 2.0.0
**Last updated:** 10 August 2026
**Repository:** `unified-app` (single merged repository; version control initialised this session)

## Health

| Gate | Result |
| --- | --- |
| `pnpm type-check` | Clean |
| `pnpm lint` | 0 errors, 3 warnings (pre-existing `no-img-element` in `MigrationOverview.tsx`) |
| `pnpm build` | Succeeds — 76 routes |
| `pnpm test` | 30/30 passing (3 files) |

These were also the results at the baseline commit, so the Administration
Center work introduced no regressions.

## Current focus

Transforming the Settings page into an Enterprise Administration Center.

### Administration Center — 6 of 25 sections implemented

| Section | Status | Notes |
| --- | --- | --- |
| General | Implemented | Company/platform name, logo, language, timezone, date format, version |
| Appearance | Implemented | Theme (light/dark/system), accent, font size, compact, animations, sidebar, card style, density |
| Workspace | Implemented | Active + default workspace, remember/restore, dashboard layout |
| Migration | Implemented | Ported from the old drawer: interactive mode, data layer, deployment target + credentials |
| About | Implemented | Version, schema version, last-saved timestamp |
| AI Providers | Planned | 12 providers, credentials behind Key Vault |
| AI Models | Planned | Auto-discovery + per-workflow assignment |
| AI Agents | Planned | |
| Qlik / Tableau / Fabric / Azure | Planned | Connection status and auto-discovery |
| Authentication / Security / API / Environment / Storage | Planned | |
| Notifications / Monitoring / Reports / Logs / Audit | Planned | |
| Feature Flags / Users / Roles | Planned | |

Planned sections appear in the navigation and render an explicit
"not yet available" state. They do not present forms that discard input.

## Architecture decisions

1. **Self-contained settings persistence.** Settings are stored by this
   application (`lib/settings/repository.ts` → `.data/settings.json`) rather
   than depending on endpoints that do not exist yet on the external backend.
   `repository.ts` is the single seam for moving to Cosmos DB later.

2. **No duplicate stores.** `theme` and `timezone` remain owned by `ui.store`.
   The new `settings.store` projects into it rather than holding a second copy.

3. **Validation is pure and tested.** `lib/settings/validation.ts` has no I/O so
   the rules governing untrusted input are directly unit tested (22 tests).

4. **Secrets stay out of the settings document.** Credentials continue to go
   through server routes into Key Vault, write-only from the UI.

## Known constraints

- **Bootstrap environment variables remain.** MSAL configuration, backend base
  URLs and `SETTINGS_STORE_PATH` cannot be UI-configured — they are required
  before the UI can load or authenticate. Documented in `SETTINGS_GUIDE.md`.
- **`.data/settings.json` is node-local.** Multi-instance deployments need the
  Cosmos/App Configuration adapter before horizontal scaling.
- **Auto-discovery is not implemented**, as it depends on the integration
  sections (Qlik, Tableau, Fabric, Azure) which are still planned.
- `PROJECT_STRUCTURE.md` predates the merge and is stale in places (it claims
  React 19; the app is on React 18.3.1).

## Next

See `NEXT_TASK.md`.
