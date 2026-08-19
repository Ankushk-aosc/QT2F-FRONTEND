import { describe, expect, it, vi } from "vitest";

import { interceptTableauPayload } from "./tableauPayload";

/**
 * Regression tests for the Tableau payload rewrite.
 *
 * This sits on the path of every Tableau discovery and migration request, and
 * the failure mode it guards against is not a crash — it is a request quietly
 * succeeding against the wrong customer's tenant. Two real defects motivated
 * these tests:
 *
 *  1. A hardcoded `conn-5e056b7ff47c` fallback meant any deployment that had
 *     not set `DEFAULT_CONNECTION_ID` routed Tableau calls through a connection
 *     belonging to a different environment.
 *  2. The rewrite was being applied to `/connections` itself, where stripping
 *     the server URL and injecting a connection id turns "create this
 *     connection" into "overwrite that unrelated one" — with this tenant's
 *     personal access token.
 */

const DEFAULT_ID = "conn-configured-for-this-env";

describe("interceptTableauPayload", () => {
  it("leaves a body that names no Tableau server untouched", () => {
    const body = { project_id: "p1", email: "a@b.com" };
    expect(interceptTableauPayload(body)).toEqual(body);
  });

  it("strips the server URL and keeps an explicit connection_id", () => {
    const result = interceptTableauPayload({
      tableau_server_url: "https://tenant.online.tableau.com",
      connection_id: "conn-explicit",
      project_id: "p1",
    });

    expect(result).toEqual({ connection_id: "conn-explicit", project_id: "p1" });
    expect(result).not.toHaveProperty("tableau_server_url");
  });

  it("strips the uppercase server URL variant too", () => {
    const result = interceptTableauPayload({
      TABLEAU_SERVER_URL: "https://tableau.internal",
      connection_id: "conn-explicit",
    });

    expect(result).not.toHaveProperty("TABLEAU_SERVER_URL");
    expect(result.connection_id).toBe("conn-explicit");
  });

  // The defect: without this, a missing connection_id silently became somebody
  // else's connection.
  it("refuses to guess a connection when none is configured", () => {
    expect(() =>
      interceptTableauPayload({ tableau_server_url: "https://tenant.online.tableau.com" }),
    ).toThrow(/Refusing to guess a connection/);
  });

  it("never substitutes the previously hardcoded id", () => {
    expect(() =>
      interceptTableauPayload({ tableau_server_url: "https://tenant.online.tableau.com" }),
    ).toThrow();

    // Belt and braces: the literal must not appear via any path.
    const result = interceptTableauPayload(
      { tableau_server_url: "https://tenant.online.tableau.com" },
      { defaultConnectionId: DEFAULT_ID, warn: () => {} },
    );
    expect(result.connection_id).toBe(DEFAULT_ID);
    expect(result.connection_id).not.toBe("conn-5e056b7ff47c");
  });

  it("warns when it falls back, so the legacy caller is visible in logs", () => {
    const warn = vi.fn();
    interceptTableauPayload(
      { tableau_server_url: "https://tenant.online.tableau.com" },
      { defaultConnectionId: DEFAULT_ID, warn },
    );

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/omitted connection_id/);
  });

  it("prefers an explicit connection_id over the configured default", () => {
    const warn = vi.fn();
    const result = interceptTableauPayload(
      { tableau_server_url: "https://tenant.online.tableau.com", connection_id: "conn-explicit" },
      { defaultConnectionId: DEFAULT_ID, warn },
    );

    expect(result.connection_id).toBe("conn-explicit");
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not mutate the caller's body", () => {
    const body = {
      tableau_server_url: "https://tenant.online.tableau.com",
      connection_id: "conn-explicit",
    };
    interceptTableauPayload(body);

    expect(body.tableau_server_url).toBe("https://tenant.online.tableau.com");
  });

  it("passes through non-object bodies", () => {
    expect(interceptTableauPayload(null)).toBeNull();
    expect(interceptTableauPayload(undefined)).toBeUndefined();
    expect(interceptTableauPayload("raw")).toBe("raw");
  });

  /**
   * A registration payload must never go through this function — the caller
   * passes `skipPayloadIntercept`. This test documents what would happen if
   * that were ever dropped, so the consequence is written down rather than
   * rediscovered.
   */
  it("would corrupt a connection-registration payload if ever applied to one", () => {
    const registration = {
      env_type: "cloud",
      connection_name: "Prod Tableau",
      tableau_server_url: "https://tenant.online.tableau.com",
      tableau_token_value: "the-pat",
    };

    const damaged = interceptTableauPayload(registration, {
      defaultConnectionId: DEFAULT_ID,
      warn: () => {},
    });

    // The server URL is gone and an id has appeared: the backend would read
    // this as an update to DEFAULT_ID rather than a create.
    expect(damaged).not.toHaveProperty("tableau_server_url");
    expect(damaged.connection_id).toBe(DEFAULT_ID);
  });
});
