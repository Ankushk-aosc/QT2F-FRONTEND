import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/migrations/qlik",
}));

const getSpaces = vi.fn();
const getApps = vi.fn();

vi.mock("@/services/qlik.service", () => ({
  QlikService: {
    getSpaces: (...a: unknown[]) => getSpaces(...a),
    getApps: (...a: unknown[]) => getApps(...a),
    unbuild: vi.fn(),
    runAssessment: vi.fn(),
    runParsing: vi.fn(),
    runMapping: vi.fn(),
    runReportGeneration: vi.fn(),
    getAgentActions: vi.fn(),
    getHistory: vi.fn(),
    getHistoryResults: vi.fn(),
  },
}));

vi.mock("@/services/fabric.service", () => ({
  fabricService: {
    getWorkspaces: vi.fn(async () => [{ id: "ws-1", displayName: "Analytics WS", type: "Workspace" }]),
  },
}));

// The real `useConnectorReadiness` and connectors store run here — only the
// HTTP call underneath is stubbed. Mocking the hook would have hidden any loop
// living in the store subscription, which is the half most likely to have one.
const listConnectors = vi.fn(async () => ({
  connectors: [
    {
      connectorId: "qlik",
      connection: {
        connectorId: "qlik",
        status: "connected",
        connectionName: "Prod Qlik",
        values: { cloudUrl: "https://tenant.qlikcloud.com" },
        secrets: {},
        healthMessage: "",
      },
      metadata: { syncedAt: new Date().toISOString(), collections: [] },
    },
    {
      connectorId: "fabric",
      connection: {
        connectorId: "fabric",
        status: "connected",
        connectionName: "Fabric",
        values: {},
        secrets: {},
        healthMessage: "",
      },
      metadata: { syncedAt: new Date().toISOString(), collections: [] },
    },
  ],
}));

vi.mock("@/services/connectors.service", () => ({
  connectorsService: {
    listConnectors: (...a: unknown[]) => listConnectors(...a),
    getConnector: vi.fn(),
    saveConnector: vi.fn(),
    testConnector: vi.fn(),
    syncConnector: vi.fn(),
    disconnectConnector: vi.fn(),
  },
}));

import { QlikMigrationTab } from "./QlikMigrationTab";

/**
 * The whole selection path: space → applications → target workspace.
 *
 * Each step feeds the next — choosing a space triggers the app fetch, which
 * writes to the shared Qlik store — so a feedback loop between an effect and
 * the state it writes would tear the page down with "Maximum update depth
 * exceeded" and show the error boundary instead of the applications. This
 * walks the three pickers in order and asserts both that the data arrives and
 * that React never reports a runaway update.
 */
describe("QlikMigrationTab — the selection flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSpaces.mockResolvedValue([
      { id: "personal", name: "Personal" },
      { id: "6a672f07", name: "Trial" },
    ]);
    getApps.mockResolvedValue([
      { id: "app-1", name: "FleetVision" },
      { id: "app-2", name: "Weather Analytics" },
    ]);
  });

  it("walks space → applications → workspace without a runaway update", async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.join(" "));
    });

    render(<QlikMigrationTab />);

    // Spaces arrive.
    await waitFor(() => expect(getSpaces).toHaveBeenCalled());
    await screen.findByRole("option", { name: "Personal" });

    // Pick one — this is the interaction that broke.
    // The <label>s are not associated with their <select>s, so select by
    // position: the space picker is the first combobox on the screen.
    const spacePicker = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(spacePicker, "personal");

    await waitFor(() => expect(getApps).toHaveBeenCalledWith("personal"));

    // Open the applications dropdown and pick one.
    await userEvent.click(screen.getByText("Select applications"));
    const appOption = await screen.findByText("FleetVision");
    await userEvent.click(appOption);

    // Pick a target workspace.
    const workspacePicker = screen.getAllByRole("combobox")[1];
    await userEvent.selectOptions(workspacePicker, "ws-1");

    const depthError = errors.find((e) => String(e).includes("Maximum update depth"));
    expect(depthError, `React reported a render loop: ${depthError}`).toBeUndefined();

    // The fetch must settle, not re-fire forever.
    await new Promise((r) => setTimeout(r, 250));
    expect(getApps.mock.calls.length).toBeLessThanOrEqual(2);

    spy.mockRestore();
  });
});
