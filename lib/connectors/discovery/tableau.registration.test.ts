import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws when imported outside a server bundle, and the adapter
// imports it. Stubbing it lets the module under test load in the jsdom test
// environment without weakening the guard in production.
vi.mock("server-only", () => ({}));

const post = vi.fn();
const patch = vi.fn();
const get = vi.fn();

vi.mock("@/lib/api/httpClient", () => ({
  httpClient: {
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    get: (...args: unknown[]) => get(...args),
  },
}));

import { tableauBackendAdapter } from "./tableau.backend";
import type { DiscoveryContext } from "./types";
import { createEmptyConnection } from "../validation";

/**
 * Tableau Key Vault registration.
 *
 * The adapter's job on `test()` is to put the credential in the migration
 * backend's Key Vault and come back with the `connection_id` that every later
 * migration and discovery call is authenticated by. These tests pin the parts
 * that are easy to get wrong and expensive when wrong:
 *
 *  - a create must not be sent as an update to somebody else's connection
 *  - a secret must travel only when the administrator actually supplied one
 *  - TCM fields must not leak into non-Cloud environments
 *  - a failed registration must be reported as a failure, never as "Connected"
 *
 * The backend itself is mocked. These verify the request this application
 * makes; they cannot verify how the real backend answers, which needs a
 * reachable environment.
 */

function context(overrides: {
  values?: Record<string, string | number | boolean>;
  secrets?: Record<string, string>;
  connectionName?: string;
}): DiscoveryContext {
  return {
    connection: {
      ...createEmptyConnection("tableau", overrides.connectionName ?? "Prod Tableau"),
      connectionName: overrides.connectionName ?? "Prod Tableau",
      values: overrides.values ?? {},
    },
    secrets: overrides.secrets ?? {},
    authHeader: "Bearer test-token",
    userEmail: "admin@example.com",
  };
}

const CLOUD_VALUES = {
  envType: "cloud",
  serverUrl: "https://tenant.online.tableau.com",
  site: "sales",
  patName: "TableauToken",
  tcmBaseUrl: "https://cloudmanager.tableau.com",
};

beforeEach(() => {
  post.mockReset();
  patch.mockReset();
  get.mockReset();
  // Default: registration succeeds, listing resolves the id, discovery returns
  // one project so the verification step passes.
  post.mockResolvedValue({});
  get.mockResolvedValue({ connections: [{ id: "conn-new", connection_name: "Prod Tableau" }] });
});

describe("first registration", () => {
  it("creates the connection with POST and captures the id", async () => {
    post.mockImplementation((endpoint: string) => {
      if (endpoint === "/connections") return Promise.resolve({});
      return Promise.resolve({ projects: [{ id: "p1", name: "Finance" }] });
    });

    const result = await tableauBackendAdapter.test(
      context({ values: CLOUD_VALUES, secrets: { patSecret: "the-pat" } }),
    );

    expect(result.ok).toBe(true);
    expect(result.values?.connectionId).toBe("conn-new");
    expect(patch).not.toHaveBeenCalled();

    const [endpoint, payload, options] = post.mock.calls[0];
    expect(endpoint).toBe("/connections");
    expect(payload.connection_name).toBe("Prod Tableau");
    expect(payload.tableau_server_url).toBe("https://tenant.online.tableau.com");
    expect(payload.env_type).toBe("cloud");
    // Without this the payload interceptor strips the server URL and injects a
    // connection id, turning the create into an update of another connection.
    expect(options.skipPayloadIntercept).toBe(true);
  });

  it("sends the token only when one was supplied", async () => {
    post.mockImplementation((endpoint: string) =>
      endpoint === "/connections"
        ? Promise.resolve({})
        : Promise.resolve({ projects: [] }),
    );

    await tableauBackendAdapter.test(
      context({ values: CLOUD_VALUES, secrets: { patSecret: "the-pat" } }),
    );
    expect(post.mock.calls[0][1].tableau_token_value).toBe("the-pat");

    post.mockClear();
    post.mockImplementation((endpoint: string) =>
      endpoint === "/connections"
        ? Promise.resolve({})
        : Promise.resolve({ projects: [] }),
    );

    // No secret supplied — the key must be absent, not empty. An empty string
    // would ask the backend to overwrite a stored credential with nothing.
    await tableauBackendAdapter.test(context({ values: CLOUD_VALUES, secrets: {} }));
    expect(post.mock.calls[0][1]).not.toHaveProperty("tableau_token_value");
  });
});

