# Changelog

All notable changes to the Switchblade Unified Platform are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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
