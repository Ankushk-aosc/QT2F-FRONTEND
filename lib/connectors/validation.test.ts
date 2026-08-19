import { describe, expect, it } from "vitest";

import { getConnector, isFieldApplicable, type ConnectorDefinition } from "./registry";
import {
  MAX_LOG_ENTRIES,
  appendLog,
  coerceFieldValue,
  createLogEntry,
  isConnectorReady,
  sanitiseConnection,
  sanitiseValues,
  splitSecrets,
  validateSave,
} from "./validation";
import type { ConnectorField, ConnectorSavePayload } from "@/types/connectors";

/**
 * Tests for connector configuration handling.
 *
 * These exercise the real registry definitions rather than fixtures, so a field
 * added to a connector is covered the moment it is declared — the point of
 * deriving validation from the schema instead of hand-writing it per connector.
 *
 * The bias throughout is towards the cases where getting it wrong is expensive:
 * a secret leaking into the settings document, a stored credential being wiped
 * by an unrelated edit, and a hidden field being demanded by the server after
 * the form has hidden it.
 */

const qlik = getConnector("qlik") as ConnectorDefinition;
const tableau = getConnector("tableau") as ConnectorDefinition;

function field(definition: ConnectorDefinition, key: string): ConnectorField {
  const found = definition.fieldGroups
    .flatMap((group) => group.fields)
    .find((candidate) => candidate.key === key);
  if (!found) throw new Error(`Test setup error: no field "${key}"`);
  return found;
}

