# Settings Guide — Enterprise Administration Center

How the Administration Center is put together, and how to add to it.

## Goal

An administrator configures the platform from the UI. Hand-editing `.env` should
not be required for day-to-day configuration.

One honest caveat: a small **bootstrap core** cannot come from the UI, because
it is needed *before* the UI can load or authenticate. These stay in the
environment:

| Variable | Why it cannot be UI-configured |
| --- | --- |
| `MSAL_CLIENT_ID`, `MSAL_TENANT_ID`, `MSAL_AUTHORITY`, `API_SCOPE` | Needed to sign in before any settings can be read |
| `API_BASE_URL` and the other backend URLs | Needed to reach the backend that settings live behind |
| `SETTINGS_STORE_PATH` | Tells the app where the settings document itself lives |

Everything else is intended to migrate into the Administration Center.

## Architecture

```
components/settings/
  SettingsCenter.tsx        Drawer shell: search + section rail + content pane
  SettingsPrimitives.tsx    SettingsPanel / SettingsGroup / SettingRow
  sections/
    index.tsx               Maps a section id to its component
    GeneralSection.tsx      ─┐
    AppearanceSection.tsx    │ implemented sections
    WorkspaceSection.tsx     │
    MigrationSection.tsx     │
    AboutSection.tsx        ─┘
    PlannedSection.tsx      Honest empty state for unimplemented sections

lib/settings/
  navigation.ts             Single registry of every section (source of truth)
  defaults.ts               Neutral defaults + dropdown option lists
  validation.ts             Pure validation of untrusted input (unit tested)
  repository.ts             Storage I/O only — the seam to swap in Cosmos
  version.ts                Reads the running version from package.json

app/api/settings/route.ts   Authenticated GET / PUT
services/settings.service.ts  Client access, matching recordsService style
stores/settings.store.ts    Settings document state
hooks/useAppearanceSettings.ts  Applies appearance to the document
types/settings.ts           Domain model
```

### Data flow

```
Section component
      │ updateSettings({ appearance: { themeMode: "dark" } })
      ▼
stores/settings.store.ts ──► optimistic update ──► projects into ui.store
      │                                             (theme, timezone)
      │ settingsService.updateSettings(patch)
      ▼
PUT /api/settings ──► requireAuth ──► repository.updateSettings
                                            │ validation.applyPatch
                                            ▼
                                      .data/settings.json
```

If the server rejects a change, the store rolls back to the previous value and
surfaces the error in the drawer.

### Two deliberate design rules

**One source of truth.** `ui.store` already owned `theme` and `timezone`, and
much of the app reads them. Rather than duplicating those into the settings
store, the settings store *projects* into `ui.store` whenever the document
changes. Existing components were not touched, and there is still exactly one
writer per value.

**Planned sections do not pretend.** A section that is not implemented renders
`PlannedSection`, not a disabled form. A form that silently discards input is
worse than an empty state, because an administrator may believe they configured
something that was never saved.

## Adding a section

1. **Declare it** in `lib/settings/navigation.ts` — add the id to
   `SettingsSectionId` and an entry to `SETTINGS_SECTIONS`. Leave
   `status: "planned"` until it works.
2. **Model it** in `types/settings.ts`, add defaults in `lib/settings/defaults.ts`.
3. **Validate it** in `lib/settings/validation.ts`: add a `sanitiseX` function
   and wire it into `applyPatch` and `migrateSettings`. Add tests to
   `validation.test.ts` — every field must reject out-of-range input.
4. **Build the UI** in `components/settings/sections/`, composed from
   `SettingsPanel` / `SettingsGroup` / `SettingRow`.
5. **Register it** in `components/settings/sections/index.tsx` and flip
   `status` to `"available"`.

## The connector framework

Integrations is one section, not one section per vendor. Everything an
administrator sees for a connector — the card, the form, the metadata viewer —
is generated from a declarative definition, so **adding a connector is data, not
code**.

