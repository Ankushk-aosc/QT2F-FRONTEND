import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_PLATFORM_SETTINGS } from "./defaults";
import { applyPatch, migrateSettings } from "./validation";
import type { PlatformSettings, PlatformSettingsPatch } from "@/types/settings";

/**
 * Server-side persistence for the Administration Center.
 *
 * The store is deliberately self-contained: it owns a single JSON document on
 * disk so the platform can be reconfigured from the UI without an external
 * dependency. `SETTINGS_STORE_PATH` overrides the location, which is how a
 * container mounts it onto a persistent volume.
 *
 * This module is the only seam that touches storage — swapping in Cosmos DB or
 * Azure App Configuration means changing `loadDocument` and `persistDocument`
 * and nothing else. All validation lives in `./validation`.
 *
 * Secrets never reach this file. Credential-bearing settings are stored behind
 * a secret reference, so a leaked settings document cannot disclose a key.
 */

const STORE_PATH =
  process.env.SETTINGS_STORE_PATH || path.join(process.cwd(), ".data", "settings.json");

export interface StoredDocument {
  settings: PlatformSettings;
  updatedAt: string | null;
}

/**
 * Serialises writes within this process. Two concurrent PUTs would otherwise
 * read-modify-write the same document and silently drop one of the changes.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

async function loadDocument(): Promise<StoredDocument> {
  try {
    const contents = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(contents) as Partial<StoredDocument>;
    return {
      settings: migrateSettings(parsed.settings),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      // A corrupt or unreadable document must not take the admin centre down;
      // fall back to defaults so the operator can save over the top of it.
      console.error("[SettingsRepository] Failed to read settings document:", error);
    }
    return { settings: DEFAULT_PLATFORM_SETTINGS, updatedAt: null };
  }
}

async function persistDocument(document: StoredDocument): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  // Write to a sibling temp file and rename, so a crash mid-write cannot leave
  // a truncated settings document behind.
  const tempPath = `${STORE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(document, null, 2), "utf8");
  await fs.rename(tempPath, STORE_PATH);
}

export async function getSettings(): Promise<StoredDocument> {
  return loadDocument();
}

/**
 * Merges `patch` into the stored settings and persists the result.
 * Writes are serialised so concurrent requests cannot clobber each other.
 */
export async function updateSettings(patch: PlatformSettingsPatch): Promise<StoredDocument> {
  const run = writeQueue.then(async () => {
    const existing = await loadDocument();
    const next: StoredDocument = {
      settings: applyPatch(existing.settings, patch),
      updatedAt: new Date().toISOString(),
    };
    await persistDocument(next);
    return next;
  });

  // Keep the queue alive even if this write fails, so one bad request does not
  // wedge every subsequent write.
  writeQueue = run.catch(() => undefined);
  return run;
}
