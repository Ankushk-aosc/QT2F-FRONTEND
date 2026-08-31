"use client";

import React, { useEffect, useRef, useState } from "react";
import { Info, Plus, Trash2, X, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, Option } from "@/components/ui/combobox";
import { Dropdown } from "@/components/ui/dropdown";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { qlikService, type QlikCredentials } from "@/services/qlik.service";
import { getErrorMessage } from "@/lib/error-handler";

/**
 * "Configure Source Connection" — the Qlik counterpart of T2F's dialog in
 * vl-t2f-frontend/components/tabs/MigrationTab.tsx (the Configure button beside
 * the Connection Name combobox).
 *
 * Layout, controls, spacing, the add/delete connection row, the inline
 * message banner, the editable-name pencil and the footer status strip are
 * all carried over unchanged so the two products look and behave the same.
 *
 * The field set is deliberately smaller. T2F needs an environment switcher
 * (Cloud / Cloud Trial / Server) and four credential fields because Tableau
 * authenticates with a Personal Access Token per site. Qlik Cloud is addressed
 * by a tenant URL plus a single API key, so only these remain:
 *
 *   Saved Connections   (unchanged)
 *   Connection Name     (unchanged)
 *   Tableau URL   -> Qlik Cloud URL (qlik_tenant_url)
 *   (new)         -> API Key (api_key)
 *
 * Everything below that in T2F (TCM Base URL, TCM Token Secret, Tableau Token
 * Name, Tableau Token Value, Site Name) is dropped rather than hidden, so no
 * dead state is carried into this build.
 */

/**
 * Tooltip body in T2F's two-part form: where to find the value, then what it is.
 * Kept identical in structure; every word is Qlik-specific.
 */
function FieldTooltip({ location, description }: { location: string; description: string }) {
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-1">
          <div><strong>Location:</strong></div>
          <div>{location}</div>
          <div className="mt-1"><strong>Tooltip Content:</strong></div>
          <div>{description}</div>
        </div>
      }
      relationship="label"
    >
      <Info size={16} className="cursor-help text-muted-foreground" />
    </Tooltip>
  );
}

export interface QlikConnectionConfigProps {
  /** Disables the trigger while a run is in flight, as T2F does. */
  isProcessing?: boolean;
  isStarting?: boolean;
  /** Name shown in the page-level combobox; lifted so the parent can display it. */
  currentConnectionName: string;
  setCurrentConnectionName: (name: string) => void;
  /**
   * Called with the saved Qlik URL so the page can keep using it for spaces and
   * apps. Lets this dialog drop in beside the existing URL-driven flow.
   */
  onConnectionApplied?: (creds: QlikCredentials) => void;
}

