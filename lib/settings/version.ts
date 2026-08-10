import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Resolves the running application version.
 *
 * The version is read from package.json at runtime rather than duplicated in a
 * constant, so the value shown in the admin centre can never drift from the
 * version that was actually built and deployed.
 */

let cachedVersion: string | undefined;

const UNKNOWN_VERSION = "unknown";

export function getApplicationVersion(): string {
  if (cachedVersion !== undefined) return cachedVersion;

  try {
    const packagePath = path.join(process.cwd(), "package.json");
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: unknown };
    cachedVersion = typeof parsed.version === "string" ? parsed.version : UNKNOWN_VERSION;
  } catch (error) {
    console.error("[SettingsVersion] Unable to read application version:", error);
    cachedVersion = UNKNOWN_VERSION;
  }

  return cachedVersion;
}
