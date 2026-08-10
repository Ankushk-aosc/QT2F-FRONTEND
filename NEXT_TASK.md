# Next Task

Continue the Enterprise Administration Center. The foundation is in place, so
each remaining section is now an incremental addition rather than new
architecture.

**Read `SETTINGS_GUIDE.md` first** — it has the five-step recipe for adding a
section and the rule for handling secrets.

## Recommended order

### 1. AI Providers (highest value, largest piece)

Support: Azure OpenAI, OpenAI, Anthropic Claude, Gemini, Azure AI Foundry,
OpenRouter, Groq, DeepSeek, Mistral, Ollama, LM Studio, Custom.

Per provider: name, endpoint, organization, deployment, version, region,
timeout, retry count, temperature, top-p, max tokens, streaming, enabled.

**The API key is the hard part.** It must not go into `.data/settings.json`.
Follow the deployment-credential pattern in `MigrationSection.tsx`:

- Client sends the key to a server route; it is never read back.
- The field renders blank with "enter a new key only when rotating".
- The server stores it in Key Vault and keeps only a reference in the settings
  document (e.g. `apiKeyRef`, plus a `hasApiKey` boolean for the UI).

Suggested shape: a `providers` record keyed by provider id, so adding a
provider is data rather than new code.

### 2. Model discovery

Server-side proxy routes per provider — the calls need the secret and would hit
CORS from the browser:

| Provider | Call |
| --- | --- |
| Azure OpenAI | list deployments |
| OpenAI | `GET /v1/models` |
| Anthropic | `GET /v1/models` |
| Gemini | `GET /v1beta/models` |
| Ollama | `GET /api/tags` |
| OpenRouter | `GET /api/v1/models` |

Cache results, and degrade gracefully to a manual text entry when a provider is
unreachable — an unreachable provider must not block saving configuration.

### 3. Model assignment

Per-workflow provider + model + temperature + max tokens for: Assessment,
Parsing, Mapping, Validation, Generation, Documentation, Report Generation,
Monitoring. Reuse the existing agent names in `lib/agentNames.ts` rather than
inventing a second list.

### 4. Integrations: Qlik, Tableau, Fabric, Azure

Services already exist — reuse them, do not write new ones:
`services/qlik.service.ts`, `services/tableau.service.ts`,
`services/fabric.service.ts`, and the routes under `app/api/qlik`,
`app/api/tableau`, `app/api/fabric`.

Then implement **auto-discovery**: on opening the admin centre, verify each
integration in parallel and show connected/disconnected. Make the checks
independent so one slow integration cannot block the panel, and cache the
result so switching sections does not re-probe.

### 5. Remaining sections

Authentication (MSAL status — `hooks/useMsalAuth.ts` has most of it), Security,
API health, Environment, Storage, Notifications, Monitoring, Reports, Logs,
Audit, Feature Flags (`lib/featureFlags.ts` exists), Users, Roles.

## Housekeeping

- `PROJECT_STRUCTURE.md` is stale — claims React 19, actual is React 18.3.1.
- The 3 `no-img-element` lint warnings in `MigrationOverview.tsx` predate this
  work and are still open.
- Before multi-instance deployment, replace the file-backed store in
  `lib/settings/repository.ts` with Cosmos DB or Azure App Configuration.
  `loadDocument` and `persistDocument` are the only functions that change.

## Definition of done for each section

Type-check clean, lint no new errors, build succeeds, validation unit tests for
every new field, `status` flipped to `"available"` in the registry, and no
secret written into the settings document.
