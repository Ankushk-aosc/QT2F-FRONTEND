import { describe, expect, it } from "vitest";

import { getConnector, type ConnectorDefinition } from "./registry";
import {
  createEmptyConnection,
  describeStatus,
  isConnectorReady,
  sanitiseValues,
  splitSecrets,
} from "./validation";
import type { ConnectorConnection } from "@/types/connectors";

/**
 * Connector readiness and secret-handling rules.
 *
 * `isConnectorReady` decides whether a migration screen offers its pickers or
 * sends the user to Settings, so the cases that matter are the ones where a
 * wrong answer is expensive: reporting "Connected" for a connector that has
 * never authenticated, and reporting "not configured" for one that is fine.
 *
 * The secret cases guard the rule that an administrator editing a URL must not
 * silently destroy a stored credential.
 */

const qlik = getConnector("qlik") as ConnectorDefinition;
const tableau = getConnector("tableau") as ConnectorDefinition;

/** A connection in whatever state the test needs. */
function connection(
  definition: ConnectorDefinition,
  overrides: Partial<ConnectorConnection> = {},
): ConnectorConnection {
  return { ...createEmptyConnection(definition.id, definition.name), ...overrides };
}

describe("isConnectorReady", () => {
  it("treats an absent connection as not ready", () => {
    expect(isConnectorReady(null)).toBe(false);
  });

  it("treats a freshly created connection as not ready", () => {
    expect(isConnectorReady(connection(qlik))).toBe(false);
  });

  it("reports Qlik ready once connected and synced", () => {
    const ready = connection(qlik, {
      status: "connected",
      health: "healthy",
      lastSyncAt: "2026-08-13T09:00:00.000Z",
    });
    expect(isConnectorReady(ready)).toBe(true);
  });

  it("reports Tableau ready once connected and synced", () => {
    const ready = connection(tableau, {
      status: "connected",
      health: "healthy",
      lastSyncAt: "2026-08-13T09:00:00.000Z",
      values: { connectionId: "conn-real" },
    });
    expect(isConnectorReady(ready)).toBe(true);
  });

  // The important negative case. Configuration existing is not the same as
  // credentials working: a connector that has been saved but never
  // authenticated must not present itself as usable.
  it("is not ready when configured but never tested", () => {
    const saved = connection(tableau, {
      status: "disconnected",
      values: { serverUrl: "https://tenant.online.tableau.com", site: "sales" },
      secretsPresent: ["patSecret"],
    });
    expect(isConnectorReady(saved)).toBe(false);
  });

  it("is not ready when connected but never synced", () => {
    // A successful test with no metadata means the pickers would be empty, so
    // sending the user to the migration screen would strand them.
    const untested = connection(qlik, { status: "connected", lastSyncAt: null });
    expect(isConnectorReady(untested)).toBe(false);
  });

  it("is not ready when the last test failed", () => {
    const broken = connection(tableau, {
      status: "error",
      health: "unhealthy",
      healthMessage: "401 Unauthorized",
      lastSyncAt: "2026-08-13T09:00:00.000Z",
    });
    expect(isConnectorReady(broken)).toBe(false);
  });

  it("is not ready when deliberately disconnected, even with cached metadata", () => {
    const disconnected = connection(qlik, {
      status: "disconnected",
      lastSyncAt: "2026-08-13T09:00:00.000Z",
    });
    expect(isConnectorReady(disconnected)).toBe(false);
  });
});

describe("describeStatus", () => {
  it("never reports Connected for an unconfigured connector", () => {
    expect(describeStatus(null)).toBe("Not configured");
    expect(describeStatus(connection(tableau))).toBe("Not configured");
  });

  it("distinguishes a failure from a deliberate disconnect", () => {
    expect(describeStatus(connection(tableau, { status: "error" }))).toBe("Error");
    expect(describeStatus(connection(tableau, { status: "disconnected" }))).toBe("Disconnected");
  });
});

describe("Tableau secret preservation", () => {
  it("omits an untouched secret so the stored credential is left alone", () => {
    // The form submits only secrets typed this session. An absent key means
    // "leave it alone"; this asserts the absence survives parsing, because a
    // key appearing as "" would be read as a deletion.
    const payload = splitSecrets(tableau, {
      connectionName: "Prod",
      values: { envType: "cloud", serverUrl: "https://tenant.online.tableau.com", site: "new-site" },
      secrets: {},
    });

    expect(payload.secrets).not.toHaveProperty("patSecret");
    expect(payload.secrets).not.toHaveProperty("tcmTokenSecret");
    expect(payload.values.site).toBe("new-site");
  });

  it("carries an explicitly supplied secret through for rotation", () => {
    const payload = splitSecrets(tableau, {
      connectionName: "Prod",
      values: {},
      secrets: { patSecret: "rotated-token" },
    });
    expect(payload.secrets?.patSecret).toBe("rotated-token");
  });

  it("distinguishes an empty secret, which clears it, from an absent one", () => {
    const cleared = splitSecrets(tableau, {
      connectionName: "Prod",
      values: {},
      secrets: { patSecret: "" },
    });
    expect(cleared.secrets?.patSecret).toBe("");
  });

  it("keeps a secret out of stored values even when submitted as one", () => {
    const payload = splitSecrets(tableau, {
      connectionName: "Prod",
      values: { patSecret: "sneaky", tcmTokenSecret: "also-sneaky" },
      secrets: {},
    });

    expect(payload.values).not.toHaveProperty("patSecret");
    expect(payload.values).not.toHaveProperty("tcmTokenSecret");
    expect(payload.secrets?.patSecret).toBe("sneaky");
  });

  it("never lets a secret survive into the persisted values document", () => {
    const values = sanitiseValues(tableau, {
      envType: "cloud",
      serverUrl: "https://tenant.online.tableau.com",
      patSecret: "the-pat",
      tcmTokenSecret: "the-tcm-secret",
    });

    expect(values).not.toHaveProperty("patSecret");
    expect(values).not.toHaveProperty("tcmTokenSecret");
  });
});

describe("environment-specific Tableau fields", () => {
  it("keeps TCM configuration for Tableau Cloud", () => {
    const values = sanitiseValues(tableau, {
      envType: "cloud",
      tcmBaseUrl: "https://cloudmanager.tableau.com",
    });
    expect(values.tcmBaseUrl).toBe("https://cloudmanager.tableau.com");
  });

  it("drops TCM configuration for Cloud Trial, which has no Cloud Manager", () => {
    const values = sanitiseValues(
      tableau,
      { envType: "cloud_trial" },
      { envType: "cloud", tcmBaseUrl: "https://cloudmanager.tableau.com" },
    );
    expect(values.tcmBaseUrl).toBeUndefined();
    expect(values.envType).toBe("cloud_trial");
  });

  it("drops TCM configuration for Tableau Server", () => {
    const values = sanitiseValues(
      tableau,
      { envType: "server" },
      { envType: "cloud", tcmBaseUrl: "https://cloudmanager.tableau.com" },
    );
    expect(values.tcmBaseUrl).toBeUndefined();
  });

  it("accepts all three supported environments", () => {
    for (const env of ["cloud", "cloud_trial", "server"]) {
      expect(sanitiseValues(tableau, { envType: env }).envType).toBe(env);
    }
  });

  it("falls back to the stored environment when given an unknown one", () => {
    const values = sanitiseValues(tableau, { envType: "mainframe" }, { envType: "server" });
    expect(values.envType).toBe("server");
  });
});
