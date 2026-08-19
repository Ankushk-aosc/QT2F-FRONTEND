# Changelog

All notable changes to the Switchblade Unified Platform are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Integrations** — one section where every external platform is configured,
  replacing the four planned per-vendor sections. Qlik Sense, Tableau and
  Microsoft Fabric are configurable; Power BI, Snowflake, Databricks, Oracle,
  SQL Server, SAP, Looker, PostgreSQL, MySQL and BigQuery are listed as coming
  soon and say so plainly rather than offering a form that cannot connect.
- **Registry-driven connector framework.** `lib/connectors/registry.ts` declares
  each connector's fields, authentication methods and metadata categories; the
  card, the form, the validation and the metadata viewer are all generated from
  it. Adding a connector is a registry entry plus a discovery adapter — no new
  UI.
- **Automatic discovery on save.** One server-side sequence validates, stores
  the credential, authenticates, reads every reachable metadata category and
  caches it. Administrators never press "load spaces" or "refresh projects".
- **Metadata cache** with a freshness window and conditional background refresh
  (`POST …/sync?ifStale=true`), so a warm cache costs nothing and a broken
  connector is not silently retried.
- **Migration wizard reuse**: `ConnectorRequired` gates a step on a ready
  connector and deep-links to that exact connector in Settings when it is not;
  `useConnectorReadiness` serves cached metadata to pickers.
- Reusable connector components: card, schema-driven form, health and status
  badges, metadata viewer, activity log, result banner, loading skeleton and
  empty state.
- 45 unit tests covering connector field coercion, conditional visibility,
  required-field rules, secret separation and readiness.

### Security

- **Connector credentials never enter the settings document.**
  `lib/connectors/secrets.ts` is a write-only store in its own file with
  owner-only permissions; no API route returns a secret, and a connection
  records only which secret fields have a value. Submitting a secret in the
  `values` bag still routes it to the secret store, so the separation does not
  depend on client cooperation.
- Connector URL fields accept `http(s)` only — these values are fetched
  server-side, so permitting other schemes would turn a configuration field into
  a request vector.
- `.gitignore` note made explicit that `.data/` holds credentials.

### Changed

- The `qlik`, `tableau` and `fabric` navigation sections were replaced by a
  single `integrations` section. Vendor names remain search keywords, so
  searching "tableau" still lands in the right place.

- **Enterprise Administration Center** replacing the settings drawer. A
  navigable admin surface with a searchable section rail covering all 25
  planned sections.
- Working sections: **General** (company and platform name, logo, language,
  timezone, date format, version), **Appearance** (light/dark/system theme,
  accent colour, font size, compact mode, animations, sidebar style, card
  style, dashboard density), **Workspace** (active and default workspace,
  remember/restore, dashboard layout), **Migration** (interactive mode, data
  layer discovery, deployment target and credentials), **About**.
- Self-contained settings persistence: authenticated `GET`/`PUT /api/settings`
  backed by an atomic, write-serialised JSON store with schema migration.
  Location overridable with `SETTINGS_STORE_PATH`.
- `stores/settings.store.ts` and `services/settings.service.ts`.
- `hooks/useAppearanceSettings.ts` applies font scale, motion and density to
  the document and keeps "system" theme in sync with the OS.
- 22 unit tests covering validation of untrusted settings input.
- `SETTINGS_GUIDE.md` documenting the architecture, how to add a section, and
  how secrets must be handled.

### Changed

- `ClientProviders` mounts appearance effects inside the Fluent provider.
- `globals.css` honours `prefers-reduced-motion` in addition to the stored
  animation preference.
- Theme now supports a **system** mode that follows the operating system.

### Removed

- `components/layout/SettingsDrawer.tsx` (690 lines), superseded by the
  Administration Center. All of its controls were ported into the Migration
  section first — no functionality was dropped.

### Security

- Settings writes require a bearer token; the route reuses the existing
  `requireAuth` and `withSecurityHeaders` helpers.
- All settings input is validated server-side against allowed values; malformed
  input falls back to the stored value rather than being persisted.
- Logo input accepts only base64 image data URIs or `http(s)` URLs, so a
  `javascript:` payload cannot reach an image source.
- Credentials remain write-only from the UI and are never read back into a
  form, continuing the existing Key Vault pattern.
- `.data/` (the settings store) is git-ignored.

### Infrastructure

- Version control initialised for `unified-app`, with the pre-change state
  captured as a baseline commit.