```
lib/connectors/
  registry.ts        The catalogue. Fields, auth methods, metadata kinds.
  validation.ts      Pure validation derived from the registry (unit tested)
  secrets.ts         Write-only credential store — the ONLY place a secret lands
  repository.ts      Connections, metadata cache and activity log
  service.ts         Orchestration: save → authenticate → discover → cache
  discovery/
    types.ts         DiscoveryAdapter — the swappable seam
    qlik.backend.ts     ─┐
    tableau.backend.ts   │ wired today, delegate to existing microservices
    fabric.backend.ts   ─┘
    index.ts         Adapter resolution. Change here to swap in a native adapter.

components/settings/connectors/
  ConnectorCard.tsx      ConnectorForm.tsx      MetadataViewer.tsx
  ConnectionLogs.tsx     StatusBadges.tsx       ConnectorLogo.tsx
  ConnectorFeedback.tsx  ConnectorDetail.tsx

components/connectors/ConnectorRequired.tsx   Gate for migration screens
hooks/useConnectorReadiness.ts                What the wizard asks
```

### Adding a connector

Add a `ConnectorDefinition` to `lib/connectors/registry.ts` and a
`DiscoveryAdapter` to `lib/connectors/discovery/`. That is the whole change —
no new form, no new card, no new validation. The registry entry declares the
fields (including which are secret), and validation, rendering and required-field
checking all derive from it.

A connector with no adapter cannot be configured at all: `getAdapter` returning
undefined is the single check that keeps the ten "coming soon" connectors
honest. They appear on the grid so the roadmap is visible, and say plainly that
they are not available.

### Save does everything

Pressing Save runs one server-side sequence (`lib/connectors/service.ts`):

```
validate → store secrets → persist config → authenticate
  → discover metadata → cache → report
```

The user never presses "load spaces" or "refresh projects". Two rules govern
the tail of that sequence:

- **A discovery failure does not fail a save.** Credentials that authenticate
  are worth keeping when a tenant is merely slow. The connector goes `degraded`
  and can be re-synced.
- **A failed sync does not discard the previous snapshot.** Cached metadata
  stays usable, so a transient outage degrades a connector to "stale" rather
  than to "unusable".

### Reuse in the migration wizard

Migration screens contain no connection logic. They wrap a step in
`<ConnectorRequired connectorId="qlik">` and read cached metadata from
`useConnectorReadiness`. An unconfigured connector renders a gate that deep-links
to that exact connector in Settings, rather than growing its own credential form
— which is how the platform previously ended up asking for the same connector
twice.

"Ready" deliberately means connected **and** synced. A connector that
authenticates but has never been discovered has nothing for a picker to show,
and an empty picker is worse than a redirect.

### Honest limitations of the wired adapters

The backend adapters reuse the existing migration microservices, which expose
spaces, apps, sites, projects, workbooks and lakehouses — and nothing deeper.
Sheets, variables, data connections, reload tasks, flows, schedules and
permissions are reported as **unsupported with a reason**, not as empty lists.
The distinction matters: "0 reload tasks" and "this adapter cannot read reload
tasks" lead an administrator to completely different actions.

Filling those in means writing a native adapter and changing one line in
`discovery/index.ts`. Nothing above the interface changes.

## Handling secrets

API keys, PATs and connection strings **must not** go into the settings
document. It is a plain JSON file, and a leaked copy must never disclose a
credential.

Follow the pattern already used for deployment credentials in
`MigrationSection.tsx`:

- The client sends the secret to a server route; it is never read back.
- The input is left blank on load and shows "enter a new token only when
  rotating" — the UI never displays a stored secret.
- The server persists it to Key Vault and keeps only a reference.

When AI provider keys are implemented, they follow the same rule.

## Storage

The settings document is a single JSON file, `.data/settings.json` by default,
overridable with `SETTINGS_STORE_PATH` (mount this on a volume in a container).

- Writes are **atomic** — written to a temp file and renamed, so a crash cannot
  truncate the document.
- Writes are **serialised** in-process, so two concurrent PUTs cannot
  read-modify-write over each other.
- A corrupt document falls back to defaults rather than taking the admin centre
  down, so an operator can save over the top of it.
- `schemaVersion` plus `migrateSettings` means older documents merge forward
  onto defaults instead of losing configuration.

`repository.ts` is the only file that touches storage. Moving to Cosmos DB or
Azure App Configuration means changing `loadDocument` and `persistDocument`.

## Verifying

```
pnpm type-check
pnpm lint
pnpm build
pnpm test
```
