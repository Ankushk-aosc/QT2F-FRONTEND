import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QlikSpaceSelectorContent } from "./QlikSpaceSelector/page";
import { TargetWorkspaceSelectorContent } from "./TargetWorkspaceSelector/page";

/**
 * Empty must not be indistinguishable from loading.
 *
 * Both pickers rendered "Loading…" whenever their list was empty, so a failed
 * fetch looked identical to one still in flight — the dropdowns sat on
 * "Loading workspaces..." forever with no error and no way to retry short of
 * reloading the page. These pin the three states apart and pin the retry.
 */

const spaceProps = {
  selectedQlikSpace: "",
  onChange: () => {},
  qlikSpaces: [],
  isProcessing: false,
  hasProcessed: false,
  showNoAppsPopup: false,
  setShowNoAppsPopup: () => {},
};

const workspaceProps = {
  selectedWorkspace: "",
  onChange: () => {},
  workspaces: [],
  isProcessing: false,
  hasProcessed: false,
};

describe("Qlik space picker", () => {
  it("says loading only while the fetch is in flight", () => {
    render(<QlikSpaceSelectorContent {...spaceProps} isLoadingSpaces />);
    expect(screen.getByText("Loading spaces...")).toBeDefined();
  });

  it("says no spaces — not loading — once an empty fetch settles", () => {
    render(<QlikSpaceSelectorContent {...spaceProps} isLoadingSpaces={false} />);
    expect(screen.getByText("No spaces available")).toBeDefined();
    expect(screen.queryByText("Loading spaces...")).toBeNull();
  });

  it("prompts to pick a space once options arrive", () => {
    render(
      <QlikSpaceSelectorContent
        {...spaceProps}
        qlikSpaces={[{ id: "personal", name: "Personal" }]}
      />,
    );
    // Previously read "Select a workspace" on a *space* picker.
    expect(screen.getByText("Select a space")).toBeDefined();
    expect(screen.getByText("Personal")).toBeDefined();
  });

  it("shows the failure and retries on demand", async () => {
    const onRetry = vi.fn();
    render(
      <QlikSpaceSelectorContent
        {...spaceProps}
        isLoadingSpaces={false}
        loadError="Qlik engine unreachable"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/Qlik engine unreachable/)).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides the error while a retry is in flight", () => {
    render(
      <QlikSpaceSelectorContent
        {...spaceProps}
        isLoadingSpaces
        loadError="Qlik engine unreachable"
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByText(/Qlik engine unreachable/)).toBeNull();
  });
});

describe("Fabric workspace picker", () => {
  it("says loading only while the fetch is in flight", () => {
    render(<TargetWorkspaceSelectorContent {...workspaceProps} isLoadingWorkspaces />);
    expect(screen.getByText("Loading workspaces...")).toBeDefined();
  });

  it("points at the connection once an empty fetch settles", () => {
    render(
      <TargetWorkspaceSelectorContent {...workspaceProps} isLoadingWorkspaces={false} />,
    );
    expect(
      screen.getByText("No workspaces available — check the Fabric connection"),
    ).toBeDefined();
    expect(screen.queryByText("Loading workspaces...")).toBeNull();
  });

  it("shows the failure and retries on demand", async () => {
    const onRetry = vi.fn();
    render(
      <TargetWorkspaceSelectorContent
        {...workspaceProps}
        isLoadingWorkspaces={false}
        loadError="Access token is invalid"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/Access token is invalid/)).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
