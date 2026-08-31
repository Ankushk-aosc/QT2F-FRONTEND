import "server-only";

/**
 * Tableau discovery via the existing migration backend.
 *
 * Delegates to the `TABLEAU_API_URL` microservice already used by the Tableau
 * migration flow, so personal access tokens stay in the backend's Key Vault.
 *
 * The microservice exposes projects and workbooks for a site. Sites are listed
 * only where a Tableau Cloud Manager base URL is configured; data sources,
 * flows, schedules, permissions and users have no endpoint today and are
 * reported as unsupported rather than as empty.
 */

import { httpClient } from "@/lib/api/httpClient";
import type { MetadataCollection, MetadataItem } from "@/types/connectors";

import {
  mapWithConcurrency,
  supported,
  toErrorMessage,
  unsupported,
  type ConnectionTestResult,
  type DiscoveryAdapter,
  type DiscoveryContext,
} from "./types";

const NOT_EXPOSED =
  "The migration backend does not expose this category. It appears once a native Tableau REST adapter is wired.";

/** Projects queried in parallel for their workbooks. */
const WORKBOOK_FETCH_CONCURRENCY = 3;

interface TableauProject {
  id?: string;
  project_id?: string;
  name?: string;
  project_name?: string;
  description?: string;
}

interface TableauWorkbook {
  id?: string;
  workbook_id?: string;
  name?: string;
  workbook_name?: string;
  project_id?: string;
  owner?: string;
}

interface TableauSite {
  id?: string;
  site_id?: string;
  name?: string;
  site_name?: string;
  contentUrl?: string;
}

/**
 * Assembles the credential half of a backend request.
 *
 * The token secret is forwarded only when the administrator supplied one this
 * session. Otherwise the backend resolves it from Key Vault itself, which is
 * the normal path — this application does not store Tableau tokens.
 */
function credentialFields(context: DiscoveryContext): Record<string, string> {
  const values = context.connection.values;

  const fields: Record<string, string> = {
    email: context.userEmail,
    TABLEAU_SERVER_URL: String(values.serverUrl ?? ""),
    TABLEAU_SITE_NAME: String(values.site ?? ""),
    TABLEAU_TOKEN_NAME: String(values.patName || "token"),
    server_url: String(values.serverUrl ?? ""),
    site_name: String(values.site ?? ""),
    token_name: String(values.patName || "token"),
    tableau_server_url: String(values.serverUrl ?? ""),
    tableau_site_name: String(values.site ?? ""),
    tableau_token_name: String(values.patName || "token"),
  };

  const secret = context.secrets.patSecret;
  if (secret) {
    fields.TABLEAU_TOKEN_VALUE = secret;
    fields.token_value = secret;
    fields.tableau_token_value = secret;
  }

  const connectionId = String(values.connectionId ?? "");
  if (connectionId) {
    fields.connection_id = connectionId;
  }

  return fields;
}

/** The administrator's explicit choice, falling back to sniffing the URL. */
function envType(context: DiscoveryContext): "cloud" | "cloud_trial" | "server" {
  const declared = String(context.connection.values.envType ?? "");
  if (declared === "cloud" || declared === "cloud_trial" || declared === "server") {
    return declared;
  }
  const serverUrl = String(context.connection.values.serverUrl ?? "");
  return serverUrl.includes("tableau.com") ? "cloud" : "server";
}

function requestHeaders(context: DiscoveryContext): Record<string, string> {
  return {
    Authorization: context.authHeader,
    // The backend switches behaviour on this header; a Tableau Cloud pod URL
    // and a self-hosted server hit different code paths. cloud_trial shares the
    // cloud code path but has no Cloud Manager.
    "x-tableau-environment": envType(context) === "server" ? "server" : "cloud",
  };
}

function isCloud(context: DiscoveryContext): boolean {
  return envType(context) === "cloud";
}

// ---------------------------------------------------------------------------
// Key Vault registration
// ---------------------------------------------------------------------------

interface BackendConnection {
  id?: string;
  connection_id?: string;
  connection_name?: string;
  CONNECTION_NAME?: string;
}