describe("registry integrity", () => {
  it("declares a unique id for every connector", () => {
    const ids = ["qlik", "tableau", "fabric"].map((id) => getConnector(id)?.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every available connector at least one required field", () => {
    for (const definition of [qlik, tableau]) {
      const required = definition.fieldGroups
        .flatMap((group) => group.fields)
        .filter((candidate) => candidate.required);
      expect(required.length).toBeGreaterThan(0);
    }
  });

  it("marks every credential-bearing field as secret", () => {
    // A field named like a credential but not flagged secret would be written
    // straight into the settings document.
    const credentialish = /key|secret|password|token|certificate|privatekey/i;
    for (const definition of [qlik, tableau]) {
      for (const candidate of definition.fieldGroups.flatMap((group) => group.fields)) {
        if (credentialish.test(candidate.key) && candidate.key !== "patName") {
          expect(candidate.secret, `${definition.id}.${candidate.key}`).toBe(true);
        }
      }
    }
  });
});

describe("coerceFieldValue", () => {
  it("clamps a number above its maximum rather than rejecting it", () => {
    const timeout = field(qlik, "timeoutSeconds");
    expect(coerceFieldValue(timeout, 99_999)).toBe(timeout.max);
  });

  it("clamps a number below its minimum", () => {
    const timeout = field(qlik, "timeoutSeconds");
    expect(coerceFieldValue(timeout, -5)).toBe(timeout.min);
  });

  it("accepts a numeric string", () => {
    expect(coerceFieldValue(field(qlik, "timeoutSeconds"), "45")).toBe(45);
  });

  it("rejects a non-numeric string", () => {
    expect(coerceFieldValue(field(qlik, "timeoutSeconds"), "soon")).toBeUndefined();
  });

  it("accepts an https URL", () => {
    expect(coerceFieldValue(field(qlik, "cloudUrl"), "https://tenant.qlikcloud.com")).toBe(
      "https://tenant.qlikcloud.com",
    );
  });

  it("rejects a file: URL", () => {
    // Connector URLs are fetched server-side; a non-http scheme would let a
    // configuration field reach places the fetch layer never intended.
    expect(coerceFieldValue(field(qlik, "cloudUrl"), "file:///etc/passwd")).toBeUndefined();
  });

  it("rejects a javascript: URL", () => {
    expect(coerceFieldValue(field(qlik, "cloudUrl"), "javascript:alert(1)")).toBeUndefined();
  });

  it("treats an empty URL as cleared rather than invalid", () => {
    expect(coerceFieldValue(field(qlik, "proxyUrl"), "")).toBe("");
  });

  it("accepts a declared select option", () => {
    expect(coerceFieldValue(field(qlik, "authMethod"), "certificate")).toBe("certificate");
  });

  it("rejects a select value that is not an option", () => {
    expect(coerceFieldValue(field(qlik, "authMethod"), "kerberos")).toBeUndefined();
  });

  it("rejects a non-boolean for a boolean field", () => {
    expect(coerceFieldValue(field(qlik, "verifySsl"), "true")).toBeUndefined();
  });
});

describe("isFieldApplicable", () => {
  it("hides the API key when certificate authentication is selected", () => {
    expect(isFieldApplicable(field(qlik, "apiKey"), { authMethod: "certificate" })).toBe(false);
  });

  it("shows the API key when API key authentication is selected", () => {
    expect(isFieldApplicable(field(qlik, "apiKey"), { authMethod: "api-key" })).toBe(true);
  });

  it("treats an unconditional field as always applicable", () => {
    expect(isFieldApplicable(field(qlik, "cloudUrl"), {})).toBe(true);
  });
});

describe("sanitiseValues", () => {
  it("never stores a secret field as a value", () => {
    const result = sanitiseValues(qlik, {
      cloudUrl: "https://tenant.qlikcloud.com",
      apiKey: "super-secret",
    });
    expect(result.apiKey).toBeUndefined();
    expect(result.cloudUrl).toBe("https://tenant.qlikcloud.com");
  });

  it("drops values belonging to a deselected authentication method", () => {
    // Switching from basic to API key must not leave the username behind.
    const result = sanitiseValues(
      qlik,
      { authMethod: "api-key" },
      { authMethod: "basic", username: "old-user" },
    );
    expect(result.username).toBeUndefined();
    expect(result.authMethod).toBe("api-key");
  });

  it("keeps the stored value when a field is absent from the patch", () => {
    const result = sanitiseValues(
      qlik,
      { defaultSpace: "Finance" },
      { cloudUrl: "https://tenant.qlikcloud.com" },
    );
    expect(result.cloudUrl).toBe("https://tenant.qlikcloud.com");
  });

  it("falls back to the stored value when the submitted one is invalid", () => {
    const result = sanitiseValues(
      qlik,
      { cloudUrl: "not-a-url" },
      { cloudUrl: "https://tenant.qlikcloud.com" },
    );
    expect(result.cloudUrl).toBe("https://tenant.qlikcloud.com");
  });

  it("ignores an unknown field entirely", () => {
    const result = sanitiseValues(qlik, { evilPayload: "x" } as Record<string, unknown>);
    expect(result.evilPayload).toBeUndefined();
  });

  // Tableau's `connectionId` is a Key Vault reference written by the server
  // during a connection test, not a form field. It is the link between the
  // connector and the credential the migration actually runs on, and losing it
  // would silently unlink the two — the connector would still read "Connected"
  // while every migration fell back to asking for a token again.
  it("preserves a server-managed value across an unrelated edit", () => {
    const result = sanitiseValues(
      tableau,
      { site: "new-site" },
      { site: "old-site", connectionId: "conn-abc123" },
    );
    expect(result.connectionId).toBe("conn-abc123");
    expect(result.site).toBe("new-site");
  });

  it("refuses a server-managed value submitted by the client", () => {
    // Accepting this would let a client point the connector at someone else's
    // Key Vault entry, so it is read only from stored state.
    const result = sanitiseValues(tableau, { connectionId: "conn-attacker" }, {});
    expect(result.connectionId).toBeUndefined();
  });

  it("does not invent a server-managed value that was never resolved", () => {
    const result = sanitiseValues(tableau, { site: "sales" }, {});
    expect(result.connectionId).toBeUndefined();
  });

  it("keeps the TCM token secret out of stored values", () => {
    const result = sanitiseValues(tableau, {
      envType: "cloud",
      tcmBaseUrl: "https://cloudmanager.tableau.com",
      tcmTokenSecret: "tcm-super-secret",
    });
    expect(result.tcmTokenSecret).toBeUndefined();
    expect(result.tcmBaseUrl).toBe("https://cloudmanager.tableau.com");
  });

  it("drops TCM fields when the environment is not Tableau Cloud", () => {
    // Cloud Trial and Server have no Cloud Manager, so a stale TCM base URL
    // left behind from a Cloud configuration would be sent on every call.
    const result = sanitiseValues(
      tableau,
      { envType: "server" },
      { envType: "cloud", tcmBaseUrl: "https://cloudmanager.tableau.com" },
    );
    expect(result.tcmBaseUrl).toBeUndefined();
    expect(result.envType).toBe("server");
  });
});

describe("splitSecrets", () => {
  it("routes a secret submitted in the values bag into secrets", () => {
    // A client that puts the API key in `values` must still not get it stored
    // as a value — the separation cannot depend on client cooperation.
    const payload = splitSecrets(qlik, {
      connectionName: "Prod",
      values: { apiKey: "leaked", cloudUrl: "https://tenant.qlikcloud.com" },
    });
    expect(payload.secrets?.apiKey).toBe("leaked");
    expect(payload.values.apiKey).toBeUndefined();
  });

  it("omits a secret that was not submitted", () => {
    const payload = splitSecrets(qlik, { connectionName: "Prod", values: {} });
    expect("apiKey" in (payload.secrets ?? {})).toBe(false);
  });

  it("preserves an empty secret so it can be distinguished from an omission", () => {
    // Empty means "clear this credential"; absent means "leave it alone".
    const payload = splitSecrets(qlik, { connectionName: "Prod", secrets: { apiKey: "" } });
    expect(payload.secrets?.apiKey).toBe("");
  });

  it("tolerates a malformed body", () => {
    const payload = splitSecrets(qlik, null);
    expect(payload.connectionName).toBe("");
    expect(payload.values).toEqual({});
  });
});

describe("validateSave", () => {
  const base: ConnectorSavePayload = {
    connectionName: "Production",
    values: { authMethod: "api-key", cloudUrl: "https://tenant.qlikcloud.com" },
    secrets: { apiKey: "abc123" },
  };

  it("accepts a complete payload", () => {
    expect(validateSave(qlik, base).ok).toBe(true);
  });

  it("requires a connection name", () => {
    const result = validateSave(qlik, { ...base, connectionName: "   " });
    expect(result.ok).toBe(false);
    expect(result.errors.connectionName).toBeTruthy();
  });

  it("requires the cloud URL", () => {
    const result = validateSave(qlik, { ...base, values: { authMethod: "api-key" } });
    expect(result.ok).toBe(false);
    expect(result.errors.cloudUrl).toBeTruthy();
  });

  it("requires a secret that has never been stored", () => {
    const result = validateSave(qlik, { ...base, secrets: {} });
    expect(result.ok).toBe(false);
    expect(result.errors.apiKey).toBeTruthy();
  });

  it("accepts a blank secret that is already stored", () => {
    // The form leaves secret inputs blank by design. Treating blank as missing
    // would make a connector impossible to edit after its first save.
    const result = validateSave(qlik, { ...base, secrets: {} }, ["apiKey"]);
    expect(result.ok).toBe(true);
  });

  it("does not require a field hidden by the selected authentication method", () => {
    // Username is required, but only under basic authentication.
    const result = validateSave(qlik, {
      ...base,
      values: { authMethod: "api-key", cloudUrl: "https://tenant.qlikcloud.com" },
    });
    expect(result.errors.username).toBeUndefined();
  });

  it("requires the fields the selected method does bring into play", () => {
    const result = validateSave(qlik, {
      connectionName: "Production",
      values: { authMethod: "basic", cloudUrl: "https://tenant.qlikcloud.com" },
      secrets: {},
    });
    expect(result.ok).toBe(false);
    expect(result.errors.username).toBeTruthy();
    expect(result.errors.password).toBeTruthy();
  });

  it("rejects an invalid URL with a field-level message", () => {
    const result = validateSave(qlik, {
      ...base,
      values: { authMethod: "api-key", cloudUrl: "ftp://tenant" },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.cloudUrl).toBeTruthy();
  });

  it("requires the Tableau token secret and site", () => {
    const result = validateSave(tableau, {
      connectionName: "Tableau Cloud",
      values: { serverUrl: "https://10ay.online.tableau.com" },
      secrets: {},
    });
    expect(result.ok).toBe(false);
    expect(result.errors.site).toBeTruthy();
    expect(result.errors.patSecret).toBeTruthy();
  });
});

describe("sanitiseConnection", () => {
  it("discards a secret field name that is not declared on the connector", () => {
    const connection = sanitiseConnection(qlik, {
      connectorId: "qlik",
      secretsPresent: ["apiKey", "somethingElse"],
    });
    expect(connection.secretsPresent).toEqual(["apiKey"]);
  });

  it("falls back to a safe status for an unrecognised value", () => {
    const connection = sanitiseConnection(qlik, { status: "totally-fine" });
    expect(connection.status).toBe("not-configured");
  });

  it("rejects a non-ISO timestamp", () => {
    const connection = sanitiseConnection(qlik, { lastSyncAt: "yesterday" });
    expect(connection.lastSyncAt).toBeNull();
  });

  it("normalises a valid timestamp to ISO", () => {
    const connection = sanitiseConnection(qlik, { lastSyncAt: "2026-08-11T04:00:00.000Z" });
    expect(connection.lastSyncAt).toBe("2026-08-11T04:00:00.000Z");
  });
});

describe("appendLog", () => {
  it("puts the newest entry first", () => {
    const first = createLogEntry("info", "save", "first");
    const second = createLogEntry("info", "test", "second");
    expect(appendLog([first], second)[0].message).toBe("second");
  });

  it("caps the log so storage cannot grow without bound", () => {
    let logs = [createLogEntry("info", "save", "seed")];
    for (let index = 0; index < MAX_LOG_ENTRIES + 20; index += 1) {
      logs = appendLog(logs, createLogEntry("info", "sync", `entry ${index}`));
    }
    expect(logs).toHaveLength(MAX_LOG_ENTRIES);
  });
});

describe("isConnectorReady", () => {
  const connected = sanitiseConnection(qlik, {
    status: "connected",
    lastSyncAt: "2026-08-11T04:00:00.000Z",
  });

  it("is ready when connected and synced", () => {
    expect(isConnectorReady(connected)).toBe(true);
  });

  it("is not ready when connected but never synced", () => {
    // Authenticating is not enough: with no cached metadata the migration
    // wizard has nothing to offer, and an empty picker is worse than a redirect.
    expect(isConnectorReady({ ...connected, lastSyncAt: null })).toBe(false);
  });

  it("is not ready when disconnected", () => {
    expect(isConnectorReady({ ...connected, status: "disconnected" })).toBe(false);
  });

  it("is not ready when there is no connection at all", () => {
    expect(isConnectorReady(null)).toBe(false);
  });
});
