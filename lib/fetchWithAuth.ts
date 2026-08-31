// fetchWithAuth.ts
// Client-side authenticated fetch with automatic token refresh on 401

// No request here ever aborted on its own -- a Next.js API route stuck
// waiting on a hung backend (see lib/api/httpClient.ts) left this call
// pending in lockstep, so the component that awaited it just never
// resolved. 60s gives the server-side timeout room to fire and respond with an error first,
// while accommodating Render's ~50s free tier cold starts.
const DEFAULT_TIMEOUT_MS = 60000;

export async function fetchWithAuth<T = any>(
  url: string,
  options: RequestInit = {},
  tokenKey: string = "access_token"
): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("fetchWithAuth should only be used on the client side.");
  }

  // Dynamically import to avoid SSR issues
  const { getActiveToken, getFabricToken } = await import("@/components/providers/MsalProviderWrapper");

  // Fabric-scoped calls must use the Fabric-audience acquirer — a plain
  // bearer token is minted for a different audience and Fabric rejects it.
  const acquireToken = (forceRefresh: boolean = false) =>
    tokenKey === "fabric_access_token" ? getFabricToken(forceRefresh) : getActiveToken(forceRefresh);

  const attemptFetch = async (retryCount: number = 0): Promise<T> => {
    // Get current token (from storage or fresh if missing)
    let token = sessionStorage.getItem(tokenKey);

    // If no token exists at all → acquire one
    if (!token) {
      console.log(`[fetchWithAuth] No token found → acquiring new one`);
      token = await acquireToken();
      sessionStorage.setItem(tokenKey, token);
    }

    if (!token) {
      throw new Error("Unable to acquire access token. Please sign in again.");
    }

    const headers: HeadersInit = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    console.log(`[fetchWithAuth] Requesting: ${url} (attempt ${retryCount + 1})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.warn(`[fetchWithAuth] Timed out after ${DEFAULT_TIMEOUT_MS}ms: ${url}`);
        throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s. The backend may be down or unreachable.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // ────────────────────────────────────────────────
    // Handle 401 → try to refresh token and retry (once)
    // ────────────────────────────────────────────────
    if (response.status === 401) {
      if (retryCount >= 1) {
        // Already retried once → don't loop forever
        console.warn(`[fetchWithAuth] 401 after retry → giving up: ${url}`);
        throw new Error("Unauthorized: Invalid or expired token after refresh attempt");
      }

      console.warn(`[fetchWithAuth] 401 Unauthorized → attempting token refresh`);

      // Clear old (probably expired) token
      sessionStorage.removeItem(tokenKey);

      // forceRefresh MUST be true here. MSAL has no idea the server rejected
      // the token, so as far as its cache is concerned the entry is still
      // valid and a plain acquireTokenSilent hands back the very same string —
      // the retry then fails identically and the request dies on a 401 that
      // would have healed. Forcing the refresh redeems the refresh token and
      // yields a genuinely new access token.
      try {
        token = await acquireToken(true);
        sessionStorage.setItem(tokenKey, token);
      } catch (refreshErr) {
        console.warn("[fetchWithAuth] Token refresh failed", refreshErr);
        // Rethrow the original: callers (and the session-expired handling in
        // MsalProviderWrapper) need the AADSTS code to tell an expired session
        // apart from a transient failure. Wrapping it in a generic Error threw
        // that away.
        throw refreshErr;
      }

      // Retry the original request with new token
      return attemptFetch(retryCount + 1);
    }

    // ────────────────────────────────────────────────
    // Normal error handling
    // ────────────────────────────────────────────────
    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        // body already consumed or empty
      }
      throw new Error(
        `Request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // ────────────────────────────────────────────────
    // Parse JSON response
    // ────────────────────────────────────────────────
    const rawBody = await response.text();
    if (!rawBody) {
      return {} as T;
    }
    try {
      return JSON.parse(rawBody) as T;
    } catch (parseErr) {
      console.warn("[fetchWithAuth] Response is not JSON", parseErr);
      throw new Error("Failed to parse JSON response from server");
    }
  };

  return attemptFetch();
}