export function QlikConnectionConfigContent({
  isProcessing = false,
  isStarting = false,
  currentConnectionName,
  setCurrentConnectionName,
  onConnectionApplied,
}: QlikConnectionConfigProps) {
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [loadingQlik, setLoadingQlik] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedCredentials, setSavedCredentials] = useState<QlikCredentials[]>([]);
  const [qlikCredentials, setQlikCredentials] = useState<QlikCredentials | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [isConnectionNameEditable, setIsConnectionNameEditable] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [configStatus, setConfigStatus] = useState<"idle" | "success" | "error">("idle");

  const [configConnectionName, setConfigConnectionName] = useState("");
  const [configQlikUrl, setConfigQlikUrl] = useState("");
  const [configApiKey, setConfigApiKey] = useState("");

  // onConnectionApplied is read inside the mount effect below without being a
  // dependency of it: the parent passes a new closure on every render, so
  // depending on it directly would re-run the load on each keystroke elsewhere
  // in the panel.
  const onConnectionAppliedRef = useRef(onConnectionApplied);
  useEffect(() => {
    onConnectionAppliedRef.current = onConnectionApplied;
  }, [onConnectionApplied]);

  /**
   * Loads saved connections once on mount so the page opens already showing the
   * configured connection -- its name in the combobox and its URL in the
   * read-only Qlik Cloud URL field beneath. T2F does the same in MigrationTab's
   * mount effect; without it the panel looks unconfigured until you open the
   * dialog, even though a connection is stored.
   */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const creds = await qlikService.initializeConnection("cloud");
        if (!mounted) return;

        const credsArray = Array.isArray(creds) ? creds : creds ? [creds] : [];
        setSavedCredentials(credsArray);

        const singleCred = credsArray[0] ?? null;
        if (!singleCred) return;

        setQlikCredentials(singleCred);
        if (singleCred.connection_id) setSelectedConnectionId(singleCred.connection_id);
        setCurrentConnectionName(singleCred.CONNECTION_NAME || singleCred.QLIK_TENANT_URL || "");
        setConfigConnectionName(singleCred.CONNECTION_NAME || "");
        setConfigQlikUrl(singleCred.QLIK_TENANT_URL || "");
        setConfigApiKey(singleCred.QLIK_API_KEY || "");
        onConnectionAppliedRef.current?.(singleCred);
      } catch (err) {
        // A missing or empty connection store is the normal first-run state;
        // surfacing it here would put an error on a page the user has not
        // interacted with yet. The dialog reports failures when it is opened.
        console.warn("[QlikConnectionConfig] Could not load saved connections:", err);
      }
    };

    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Opens the dialog, loading the saved connections first. */
  const fetchConfig = async () => {
    setLoadingQlik(true);
    setError(null);
    setConfigStatus("idle");
    try {
      const creds = await qlikService.initializeConnection("cloud");
      const credsArray = Array.isArray(creds) ? creds : creds ? [creds] : [];
      setSavedCredentials(credsArray);

      // Keep the current selection when it survives the refresh, so reopening
      // the dialog does not silently switch which connection is being edited.
      const singleCred =
        (selectedConnectionId
          ? credsArray.find((c) => c.connection_id === selectedConnectionId)
          : undefined) ?? credsArray[0] ?? null;

      setQlikCredentials(singleCred);
      if (singleCred) {
        if (singleCred.connection_id) setSelectedConnectionId(singleCred.connection_id);
        setCurrentConnectionName(singleCred.CONNECTION_NAME || singleCred.QLIK_TENANT_URL || "");
        setConfigConnectionName(singleCred.CONNECTION_NAME || "");
        setConfigQlikUrl(singleCred.QLIK_TENANT_URL || "");
        setConfigApiKey(singleCred.QLIK_API_KEY || "");
        setConfigStatus("success");
      } else {
        setConfigStatus("error");
      }
      setIsConfigDialogOpen(true);
    } catch (err) {
      setError(getErrorMessage(err) || "Failed to fetch configurations");
      setConfigStatus("error");
      // Still open, so the footer can report why.
      setIsConfigDialogOpen(true);
    } finally {
      setLoadingQlik(false);
    }
  };

  const handleConnectionSelect = (connectionId: string) => {
    const cred = savedCredentials.find((c) => c.connection_id === connectionId);
    setSelectedConnectionId(connectionId || "");
    if (cred) {
      setQlikCredentials(cred);
      setCurrentConnectionName(cred.CONNECTION_NAME || cred.QLIK_TENANT_URL || "");
      setConfigConnectionName(cred.CONNECTION_NAME || "");
      setConfigQlikUrl(cred.QLIK_TENANT_URL || "");
      setConfigApiKey(cred.QLIK_API_KEY || "");
      // Without this, switching to a different saved connection updated only
      // this component's own display -- the parent page's qlikUrl and
      // selectedConnectionId (which every downstream space/app fetch is
      // scoped by) stayed on whichever connection loaded first, until the
      // user happened to open Configure and hit Save. onConnectionApplied is
      // the page's only channel for learning either value, the same one
      // load() and handleSave() already use on mount/save.
      onConnectionApplied?.(cred);
    }
    setConfigStatus("idle");
    setToastMessage(null);
    setIsConnectionNameEditable(false);
  };

  const handleAddNew = () => {
    setSelectedConnectionId("");
    setCurrentConnectionName("");
    setConfigConnectionName("");
    setConfigQlikUrl("");
    setConfigApiKey("");
    setConfigStatus("idle");
    setToastMessage(null);
    setIsConnectionNameEditable(false);
    setQlikCredentials(null);
  };

  const handleDeleteConnection = async () => {
    const cred = savedCredentials.find((c) => c.connection_id === selectedConnectionId);
    if (!cred?.connection_id) {
      setError("No saved connection selected to delete");
      return;
    }
    setLoadingQlik(true);
    setError(null);
    try {
      await qlikService.deleteConnection(cred.connection_id);
      const updatedCreds = await qlikService.initializeConnection("cloud");
      setSavedCredentials(Array.isArray(updatedCreds) ? updatedCreds : updatedCreds ? [updatedCreds] : []);
      setToastMessage(null);
      setIsConnectionNameEditable(false);
      handleAddNew();
      setConfigStatus("idle");
    } catch (err) {
      setError(getErrorMessage(err) || "Failed to delete connection");
    } finally {
      setLoadingQlik(false);
    }
  };

  const handleSave = async () => {
    if (!configConnectionName.trim()) {
      setError("Please enter a valid Connection Name");
      return;
    }
    if (!configQlikUrl.trim()) {
      setError("Please enter a valid Qlik Cloud URL");
      return;
    }

    const effectiveConnectionId = selectedConnectionId || qlikCredentials?.connection_id;
    const isNameChanged =
      effectiveConnectionId && qlikCredentials?.CONNECTION_NAME !== configConnectionName.trim();

    setLoadingQlik(true);
    setError(null);
    setToastMessage(null);

    // Reject a rename that collides with another saved connection before the
    // request goes out, and restore the previous name so the field is not left
    // holding a value that was never saved.
    if (isNameChanged && effectiveConnectionId) {
      const isDuplicate = savedCredentials.some(
        (c) => c.CONNECTION_NAME === configConnectionName.trim() && c.connection_id !== effectiveConnectionId
      );
      if (isDuplicate) {
        setToastMessage({ type: "error", text: "A connection with this name already exists." });
        setConfigConnectionName(qlikCredentials?.CONNECTION_NAME || "");
        setIsConnectionNameEditable(false);
        setLoadingQlik(false);
        return;
      }
    }

    try {
      const creds: QlikCredentials = {
        connection_id: effectiveConnectionId,
        CONNECTION_NAME: configConnectionName.trim(),
        QLIK_TENANT_URL: configQlikUrl.trim(),
        QLIK_API_KEY: configApiKey.trim(),
      };
      // This save IS the tenant-URL write: qlikService.storeQlikUrl POSTs/PATCHes
      // {env_type, connection_name, qlik_tenant_url, api_key} straight to
      // {records host}/qlik, the same resource /api/get-spaces resolves the
      // tenant from server-side. No separate publish step is needed.
      await qlikService.storeQlikUrl(creds, "cloud");

      const updatedCreds = await qlikService.initializeConnection("cloud");
      const credsArray = Array.isArray(updatedCreds) ? updatedCreds : updatedCreds ? [updatedCreds] : [];
      setSavedCredentials(credsArray);

      const targetId = qlikCredentials?.connection_id || selectedConnectionId;
      const singleCred =
        credsArray.find((c) =>
          targetId
            ? c.connection_id === targetId
            : c.CONNECTION_NAME === configConnectionName.trim() || c.QLIK_TENANT_URL === configQlikUrl.trim()
        ) ??
        credsArray[0] ??
        null;

      setQlikCredentials(singleCred);
      if (singleCred) {
        setCurrentConnectionName(singleCred.CONNECTION_NAME || singleCred.QLIK_TENANT_URL || "");
        if (singleCred.connection_id) setSelectedConnectionId(singleCred.connection_id);
        onConnectionApplied?.(singleCred);
      } else {
        onConnectionApplied?.(creds);
      }

      setConfigStatus("success");
      setToastMessage({
        type: "success",
        text: effectiveConnectionId ? "Connection updated successfully." : "Connection created successfully.",
      });
      setIsConnectionNameEditable(false);
      setIsConfigDialogOpen(false);
    } catch (err) {
      setError(getErrorMessage(err) || "Failed to save configurations");
      setConfigStatus("error");
    } finally {
      setLoadingQlik(false);
    }
  };

  return (
    <div>
      <Label className="text-primary">Connection Name</Label>
      <div className="mt-1 flex items-center gap-3">
        <Combobox
          value={currentConnectionName}
          onChange={(e) => {
            setCurrentConnectionName(e.target.value);
            setSelectedConnectionId("");
          }}
          selectedOptions={[selectedConnectionId]}
          onOptionSelect={(_, d) => handleConnectionSelect(d.optionValue as string)}
          disabled={isProcessing || isStarting}
          className="flex-1"
          placeholder="Enter or select a Connection Name"
          freeform
        >
          {savedCredentials.map((cred, idx) => (
            <Option key={cred.connection_id || `temp-${idx}`} value={cred.connection_id || ""}>
              {cred.CONNECTION_NAME || cred.QLIK_TENANT_URL}
            </Option>
          ))}
        </Combobox>

        <Button
          size="sm"
          onClick={fetchConfig}
          disabled={isProcessing || isStarting || loadingQlik}
        >
          {loadingQlik ? <Spinner size="tiny" /> : "Configure"}
        </Button>

        <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogContent className="w-[560px] max-w-[calc(100vw-32px)]">
            <DialogTitle>Configure Source Connection</DialogTitle>

            <div className="mt-4 flex flex-col gap-4">
              {/* ── Saved Connections + add / delete ── */}
              <div className="mb-2 flex items-end gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label weight="semibold" className="!mb-0 text-primary">Saved Connections</Label>
                    <Tooltip
                      content="Select a previously saved Qlik connection configuration or create a new one."
                      relationship="label"
                    >
                      <Info size={16} className="cursor-help text-muted-foreground" />
                    </Tooltip>
                  </div>
                  <Dropdown
                    className="mt-1 w-full"
                    placeholder="Production Qlik Cloud Connection"
                    selectedOptions={[selectedConnectionId]}
                    onOptionSelect={(_, d) => handleConnectionSelect(d.optionValue as string)}
                  >
                    {savedCredentials.map((c, idx) => (
                      <Option key={c.connection_id || `temp-${idx}`} value={c.connection_id || ""}>
                        {c.CONNECTION_NAME || c.QLIK_TENANT_URL}
                      </Option>
                    ))}
                  </Dropdown>
                </div>
                <button
                  type="button"
                  title="Add New Connection"
                  onClick={handleAddNew}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                >
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  title="Delete Selected Connection"
                  onClick={handleDeleteConnection}
                  disabled={!selectedConnectionId || loadingQlik}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive-subtle disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* ── Connection Name ── */}
              <div className="border-t border-border pb-4 pt-4">
                {toastMessage && (
                  <div
                    className={[
                      "mb-3 rounded-md border px-3 py-2 text-sm",
                      toastMessage.type === "success"
                        ? "border-success/30 bg-success-subtle text-success"
                        : "border-destructive/30 bg-destructive-subtle text-destructive",
                    ].join(" ")}
                  >
                    <div className="font-semibold">{toastMessage.type === "success" ? "Success" : "Error"}</div>
                    {toastMessage.text}
                  </div>
                )}
                {error && (
                  <div className="mb-3 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
                    <div className="font-semibold">Error</div>
                    {error}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Label weight="semibold" className="!mb-0">
                      Connection Name <span className="text-destructive">*</span>
                    </Label>
                    <Tooltip
                      content="A friendly name to identify this connection (e.g., Production, QA, Dotnet)."
                      relationship="label"
                    >
                      <Info size={16} className="cursor-help text-muted-foreground" />
                    </Tooltip>
                  </div>
                  {qlikCredentials?.connection_id && !isConnectionNameEditable && (
                    <button
                      type="button"
                      title="Edit Connection Name"
                      onClick={() => setIsConnectionNameEditable(true)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {isConnectionNameEditable && (
                    <button
                      type="button"
                      title="Cancel Edit"
                      onClick={() => {
                        setIsConnectionNameEditable(false);
                        setConfigConnectionName(qlikCredentials?.CONNECTION_NAME || "");
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <Input
                  className="mt-1 w-full"
                  value={configConnectionName}
                  onChange={(e) => setConfigConnectionName(e.target.value)}
                  placeholder="e.g. Production Qlik"
                  disabled={!!qlikCredentials?.connection_id && !isConnectionNameEditable}
                />
              </div>

              {/* ── Qlik Cloud URL (was: Tableau URL) ── */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-1.5">
                  <Label weight="semibold" className="!mb-0">Qlik Cloud URL</Label>
                  <FieldTooltip
                    location="Qlik Cloud Browser URL"
                    description="“Enter your Qlik Cloud tenant URL used to access your Qlik Cloud environment.”"
                  />
                </div>
                <Input
                  className="mt-1 w-full"
                  value={configQlikUrl}
                  onChange={(e) => setConfigQlikUrl(e.target.value)}
                  placeholder="https://your-tenant.us.qlikcloud.com"
                />
              </div>

              {/* ── API Key (was: TCM Base URL / Qlik Cloud API) ── */}
              <div>
                <div className="flex items-center gap-1.5">
                  <Label weight="semibold" className="!mb-0">API Key</Label>
                  <FieldTooltip
                    location="Qlik Cloud Management Console → API Keys"
                    description="“The API key used to authenticate against your Qlik Cloud tenant.”"
                  />
                </div>
                <Input
                  className="mt-1 w-full"
                  type="password"
                  value={configApiKey}
                  onChange={(e) => setConfigApiKey(e.target.value)}
                  // The backend never echoes a stored key back (write-only), so this
                  // reads blank for a saved connection even though one exists --
                  // say so, since Save now leaves an untouched key alone rather than
                  // clearing it. Kept short like the other placeholders in this form
                  // so it doesn't crowd/overflow the input at the dialog's fixed width.
                  placeholder={
                    qlikCredentials?.connection_id
                      ? "Leave blank to keep the saved key"
                      : "Enter your Qlik Cloud API key"
                  }
                  autoComplete="off"
                />
              </div>
            </div>

            {/* ── Footer: status on the left, actions on the right ── */}
            <div className="mt-6 flex items-center justify-between gap-6 border-t border-border pt-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {configStatus === "success" && (
                  <>
                    <CheckCircle2 size={20} className="text-success" />
                    <span className="whitespace-nowrap text-sm font-semibold text-success">
                      Connection Successful
                    </span>
                  </>
                )}
                {configStatus === "error" && (
                  <>
                    <XCircle size={20} className="text-destructive" />
                    <span className="whitespace-nowrap text-sm font-semibold text-destructive">
                      Connection Failed
                    </span>
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsConfigDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={loadingQlik}>
                  {loadingQlik ? <Spinner size="tiny" /> : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default QlikConnectionConfigContent;
