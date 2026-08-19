# Project Status — Switchblade Unified Platform

**Version:** 2.0.0
**Last updated:** 10 August 2026
**Repository:** `unified-app` (single merged repository; version control initialised this session)

## Health

| Gate | Result |
| --- | --- |
| `pnpm type-check` | Clean |
| `pnpm lint` | 0 errors, 3 warnings (pre-existing `no-img-element` in `MigrationOverview.tsx`) |
| `pnpm build` | Succeeds — 80 routes |
| `pnpm test` | 75/75 passing (4 files) |

These were also the results at the baseline commit, so the Administration
Center work introduced no regressions.

## Current focus

Transforming the Settings page into an Enterprise Administration Center.

### Administration Center — 6 of 22 sections implemented

| Section | Status | Notes |
| --- | --- | --- |
| General | Implemented | Company/platform name, logo, language, timezone, date format, version |
| Appearance | Implemented | Theme (light/dark/system), accent, font size, compact, animations, sidebar, card style, density |
| Workspace | Implemented | Active + default workspace, remember/restore, dashboard layout |
| Migration | Implemented | Ported from the old drawer: interactive mode, data layer, deployment target + credentials |
| **Integrations** | **Implemented** | Registry-driven connector framework. Qlik, Tableau and Fabric configurable; 10 connectors listed as coming soon. Save auto-authenticates, discovers and caches. |
| About | Implemented | Version, schema version, last-saved timestamp |
| AI Providers | Planned | 12 providers, credentials behind Key Vault |
| AI Models | Planned | Auto-discovery + per-workflow assignment |
| AI Agents | Planned | |
| Azure | Planned | Subscription, resource group, Key Vault, storage |
| Authentication / Security / API / Environment / Storage | Planned | |
| Notifications / Monitoring / Reports / Logs / Audit | Planned | |
| Feature Flags / Users / Roles | Planned | |

The four per-vendor sections (Qlik, Tableau, Fabric) were replaced by the single
Integrations section. Splitting the menu by vendor would have added an entry per
future connector without adding capability, and would have reintroduced the
per-platform configuration screens the Administration Center exists to remove.

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

5. **Connectors are data, not code.** `lib/connectors/registry.ts` declares each
   connector's fields, authentication methods and metadata categories; the card,
   the form and the validation are all generated from it. Adding a connector is
   a registry entry plus a discovery adapter.

6. **Discovery is behind a swappable interface.** `DiscoveryAdapter` separates
   *what* is discovered from *how* it is reached. The wired adapters delegate to
   the existing migration microservices, so credentials stay in the backend's
   Key Vault. Swapping in native vendor REST adapters is a one-line change in
   `lib/connectors/discovery/index.ts`.

7. **Connector state is its own document.** `.data/connectors.json`, separate
   from the settings document, because connector state is written by the server
   (health, sync results) rather than patched by the client. Mixing them would
   let a settings save clobber a sync result.

## Known constraints

- **Two hardcoded endpoints were removed.** Both silently pointed a deployment
  at one specific environment's infrastructure:

  - `lib/api/httpClient.ts` substituted a hardcoded Tableau `connection_id`
    (`conn-5e056b7ff47c`) whenever a request omitted one. The logic now lives in
    `lib/api/tableauPayload.ts` and **throws** unless `DEFAULT_CONNECTION_ID` is
    configured, rather than guessing a connection. Covered by
    `tableauPayload.test.ts`.
  - Two Qlik components fell back to a hardcoded Azure hostname for the
    run-history service, compiled into the client bundle. Replaced by
    `lib/publicConfig.ts`; an unconfigured deployment now degrades visibly.

  `DEFAULT_CONNECTION_ID` and `NEXT_PUBLIC_SQL_BASE_URL` must therefore be set
  per environment. This is deliberate: failing is correct where the alternative
  is routing a customer's request to another tenant.

- **The legacy raw-token Tableau discovery path is dead in practice.**
  `services/tableau.service.ts` falls back to sending `TABLEAU_TOKEN_VALUE`
  when a connection has no `connection_id`, but every such request passes
  through the payload interceptor, which strips the server URL and forces
  `connection_id` authentication — so the token was never the credential the
  backend used. It is left in place rather than removed, because confirming it
  is unreachable needs a live backend. It should be deleted once verified.

- **Four tab components remain over 2,000 lines.** `ParsingTab` (2,709),
  `AssessmentTab` (2,462), `MonitoringTab` (2,377) and `MappingTab` (2,318).
  Unlike `MigrationValidationView` — which really was a single 3,000-line
  function and has been split — these are already internally decomposed into
  many named sub-components sharing one file. Splitting them further is a file
  move with transcription risk and no behavioural benefit, so it was not done.
  `MonitoringTab` (48 hook calls, 15 store references) and `MigrationTab` (70
  hook calls) are additionally coupled to the migration polling internals and
  should not be restructured without tests around the pipeline first.

- **OIDC tokens live in `sessionStorage`.** MSAL is configured with
  `cacheLocation: "sessionStorage"` and `MsalProviderWrapper` additionally
  caches `access_token`, `fabric_access_token` and `onelake_token` there for the
  service layer. This is MSAL's standard SPA pattern, but it does mean a
  successful XSS could read a bearer token.

  It was left as-is deliberately. Moving to httpOnly cookies means a
  server-side token broker in front of every service call *and* a replacement
  for the 20-minute proactive refresh that keeps ~2h migrations alive — a change
  that risks the migration pipeline to harden a boundary the CSP in
  `next.config.mjs` already defends. Worth doing, but as its own piece of work
  with the pipeline under test.

  Note this is **not** where connector credentials live. Qlik/Tableau API keys
  and personal access tokens never reach the browser at all: they go to the
  server and into `lib/connectors/secrets.ts`, and no route returns them.

- **Bootstrap environment variables remain.** MSAL configuration, backend base
  URLs and `SETTINGS_STORE_PATH` cannot be UI-configured — they are required
  before the UI can load or authenticate. Documented in `SETTINGS_GUIDE.md`.
- **`.data/settings.json` is node-local.** Multi-instance deployments need the
  Cosmos/App Configuration adapter before horizontal scaling.
- **Discovery depth is capped by the wired adapters.** The migration
  microservices expose spaces, apps, sites, projects, workbooks and lakehouses.
  Sheets, variables, data connections, reload tasks, flows, schedules and
  permissions render as *unsupported with a reason*, not as empty lists. Native
  adapters would fill them in without changes above the interface.
- **Connector secrets are filesystem-local, not encrypted at rest.**
  `lib/connectors/secrets.ts` writes them to `.data/connector-secrets.json` with
  owner-only permissions, separate from the settings document so a shared config
  file cannot disclose a credential. `readStore`/`writeStore` are the only two
  functions to reimplement against Key Vault.
- **Fabric needs a Fabric-audienced token.** It is reached directly rather than
  through a microservice, so the client forwards its `fabric_access_token` in an
  `x-connector-token` header. Without it, the connector reports that specific
  problem rather than a generic 401.
- `PROJECT_STRUCTURE.md` predates the merge and is stale in places (it claims
  React 19; the app is on React 18.3.1).

## Next

See `NEXT_TASK.md`.
