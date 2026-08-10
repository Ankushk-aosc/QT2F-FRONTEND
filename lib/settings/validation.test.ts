import { describe, expect, it } from "vitest";

import { DEFAULT_PLATFORM_SETTINGS } from "./defaults";
import {
  MAX_LOGO_DATA_URI_LENGTH,
  applyPatch,
  migrateSettings,
  pickLogoUrl,
  pickTimezone,
} from "./validation";
import type { PlatformSettings } from "@/types/settings";

const base: PlatformSettings = DEFAULT_PLATFORM_SETTINGS;

describe("pickLogoUrl", () => {
  it("accepts a base64 image data URI", () => {
    const uri = "data:image/png;base64,iVBORw0KGgo=";
    expect(pickLogoUrl(uri, "")).toBe(uri);
  });

  it("accepts an absolute https URL", () => {
    expect(pickLogoUrl("https://cdn.example.com/logo.png", "")).toBe(
      "https://cdn.example.com/logo.png",
    );
  });

  it("treats an empty string as clearing the logo", () => {
    expect(pickLogoUrl("", "https://cdn.example.com/logo.png")).toBe("");
  });

  it("rejects a javascript: URL rather than storing it", () => {
    // This value is rendered as an image source, so anything script-bearing
    // must fall back to the previous value.
    expect(pickLogoUrl("javascript:alert(1)", "")).toBe("");
  });

  it("rejects a non-image data URI", () => {
    expect(pickLogoUrl("data:text/html;base64,PHNjcmlwdD4=", "")).toBe("");
  });

  it("rejects a payload larger than the size cap", () => {
    const oversized = `data:image/png;base64,${"A".repeat(MAX_LOGO_DATA_URI_LENGTH)}`;
    expect(pickLogoUrl(oversized, "")).toBe("");
  });

  it("falls back for non-string input", () => {
    expect(pickLogoUrl({ evil: true }, "https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
  });
});

describe("pickTimezone", () => {
  it("accepts a valid IANA zone", () => {
    expect(pickTimezone("Australia/Sydney", "UTC")).toBe("Australia/Sydney");
  });

  it("falls back for an unknown zone", () => {
    expect(pickTimezone("Mars/Olympus_Mons", "UTC")).toBe("UTC");
  });

  it("falls back for an empty value", () => {
    expect(pickTimezone("   ", "UTC")).toBe("UTC");
  });
});

describe("applyPatch", () => {
  it("applies a valid change", () => {
    const next = applyPatch(base, { appearance: { themeMode: "dark" } });
    expect(next.appearance.themeMode).toBe("dark");
  });

  it("leaves untouched sections unchanged", () => {
    const next = applyPatch(base, { appearance: { themeMode: "dark" } });
    expect(next.general).toEqual(base.general);
    expect(next.workspace).toEqual(base.workspace);
  });

  it("ignores an out-of-range enum value", () => {
    const next = applyPatch(base, {
      appearance: { themeMode: "neon" as never },
    });
    expect(next.appearance.themeMode).toBe(base.appearance.themeMode);
  });

  it("ignores a wrongly typed boolean", () => {
    const next = applyPatch(base, {
      appearance: { compactMode: "yes" as never },
    });
    expect(next.appearance.compactMode).toBe(base.appearance.compactMode);
  });

  it("trims and caps an over-long company name", () => {
    const next = applyPatch(base, { general: { companyName: `  ${"x".repeat(500)}  ` } });
    expect(next.general.companyName).toHaveLength(120);
  });

  it("never lets platform name be blanked out", () => {
    const next = applyPatch(base, { general: { platformName: "   " } });
    expect(next.general.platformName).toBe(base.general.platformName);
  });

  it("clears lastWorkspace on an explicit null", () => {
    const withLast = applyPatch(base, { workspace: { lastWorkspace: "qlik" } });
    expect(withLast.workspace.lastWorkspace).toBe("qlik");

    const cleared = applyPatch(withLast, { workspace: { lastWorkspace: null } });
    expect(cleared.workspace.lastWorkspace).toBeNull();
  });

  it("preserves lastWorkspace when the key is absent", () => {
    const withLast = applyPatch(base, { workspace: { lastWorkspace: "qlik" } });
    const next = applyPatch(withLast, { workspace: { dashboardLayout: "list" } });
    expect(next.workspace.lastWorkspace).toBe("qlik");
  });

  it("always stamps the current schema version", () => {
    const next = applyPatch({ ...base, schemaVersion: 0 }, {});
    expect(next.schemaVersion).toBe(DEFAULT_PLATFORM_SETTINGS.schemaVersion);
  });
});

describe("migrateSettings", () => {
  it("returns defaults for an empty document", () => {
    expect(migrateSettings(undefined)).toEqual(DEFAULT_PLATFORM_SETTINGS);
  });

  it("keeps recognised values from a partial document", () => {
    const migrated = migrateSettings({ appearance: { themeMode: "dark" } });
    expect(migrated.appearance.themeMode).toBe("dark");
    // Unspecified fields come from the defaults rather than being dropped.
    expect(migrated.appearance.fontSize).toBe(DEFAULT_PLATFORM_SETTINGS.appearance.fontSize);
  });

  it("discards unrecognised values", () => {
    const migrated = migrateSettings({ appearance: { accentColor: "chartreuse" } });
    expect(migrated.appearance.accentColor).toBe(
      DEFAULT_PLATFORM_SETTINGS.appearance.accentColor,
    );
  });
});
