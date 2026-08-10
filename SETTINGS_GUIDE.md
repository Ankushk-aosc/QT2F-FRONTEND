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