describe("updating an existing registration", () => {
  it("uses PATCH against the stored id rather than creating a second connection", async () => {
    patch.mockResolvedValue({});
    post.mockResolvedValue({ projects: [{ id: "p1", name: "Finance" }] });

    const result = await tableauBackendAdapter.test(
      context({ values: { ...CLOUD_VALUES, connectionId: "conn-existing" }, secrets: {} }),
    );

    expect(result.ok).toBe(true);
    expect(result.values?.connectionId).toBe("conn-existing");
    expect(patch).toHaveBeenCalledOnce();
    expect(patch.mock.calls[0][0]).toBe("/connections/conn-existing");
    // No create, and no re-listing: the id is already known.
    expect(post.mock.calls.every(([endpoint]) => endpoint !== "/connections")).toBe(true);
  });

  it("does not send a token when editing without entering one", async () => {
    patch.mockResolvedValue({});
    post.mockResolvedValue({ projects: [] });

    await tableauBackendAdapter.test(
      context({
        values: { ...CLOUD_VALUES, connectionId: "conn-existing", site: "new-site" },
        secrets: {},
      }),
    );

    const payload = patch.mock.calls[0][1];
    expect(payload).not.toHaveProperty("tableau_token_value");
    expect(payload).not.toHaveProperty("tcm_token_secret");
    expect(payload.tableau_site_name).toBe("new-site");
  });
});

describe("environment handling", () => {
  it("sends TCM configuration for Tableau Cloud", async () => {
    post.mockImplementation((endpoint: string) =>
      endpoint === "/connections" ? Promise.resolve({}) : Promise.resolve({ projects: [] }),
    );

    await tableauBackendAdapter.test(
      context({ values: CLOUD_VALUES, secrets: { tcmTokenSecret: "tcm-secret" } }),
    );

    const payload = post.mock.calls[0][1];
    expect(payload.tcm_base_url).toBe("https://cloudmanager.tableau.com");
    expect(payload.tcm_token_secret).toBe("tcm-secret");
  });

  it("omits TCM configuration for Cloud Trial", async () => {
    post.mockImplementation((endpoint: string) =>
      endpoint === "/connections" ? Promise.resolve({}) : Promise.resolve({ projects: [] }),
    );

    await tableauBackendAdapter.test(
      context({
        values: { ...CLOUD_VALUES, envType: "cloud_trial" },
        secrets: { tcmTokenSecret: "tcm-secret" },
      }),
    );

    const payload = post.mock.calls[0][1];
    expect(payload.env_type).toBe("cloud_trial");
    expect(payload.tcm_base_url).toBe("");
    expect(payload).not.toHaveProperty("tcm_token_secret");
  });

  it("omits TCM configuration for Tableau Server", async () => {
    post.mockImplementation((endpoint: string) =>
      endpoint === "/connections" ? Promise.resolve({}) : Promise.resolve({ projects: [] }),
    );

    await tableauBackendAdapter.test(
      context({
        values: { ...CLOUD_VALUES, envType: "server", serverUrl: "https://tableau.internal" },
        secrets: { tcmTokenSecret: "tcm-secret" },
      }),
    );

    const payload = post.mock.calls[0][1];
    expect(payload.env_type).toBe("server");
    expect(payload.tcm_base_url).toBe("");
    expect(payload).not.toHaveProperty("tcm_token_secret");
  });
});

describe("failure reporting", () => {
  it("reports a registration failure instead of claiming Connected", async () => {
    post.mockRejectedValue(new Error("API Error 500: Internal Server Error - vault unavailable"));

    const result = await tableauBackendAdapter.test(
      context({ values: CLOUD_VALUES, secrets: { patSecret: "the-pat" } }),
    );

    expect(result.ok).toBe(false);
    expect(result.values).toBeUndefined();
  });

  it("fails when the backend creates the connection but returns no id", async () => {
    // Without an id there is nothing a migration could authenticate with, so
    // treating this as success would produce a connector that looks healthy and
    // cannot be used.
    post.mockResolvedValue({});
    get.mockResolvedValue({ connections: [] });

    const result = await tableauBackendAdapter.test(
      context({ values: CLOUD_VALUES, secrets: { patSecret: "the-pat" } }),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/did not return an id/i);
  });

  it("reports a credential failure when discovery rejects the registered id", async () => {
    post.mockImplementation((endpoint: string) =>
      endpoint === "/connections"
        ? Promise.resolve({})
        : Promise.reject(new Error("API Error 401: Unauthorized - bad token")),
    );

    const result = await tableauBackendAdapter.test(
      context({ values: CLOUD_VALUES, secrets: { patSecret: "wrong" } }),
    );

    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(/wrong/);
  });

  it("never echoes a secret back in a failure message", async () => {
    post.mockRejectedValue(new Error("API Error 400: Bad Request - token super-secret-pat invalid"));

    const result = await tableauBackendAdapter.test(
      context({ values: CLOUD_VALUES, secrets: { patSecret: "super-secret-pat" } }),
    );

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("super-secret-pat");
  });
});