/**
 * Registers this connector's configuration with the migration backend so the
 * credential lands in Key Vault and gets a `connection_id`.
 *
 * This is the bridge that makes "configure once" true for Tableau. The Tableau
 * migration screen has always driven itself from `connection_id` — it never
 * sends the token — but its connections came from a separate store that a
 * Settings save did not write to, so configuring Tableau in Settings left the
 * migration screen unable to use it.
 *
 * Registering here puts both on the same store: the connection configured in
 * Settings simply appears among the migration screen's saved connections.
 *
 * Deliberately reuses the existing `/connections` endpoint rather than adding a
 * connector-specific one — a second write path to the same Key Vault entries is
 * how the two stores diverged in the first place.
 *
 * Returns the id, or "" when registration did not complete. A failure here is
 * not fatal: the adapter falls back to sending explicit credentials, which is
 * how it behaved before.
 */
async function registerConnection(context: DiscoveryContext): Promise<string> {
  const values = context.connection.values;
  const existingId = String(values.connectionId ?? "");
  const env = envType(context);

  const payload: Record<string, string> = {
    env_type: env,
    connection_name: context.connection.connectionName || "Tableau",
    tableau_server_url: String(values.serverUrl ?? ""),
    tableau_site_name: String(values.site ?? ""),
    tableau_token_name: String(values.patName || "token"),
    tcm_base_url: env === "cloud" ? String(values.tcmBaseUrl ?? "") : "",
  };

  console.log("[Tableau registerConnection] Preparing payload:", {
    env_type: payload.env_type,
    connection_name: payload.connection_name,
    tableau_server_url: payload.tableau_server_url.substring(0, 50),
    tableau_site_name: payload.tableau_site_name,
    tableau_token_name: payload.tableau_token_name,
    hasTokenSecret: !!context.secrets.patSecret,
    existingId: existingId || "new",
  });

  // Secrets are only sent when the administrator supplied a new one. Omitting
  // them on an edit leaves the stored credential untouched rather than
  // overwriting it with a blank.
  if (context.secrets.patSecret) {
    payload.tableau_token_value = context.secrets.patSecret;
    console.log("[Tableau registerConnection] ✓ Token secret included in payload");
  } else {
    console.warn("[Tableau registerConnection] ⚠ WARNING: No token secret found! This will fail authentication.");
  }
  
  if (env === "cloud" && context.secrets.tcmTokenSecret) {
    payload.tcm_token_secret = context.secrets.tcmTokenSecret;
    console.log("[Tableau registerConnection] ✓ TCM token secret included in payload");
  }

  // `skipPayloadIntercept` is essential here, not an optimisation. The default
  // payload interceptor strips `tableau_server_url` and injects a fallback
  // `connection_id` — which on this endpoint would turn a create into an update
  // of an unrelated connection and write this tenant's token over its
  // credentials.
  const options = {
    apiType: "tableau" as const,
    headers: { Authorization: context.authHeader },
    skipPayloadIntercept: true,
  };

  if (existingId) {
    console.log("[Tableau registerConnection] Updating existing connection:", existingId);
    await httpClient.patch(`/connections/${encodeURIComponent(existingId)}`, payload, options);
    return existingId;
  }

  console.log("[Tableau registerConnection] Creating new connection...");
  await httpClient.post("/connections", payload, options);

  // The create response shape is not guaranteed to carry the id, so it is read
  // back from the list by name — the same resolution the migration screen
  // already performs after saving.
  const listed = await httpClient.get<unknown>(`/connections?env_type=${env}`, options);
  const connections = asArray<BackendConnection>(listed, "connections");
  const match = connections.find(
    (candidate) =>
      (candidate.connection_name ?? candidate.CONNECTION_NAME) === payload.connection_name,
  );

  const resolved = String(match?.id ?? match?.connection_id ?? "");
  if (!resolved) {
    throw new Error(
      "The connection was created but the backend did not return an id for it, so it cannot be used for a migration.",
    );
  }
  console.log("[Tableau registerConnection] ✓ Connection registered with id:", resolved);
  return resolved;
}

function asArray<T>(payload: unknown, ...keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
    const nested = record.data;
    if (nested && typeof nested === "object") {
      for (const key of keys) {
        const value = (nested as Record<string, unknown>)[key];
        if (Array.isArray(value)) return value as T[];
      }
    }
  }
  return [];
}

