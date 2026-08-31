"use client";

/**
 * Fabric access token acquisition for run starts.
 *
 * Every Semantic Kernel start payload carries `fabric_access_token`, minted in
 * the browser via MSAL against `https://api.fabric.microsoft.com/.default`. The
 * server never sources it: only the signed-in user's MSAL session can produce a
 * token scoped to that user's Fabric tenant.
 *
 * Consolidates the try/refresh/fall-back-to-sessionStorage block that was
 * copy-pasted three times in stores/validation.store.ts.
 */

const CACHE_KEY = "fabric_access_token";

/**
 * Returns a Fabric access token, refreshing it first.
 *
 * Always force-refreshes rather than reusing the cached value. A migration run
 * outlives the request that starts it -- the backend keeps using this token to
 * write into Fabric long after we get our response -- so handing over a token
 * that is already most of the way through its ~1h lifetime causes the run to
 * fail partway with no obvious cause. The cached value is a fallback for when
 * the refresh itself fails, not the happy path.
 *
 * Throws rather than returning undefined: `fabric_access_token` is required by
 * both start endpoints, so a caller that omits it produces a request the
 * backend rejects for a reason that is hard to trace back to a missing token.
 */
export async function getFabricAccessToken(): Promise<string> {
  const { getFabricToken, getActiveToken, isExpiredSessionError, isMfaOrInteractionRequired } =
    await import("@/components/providers/MsalProviderWrapper");

  try {
    const token = await getFabricToken(true);

    // Refresh the backend bearer in the same pass. Our own route handlers
    // forward it upstream, and it expires on a similar clock -- letting it go
    // stale here means the start request 401s at the proxy having already paid
    // for the Fabric refresh. Non-fatal: the Fabric token is what the payload
    // needs, so a failure here should not sink the run.
    await getActiveToken(true).catch((err) => {
      console.warn("[fabricToken] Backend token refresh failed (non-fatal)", err);
    });

    if (token) return token;
    console.warn("[fabricToken] Refresh returned an empty token; trying cache");
  } catch (err) {
    /**
     * A confirmed-dead session, or one that needs an interactive MFA/consent
     * prompt, has already been reported by this point -- getFabricToken
     * dispatches SESSION_EXPIRED_EVENT (raising the app's own re-auth screen)
     * or kicks off a popup/full-page redirect before it ever throws here.
     * Falling through to the cached-token fallback below in that case would
     * silently hand back a token minted before the session died: the caller
     * (starting a migration run) would proceed as if nothing were wrong, and
     * the run then fails later -- server-side, minutes in, for a reason with
     * no visible connection to "you needed to sign in again". That is exactly
     * the "hides the error" failure mode this fix closes.
     *
     * Only genuinely transient failures -- a network blip, MSAL still
     * finishing initialization ("Auth not initialized"/"No active account")
     * -- should fall through to the cache below; a confirmed-dead or
     * interaction-required session must not.
     */
    if (isExpiredSessionError(err) || isMfaOrInteractionRequired(err)) {
      throw new Error(
        "Your session has expired. Please sign in again before starting a migration."
      );
    }
    console.warn("[fabricToken] Refresh failed; trying cached token", err);
  }

  const cached =
    typeof window !== "undefined" ? sessionStorage.getItem(CACHE_KEY) : null;
  if (cached) {
    console.warn("[fabricToken] Using cached token — it may be close to expiry");
    return cached;
  }

  throw new Error(
    "Could not obtain a Fabric access token. Please sign in again and retry."
  );
}
