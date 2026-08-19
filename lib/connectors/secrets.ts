import "server-only";

/**
 * Write-only secret storage for connector credentials.
 *
 * The rule this file exists to enforce: **a credential never enters the
 * settings document**. `.data/settings.json` and `.data/connectors.json` are
 * plain JSON that an operator may copy, back up or attach to a support ticket,
 * and a leaked copy must not disclose an API key or a personal access token.
 *
 * So secrets live in their own document, and only two operations are exposed to
 * the rest of the application:
 *
 *  - `writeSecrets` / `deleteSecrets` — mutate, called from the save path.
 *  - `resolveSecrets` — read, callable *only* by the discovery layer, which
 *    holds the values for the duration of one outbound request.
 *
 * There is no route that returns a secret, and `ConnectorConnection` records
 * nothing about a stored secret beyond the fact that one exists.
 *
 * ## Honest limitation
 *
 * This implementation stores secrets on the local filesystem with restrictive
 * permissions. That protects against the realistic failure this design targets
 * — a settings document being shared — but it is *not* encryption at rest, and
 * anyone who can read the process's files can read the secrets.
 *
 * `readStore` and `writeStore` are the only two functions that touch storage.
 * Backing this with Azure Key Vault means reimplementing that pair against
 * `@azure/keyvault-secrets` and changing nothing else; the interface above is
 * already shaped for it, which is why the API is get/set by name rather than
 * document-oriented.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import type { ConnectorId } from "@/types/connectors";

const STORE_PATH =
  process.env.CONNECTOR_SECRET_STORE_PATH ||
  path.join(process.cwd(), ".data", "connector-secrets.json");

/** Owner read/write only. Best-effort — ignored on Windows. */
const FILE_MODE = 0o600;

/** Secrets keyed by `${connectorId}:${fieldKey}`. */
type SecretDocument = Record<string, string>;

let writeQueue: Promise<unknown> = Promise.resolve();

function secretKey(connectorId: ConnectorId, fieldKey: string): string {
  return `${connectorId}:${fieldKey}`;
}

async function readStore(): Promise<SecretDocument> {
  try {
    const contents = await fs.readFile(STORE_PATH, "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const document: SecretDocument = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") document[key] = value;
    }
    return document;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      // Deliberately logs no detail: an error from this file could otherwise
      // put fragments of the document into application logs.
      console.error("[ConnectorSecrets] Unable to read the secret store.");
    }
    return {};
  }
}

async function writeStore(document: SecretDocument): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const tempPath = `${STORE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(document), { encoding: "utf8", mode: FILE_MODE });
  await fs.rename(tempPath, STORE_PATH);

  // The temp file carries the mode, but an existing target may predate it.
  try {
    await fs.chmod(STORE_PATH, FILE_MODE);
  } catch {
    // Not supported on every platform; the rename already succeeded.
  }
}

/** Serialises mutations so two concurrent saves cannot lose one another's writes. */
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(operation);
  writeQueue = run.catch(() => undefined);
  return run;
}

/**
 * Persists submitted secrets for one connector.
 *
 * The three cases are deliberately distinct, because collapsing them would make
 * a connector impossible to edit after its first save:
 *
 *  - key absent      → leave the stored secret alone (an admin editing a URL)
 *  - key with value  → replace it (rotation)
 *  - key with ""     → delete it (clearing a credential)
 *
 * Returns the field keys that hold a value afterwards, which is what the
 * connection records as `secretsPresent`.
 */
export async function writeSecrets(
  connectorId: ConnectorId,
  submitted: Record<string, string>,
  knownSecretFields: readonly string[],
): Promise<string[]> {
  return enqueue(async () => {
    const document = await readStore();

    for (const fieldKey of knownSecretFields) {
      if (!(fieldKey in submitted)) continue;

      const value = submitted[fieldKey];
      if (value === "") {
        delete document[secretKey(connectorId, fieldKey)];
      } else {
        document[secretKey(connectorId, fieldKey)] = value;
      }
    }

    await writeStore(document);

    return knownSecretFields.filter(
      (fieldKey) => document[secretKey(connectorId, fieldKey)] !== undefined,
    );
  });
}

/** Removes every secret belonging to a connector. Called on disconnect. */
export async function deleteSecrets(
  connectorId: ConnectorId,
  knownSecretFields: readonly string[],
): Promise<void> {
  await enqueue(async () => {
    const document = await readStore();
    for (const fieldKey of knownSecretFields) {
      delete document[secretKey(connectorId, fieldKey)];
    }
    await writeStore(document);
  });
}

/**
 * Reads secrets for an outbound connector call.
 *
 * Intended for the discovery layer only. There is no API route that surfaces
 * this — adding one would defeat the point of the module.
 */
export async function resolveSecrets(
  connectorId: ConnectorId,
  knownSecretFields: readonly string[],
): Promise<Record<string, string>> {
  const document = await readStore();
  const resolved: Record<string, string> = {};
  for (const fieldKey of knownSecretFields) {
    const value = document[secretKey(connectorId, fieldKey)];
    if (value !== undefined) resolved[fieldKey] = value;
  }
  return resolved;
}

/** Which of a connector's secret fields currently hold a value. */
export async function listStoredSecretFields(
  connectorId: ConnectorId,
  knownSecretFields: readonly string[],
): Promise<string[]> {
  const document = await readStore();
  return knownSecretFields.filter(
    (fieldKey) => document[secretKey(connectorId, fieldKey)] !== undefined,
  );
}
