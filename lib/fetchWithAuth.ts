// lib/fetchWithAuth.ts
// Client-side authenticated fetch with automatic MSAL token refresh on 401.
// Tokens are stored in sessionStorage (never localStorage) to reduce XSS exposure.

export async function fetchWithAuth<T = any>(
  url: string,
  options: RequestInit = {},
  tokenKey: string = "access_token"
): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("fetchWithAuth must only be called on the client side.");
  }

  // Dynamically import MSAL wrapper to avoid SSR bundling
  const { getActiveToken } = await import("@/components/providers/MsalProviderWrapper");

  const attemptFetch = async (retryCount: number = 0): Promise<T> => {
    // Read token from sessionStorage (XSS-safer than localStorage)
    let token = sessionStorage.getItem(tokenKey);

    // Acquire fresh token if none stored
    if (!token) {
      token = await getActiveToken();
      if (token) {
        sessionStorage.setItem(tokenKey, token);
      }
    }

    if (!token) {
      throw new Error("Unable to acquire access token. Please sign in again.");
    }

    const requestHeaders: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, {
      ...options,
      headers: requestHeaders,
    });

    // ── 401: Clear stale token, refresh once, then retry ──
    if (response.status === 401) {
      if (retryCount >= 1) {
        // Already retried — avoid infinite loop, force re-login
        sessionStorage.removeItem(tokenKey);
        throw new Error("Session expired. Please sign in again.");
      }

      // Remove expired token and acquire a fresh one
      sessionStorage.removeItem(tokenKey);

      try {
        const freshToken = await getActiveToken();
        if (freshToken) {
          sessionStorage.setItem(tokenKey, freshToken);
        }
      } catch (refreshErr) {
        console.error("[fetchWithAuth] Token refresh failed:", refreshErr);
        throw new Error("Failed to refresh access token. Please sign in again.");
      }

      return attemptFetch(retryCount + 1);
    }

    // ── Non-2xx errors ──
    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        // Body already consumed or empty
      }
      throw new Error(
        `Request failed [${response.status} ${response.statusText}]: ${errorText}`
      );
    }

    // ── Parse JSON ──
    try {
      const data = await response.json();
      return data as T;
    } catch {
      // Some endpoints return 204 No Content or plain text
      return {} as T;
    }
  };

  return attemptFetch();
}