async function fetchProjects(context: DiscoveryContext): Promise<TableauProject[]> {
  const credFields = credentialFields(context);
  const payload = { ...credFields, source_type: isCloud(context) ? "cloud" : "server" };
  
  console.log("[Tableau fetchProjects] Payload being sent:", {
    email: credFields.email,
    tableau_server_url: credFields.tableau_server_url?.substring(0, 50),
    tableau_site_name: credFields.tableau_site_name,
    tableau_token_name: credFields.tableau_token_name,
    hasTableauTokenValue: !!credFields.tableau_token_value,
    hasConnectionId: !!credFields.connection_id,
    source_type: payload.source_type,
  });

  const data = await httpClient.post<unknown>(
    "/propagate-tableau-details",
    payload,
    { apiType: "tableau", headers: requestHeaders(context), skipPayloadIntercept: true },
  );
  return asArray<TableauProject>(data, "projects");
}

async function fetchWorkbooks(
  context: DiscoveryContext,
  projectId: string,
): Promise<TableauWorkbook[]> {
  const data = await httpClient.post<unknown>(
    "/get-workbooks",
    { ...credentialFields(context), PROJECT_ID: [projectId] },
    { apiType: "tableau", headers: requestHeaders(context), skipPayloadIntercept: true },
  );
  return asArray<TableauWorkbook>(data, "workbooks");
}

async function fetchSites(context: DiscoveryContext): Promise<TableauSite[]> {
  // Site listing is a Cloud Manager call, so it takes the TCM base URL — not
  // the Tableau pod URL, which was what this sent before and which TCM rejects.
  const connectionId = String(context.connection.values.connectionId ?? "");
  const body: Record<string, string> = {
    tcm_base_url: String(context.connection.values.tcmBaseUrl ?? ""),
  };
  if (connectionId) {
    body.connection_id = connectionId;
  } else if (context.secrets.tcmTokenSecret) {
    body.tcm_token_secret = context.secrets.tcmTokenSecret;
  }

  const data = await httpClient.post<unknown>("/get-all-tenant-sites", body, {
    apiType: "tableau",
    headers: requestHeaders(context),
  });
  return asArray<TableauSite>(data, "sites");
}

