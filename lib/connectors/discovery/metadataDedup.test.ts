import { describe, expect, it, vi } from "vitest";

// `server-only` throws when imported outside a server bundle, and both adapters
// import it. Stubbing it lets the modules under test load in the jsdom test
// environment without weakening the guard in production.
vi.mock("server-only", () => ({}));

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock("@/lib/api/httpClient", () => ({
  httpClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));

import { qlikBackendAdapter } from "./qlik.backend";
import { tableauBackendAdapter } from "./tableau.backend";
import type { DiscoveryContext } from "./types";
import { createEmptyConnection } from "../validation";

/**
 * Discovery must not emit the same object twice.
 *
 * Both adapters fan out one child query per container (apps per Qlik space,
 * workbooks per Tableau project) and flatten the results. The same object comes
 * back from more than one container — a Qlik app published into a shared space
 * is listed under both, and Tableau projects overlap the same way — so a plain
 * append produced duplicate entries. The metadata viewer keys its rows by
 * object id, so the duplicates collided on their React key and the row could be
 * dropped or doubled.
 *
 * These pin the de-duplication and the tie-break: first sighting wins, so the
 * recorded parent is the earliest container in listing order.
 */

function qlikContext(): DiscoveryContext {
  return {
    connection: {
      ...createEmptyConnection("qlik", "Prod Qlik"),
      connectionName: "Prod Qlik",
      values: { cloudUrl: "https://tenant.qlikcloud.com" },
    },
    secrets: {},
    authHeader: "Bearer test-token",
    userEmail: "admin@example.com",
  };
}

function collection(collections: Awaited<ReturnType<typeof qlikBackendAdapter.discover>>, kind: string) {
  const found = collections.find((entry) => entry.kind === kind);
  if (!found) throw new Error(`No "${kind}" collection was returned`);
  return found;
}

describe("Qlik discovery — duplicate applications", () => {
  it("emits one entry per app when the same app is visible in two spaces", async () => {
    const shared = { id: "app-shared", name: "Quarterly Revenue", modifiedDate: "2026-01-04" };

    get.mockReset();
    get.mockImplementation((endpoint: string) => {
      if (endpoint === "/getSpaces") {
        return Promise.resolve([
          { id: "space-a", name: "Finance" },
          { id: "space-b", name: "Shared" },
        ]);
      }
      if (endpoint === "/getApps/space-a") {
        return Promise.resolve([shared, { id: "app-only-a", name: "Budget" }]);
      }
      if (endpoint === "/getApps/space-b") {
        // The same app again, plus one unique to this space.
        return Promise.resolve([shared, { id: "app-only-b", name: "Forecast" }]);
      }
      return Promise.resolve([]);
    });

    const apps = collection(await qlikBackendAdapter.discover(qlikContext()), "apps");
    const ids = apps.items.map((item) => item.id);

    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids.sort()).toEqual(["app-only-a", "app-only-b", "app-shared"]);
  });

  it("attributes a duplicated app to the first space that listed it", async () => {
    const shared = { id: "app-shared", name: "Quarterly Revenue" };

    get.mockReset();
    get.mockImplementation((endpoint: string) => {
      if (endpoint === "/getSpaces") {
        return Promise.resolve([
          { id: "space-a", name: "Finance" },
          { id: "space-b", name: "Shared" },
        ]);
      }
      if (endpoint === "/getApps/space-a" || endpoint === "/getApps/space-b") {
        return Promise.resolve([shared]);
      }
      return Promise.resolve([]);
    });

    const apps = collection(await qlikBackendAdapter.discover(qlikContext()), "apps");

    expect(apps.items).toHaveLength(1);
    expect(apps.items[0].parentId).toBe("space-a");
  });
});

describe("Tableau discovery — duplicate workbooks", () => {
  it("emits one entry per workbook when the same workbook is visible in two projects", async () => {
    const shared = { id: "wb-shared", name: "Exec Dashboard" };

    get.mockReset();
    post.mockReset();
    post.mockImplementation((endpoint: string) => {
      // Projects come from /propagate-tableau-details, workbooks from
      // /get-workbooks — both POSTs on the Tableau base API.
      if (endpoint === "/propagate-tableau-details") {
        return Promise.resolve({
          projects: [
            { id: "proj-a", name: "Finance" },
            { id: "proj-b", name: "Shared" },
          ],
        });
      }
      if (endpoint === "/get-workbooks") {
        // The same workbook is returned for both projects.
        return Promise.resolve({ workbooks: [shared] });
      }
      return Promise.resolve([]);
    });

    const context: DiscoveryContext = {
      connection: {
        ...createEmptyConnection("tableau", "Prod Tableau"),
        connectionName: "Prod Tableau",
        values: {
          envType: "server",
          serverUrl: "https://tableau.example.com",
          siteName: "Default",
          tokenName: "svc",
          connectionId: "conn-1",
        },
      },
      secrets: {},
      authHeader: "Bearer test-token",
      userEmail: "admin@example.com",
    };

    const workbooks = collection(await tableauBackendAdapter.discover(context), "workbooks");
    const ids = workbooks.items.map((item) => item.id);

    // Both projects returned it, so this only holds if the adapter collapses
    // the second sighting.
    expect(ids).toEqual(["wb-shared"]);
    expect(workbooks.items[0].parentId).toBe("proj-a");
  });
});
