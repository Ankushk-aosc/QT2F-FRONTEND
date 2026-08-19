/**
 * Rewrites outbound Tableau request bodies so credentials are resolved by the
 * backend rather than sent from here.
 *
 * The migration backend authenticates Tableau by `connection_id`, looking the
 * credential up in Key Vault. Older call sites still build bodies containing a
 * `TABLEAU_SERVER_URL`, so this strips that and ensures a connection id is
 * present instead.
 *
 * Extracted from `httpClient.ts` so it can be unit tested. It sits on the path
 * of every Tableau migration request, and a mistake here silently sends a
 * customer's request to the wrong tenant — which is exactly what happened
 * before: a hardcoded fallback id meant any deployment without
 * `DEFAULT_CONNECTION_ID` set routed migrations through a connection belonging
 * to another environment.
 *
 * Deliberately has no `server-only` import: it is pure, and the tests need it.
 * It is only ever called from server-side code.
 */

/** Keys whose presence means "this body names a Tableau server directly". */
const SERVER_URL_KEYS = ["TABLEAU_SERVER_URL", "tableau_server_url"] as const;

export interface InterceptOptions {
  /** Value of `DEFAULT_CONNECTION_ID`, or undefined when not configured. */
  defaultConnectionId?: string;
  /** Injected for tests; defaults to `console.warn`. */
  warn?: (message: string) => void;
}

/**
 * Returns the body to send.
 *
 * Throws when a body names a Tableau server, carries no `connection_id`, and no
 * default is configured. Refusing is the only safe outcome — guessing a
 * connection runs the request against an unrelated tenant.
 */
export function interceptTableauPayload<T>(body: T, options: InterceptOptions = {}): T {
  if (!body || typeof body !== "object") return body;

  const next = { ...(body as Record<string, unknown>) };
  let namesAServer = false;

  for (const key of SERVER_URL_KEYS) {
    if (key in next) {
      delete next[key];
      namesAServer = true;
    }
  }

  if (!namesAServer) return next as T;

  if (!next.connection_id) {
    const fallback = options.defaultConnectionId;
    if (!fallback) {
      throw new Error(
        "[HttpClient] Tableau request omitted connection_id and DEFAULT_CONNECTION_ID is not configured. " +
          "Refusing to guess a connection. Pass an explicit connection_id, or set DEFAULT_CONNECTION_ID for this environment.",
      );
    }

    const warn = options.warn ?? ((message: string) => console.warn(message));
    warn(
      "[HttpClient] Tableau request omitted connection_id; falling back to DEFAULT_CONNECTION_ID. " +
        "This is a legacy path — the caller should pass an explicit connection_id.",
    );
    next.connection_id = fallback;
  }

  return next as T;
}