export const tableauBackendAdapter: DiscoveryAdapter = {
  connectorId: "tableau",

  async test(context: DiscoveryContext): Promise<ConnectionTestResult> {
    let connectionId: string;

    // Log what we're trying to register
    const values = context.connection.values;
    console.log("[Tableau Discovery] Testing connection with:", {
      serverUrl: String(values.serverUrl ?? "").substring(0, 50),
      site: String(values.site ?? ""),
      patName: String(values.patName ?? "TableauToken"),
      hasPatSecret: !!context.secrets.patSecret,
      envType: envType(context),
      userEmail: context.userEmail,
    });

    // Registration is a precondition, not a best-effort step, so its failure is
    // reported on its own terms rather than as a Tableau authentication
    // problem. Without an id there is nothing a migration could run against.
    try {
      connectionId = await registerConnection(context);
      console.log("[Tableau Discovery] Connection registered with id:", connectionId);
    } catch (error) {
      console.error("[Tableau Discovery] Registration failed:", error);
      return {
        ok: false,
        message: toErrorMessage(
          error,
          "Could not register the Tableau connection with the migration backend, so the credential was not stored.",
        ),
      };
    }

    try {
      // Verify through the same `connection_id` path a migration will use.
      // Falling back to an inline token here would test a different code path
      // than the one that actually runs — and the payload interceptor would
      // rewrite it to some other connection, which could report "Connected"
      // for credentials that were never exercised.
      const verifyContext: DiscoveryContext = {
        ...context,
        connection: {
          ...context.connection,
          values: { ...context.connection.values, connectionId },
        },
      };

      console.log("[Tableau Discovery] Verifying credentials by listing projects...");

      // Listing projects is the cheapest call that proves the token, the site
      // and the server URL are all correct together.
      const projects = await fetchProjects(verifyContext);
      const site = String(verifyContext.connection.values.site ?? "");

      console.log("[Tableau Discovery] ✓ Authentication successful, found projects:", projects.length);

      return {
        ok: true,
        message: `Connected to Tableau. ${projects.length} project${projects.length === 1 ? "" : "s"} visible.`,
        connectedUser: context.userEmail,
        connectedWorkspace: site,
        version: isCloud(context) ? "Tableau Cloud" : "Tableau Server",
        values: { connectionId },
      };
    } catch (error) {
      console.error("[Tableau Discovery] Authentication verification failed:", error);
      
      // Provide specific guidance based on error
      let message = "Could not reach Tableau. Check the server URL, site and personal access token.";
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes("401") || errorMsg.includes("unauthorized")) {
          message = "Authentication failed: Check your Personal Access Token name and secret. Ensure they match exactly what you created in Tableau.";
        } else if (errorMsg.includes("site")) {
          message = "Site verification failed: Check that the Site name (content URL) is correct.";
        } else if (errorMsg.includes("url") || errorMsg.includes("server")) {
          message = "Server connection failed: Check that the Server URL is correct and accessible from this network.";
        }
      }
      
      return {
        ok: false,
        message: toErrorMessage(error, message),
      };
    }
  },

  async discover(context: DiscoveryContext): Promise<MetadataCollection[]> {
    const projects = await fetchProjects(context);

    const projectItems: MetadataItem[] = projects.map((project) => ({
      id: String(project.id ?? project.project_id ?? ""),
      name: String(project.name ?? project.project_name ?? "Unnamed project"),
      detail: project.description || undefined,
    }));

    const workbookResults = await mapWithConcurrency(
      projectItems.filter((project) => project.id !== ""),
      WORKBOOK_FETCH_CONCURRENCY,
      async (project) => {
        try {
          return { projectId: project.id, workbooks: await fetchWorkbooks(context, project.id), error: null as string | null };
        } catch (error) {
          return {
            projectId: project.id,
            workbooks: [] as TableauWorkbook[],
            error: toErrorMessage(error, "unreadable"),
          };
        }
      },
    );

    // Keyed by workbook id for the same reason as Qlik apps: a workbook can be
    // returned by more than one project query, and appending each sighting
    // produced duplicates that collided on their React key in the metadata
    // viewer. First sighting wins, so `parentId` is the earliest project in the
    // stable order the projects were listed in.
    const workbooks = new Map<string, MetadataItem>();
    const owners = new Map<string, MetadataItem>();

    for (const result of workbookResults) {
      for (const workbook of result.workbooks) {
        const id = String(workbook.id ?? workbook.workbook_id ?? "");
        if (!id) continue;

        if (!workbooks.has(id)) {
          workbooks.set(id, {
            id,
            name: String(workbook.name ?? workbook.workbook_name ?? id),
            parentId: result.projectId,
          });
        }

        const owner = String(workbook.owner ?? "");
        if (owner && !owners.has(owner)) {
          owners.set(owner, { id: owner, name: owner });
        }
      }
    }

    const failedProjects = workbookResults.filter((result) => result.error !== null).length;
    const workbookNote =
      failedProjects > 0
        ? `${failedProjects} project${failedProjects === 1 ? "" : "s"} could not be read and were skipped.`
        : undefined;

    // Site listing needs Tableau Cloud Manager, which self-hosted Tableau Server
    // does not have. Attempt it only for Cloud, and treat a failure as
    // unsupported rather than failing the whole sync.
    let sites: MetadataCollection;
    if (isCloud(context)) {
      try {
        const fetched = await fetchSites(context);
        sites = supported(
          "sites",
          "Sites",
          fetched.map((site) => ({
            id: String(site.id ?? site.site_id ?? ""),
            name: String(site.name ?? site.site_name ?? site.contentUrl ?? "Unnamed site"),
          })),
        );
      } catch (error) {
        sites = unsupported(
          "sites",
          "Sites",
          `Site listing requires a Tableau Cloud Manager token: ${toErrorMessage(error, "request failed")}.`,
        );
      }
    } else {
      sites = unsupported(
        "sites",
        "Sites",
        "Tableau Server exposes a single site, configured above.",
      );
    }

    return [
      sites,
      supported("projects", "Projects", projectItems),
      supported("workbooks", "Workbooks", [...workbooks.values()], workbookNote),
      supported(
        "owners",
        "Owners",
        [...owners.values()],
        owners.size === 0 ? "Derived from workbook ownership; none reported." : "Derived from workbook ownership.",
      ),
      unsupported("datasources", "Data sources", NOT_EXPOSED),
      unsupported("flows", "Flows", NOT_EXPOSED),
      unsupported("schedules", "Schedules", NOT_EXPOSED),
      unsupported("permissions", "Permissions", NOT_EXPOSED),
      unsupported("users", "Users", NOT_EXPOSED),
    ];
  },
};
