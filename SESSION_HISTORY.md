# Session History

## Session 1 — 10 August 2026

**Objective:** Transform the Settings page into an Enterprise Administration Center.

### Findings

- The single merged repository is `unified-app`
  (`switchblade-unified-platform` v2.0.0). The two
  `az-repo-frontend-switchblade` copies elsewhere on disk are pre-merge
  repositories and were left untouched.
- `unified-app` had **no version control**. Initialised it and committed the
  clean baseline before making changes.
- Baseline health was already good: type-check clean, lint 0 errors / 3
  warnings. Nothing pre-existing needed fixing.
- Settings previously persisted through a thin proxy
  (`app/api/records/settings/route.ts`) to an **external** backend at
  `API_BASE_URL/records/settings`. That backend has no endpoints for the new
  settings categories, which drove the persistence decision below.

### Decisions

1. **Self-contained persistence.** Settings are stored by this application
   rather than against endpoints that do not exist yet on the external backend.
   `lib/settings/repository.ts` is the single seam for a later move to Cosmos.
2. **Foundation-first over breadth-first.** Five sections built properly rather
   than 25 scaffolded shells.
3. **Version control initialised** before any code changes.
4. **No duplicate stores.** `theme`/`timezone` stay owned by `ui.store`; the new
   settings store projects into it.
5. **Validation extracted as a pure module** so untrusted-input handling could
   be unit tested without `server-only` interfering.

### Delivered

- `0c1548e` baseline commit
- `a6e6888` Administration Center foundation — 26 files, +3141 / −694

Sections implemented: General, Appearance, Workspace, Migration, About.
Remaining 19 declared as `planned` with an honest empty state.

The old `SettingsDrawer.tsx` (690 lines) was deleted, but only after every one
of its controls — interactive mode, data layer toggle, deployment type and
deployment credentials — was ported into the new Migration section.

### Verification

| Gate | Result |
| --- | --- |
| type-check | clean |
| lint | 0 errors, 3 pre-existing warnings |
| build | succeeds, 76 routes, `/api/settings` registered |
| test | 30/30 (22 new) |

### Deliberately not done

- The report document set (`AI_PROVIDER_REPORT.md`, `MODEL_REPORT.md`,
  `QLIK_REPORT.md`, `PRODUCTION_READINESS.md`, `FINAL_SIGNOFF.md`, and the
  rest). They describe work that does not exist yet; writing them now would
  misrepresent the state of the platform. They belong with the sections they
  document.
- Auto-discovery, which depends on the still-planned integration sections.

### Notes for the next session

The bootstrap environment variables (MSAL config, backend base URLs,
`SETTINGS_STORE_PATH`) cannot be moved into the UI — they are needed before the
UI can load or authenticate. This is a real limit on "never edit .env" and is
documented in `SETTINGS_GUIDE.md`.
