"use client";

import { MsalProvider } from "@azure/msal-react";
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  BrowserAuthError,
  AccountInfo,
  InteractionStatus,
} from "@azure/msal-browser";
import { ReactNode, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useUIStore } from "@/stores/ui.store";
import { MIGRATION_MODE } from "@/lib/constants";

export let globalApiScope: string = "";

// ─── Singleton MSAL instance ───────────────────────────────────────────────────
// There must be exactly one PublicClientApplication for the lifetime of the app.
// globalMsalInstance is set once and never replaced.
let globalMsalInstance: PublicClientApplication | null = null;

// ─── Initialization guard ──────────────────────────────────────────────────────
// Prevents double-initialization caused by React Strict Mode (effects run twice
// in development) or any other re-mount scenario.
// The promise is stored so a second caller can await the first and get the same result.
let initializationPromise: Promise<PublicClientApplication> | null = null;

// ─── In-flight token deduplication ────────────────────────────────────────────
// Maps a scope-string → in-flight Promise<string> so concurrent callers
// (dashboard, connectors, fetchWithAuth, proactive refresh) share one MSAL round-trip
// instead of hammering MSAL with parallel requests.
const tokenInflight = new Map<string, Promise<string>>();

/**
 * Returns true once the MSAL PublicClientApplication has been created
 * AND initialize() + handleRedirectPromise() have both completed.
 * Safe to call at any time (returns false before init, never throws).
 */
export function isMsalReady(): boolean {
  return globalMsalInstance !== null;
}

/**
 * Returns the current MSAL interaction status.
 * Returns null if MSAL has not been initialized yet.
 */
function getMsalInteractionStatus(): InteractionStatus | null {
  if (!globalMsalInstance) return null;
  return (globalMsalInstance as any).getInteractionStatus?.() ?? null;
}

/**
 * Returns true when MSAL is currently handling an interactive operation
 * (Login, Redirect, Popup, AcquireToken, Logout, SsoSilent, etc.).
 * We must NOT open another popup while this is true.
 */
function isMsalInteracting(): boolean {
  const status = getMsalInteractionStatus();
  if (status === null) return false;
  return status !== InteractionStatus.None;
}

/**
 * Returns true if an error indicates that the MSAL session or token has expired.
 */
export function isExpiredSessionError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || err.errorCode || err.toString() || "").toLowerCase();
  return (
    msg.includes("session_expired") ||
    msg.includes("user_cancelled") ||
    msg.includes("no active account") ||
    msg.includes("token_expired") ||
    msg.includes("aadsts50173") ||
    msg.includes("aadsts500133") ||
    msg.includes("invalid_grant")
  );
}

/**
 * Returns true if an error indicates that interactive MFA, login, or consent is required.
 */
export function isMfaOrInteractionRequired(err: any): boolean {
  if (!err) return false;
  if (err instanceof InteractionRequiredAuthError) return true;
  const msg = (err.message || err.errorCode || err.toString() || "").toLowerCase();
  return (
    msg.includes("interaction_required") ||
    msg.includes("consent_required") ||
    msg.includes("login_required") ||
    msg.includes("aadsts50076") ||
    msg.includes("aadsts50079") ||
    msg.includes("aadsts65001")
  );
}

// ─── Refresh-token seed (server-side confidential flow) ───────────────────────
/**
 * One-time, silent seeding of the server-side refresh_token used by Semantic
 * Kernel for long-run Fabric/OneLake token renewal. Redirects through the
 * confidential auth-code flow only when no RT is currently seeded.
 * Loop-safe: skips if the `t2f_rt_present` cookie exists or already attempted
 * this session.
 */
function maybeSeedRefreshToken(): void {
  if (typeof window === "undefined") return;

  const hasRt = document.cookie
    .split("; ")
    .some((c) => c.startsWith("t2f_rt_present="));
  const attempted = sessionStorage.getItem("t2f_rt_attempted") === "1";

  if (hasRt || attempted) return;

  sessionStorage.setItem("t2f_rt_attempted", "1");
  const returnTo = window.location.pathname + window.location.search;
  console.log("[MsalProviderWrapper] Seeding refresh_token via /api/auth/seed-rt...");
  window.location.href = `/api/auth/seed-rt?returnTo=${encodeURIComponent(returnTo)}`;
}

// ─── Consent resources ────────────────────────────────────────────────────────
type ConsentResource = {
  label: string;
  tokenScopes: string[];
  consentScopes: string[];
  requiredScp: string[];
};

function getConsentResources(): ConsentResource[] {
  return [
    {
      label: "T2F Backend API",
      tokenScopes: [globalApiScope],
      consentScopes: [globalApiScope],
      requiredScp: ["API.Access"],
    },
    {
      label: "Fabric API",
      tokenScopes: ["https://api.fabric.microsoft.com/.default"],
      consentScopes: [
        "https://api.fabric.microsoft.com/Item.Execute.All",
        "https://api.fabric.microsoft.com/Workspace.GitCommit.All",
        "https://api.fabric.microsoft.com/Workspace.GitUpdate.All",
        "https://api.fabric.microsoft.com/Workspace.Read.All",
      ],
      requiredScp: ["Item.Execute.All", "Workspace.Read.All"],
    },
    {
      label: "Power BI Service",
      tokenScopes: ["https://analysis.windows.net/powerbi/api/.default"],
      consentScopes: [
        "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
        "https://analysis.windows.net/powerbi/api/Dataset.ReadWrite.All",
        "https://analysis.windows.net/powerbi/api/Item.Execute.All",
        "https://analysis.windows.net/powerbi/api/Item.ReadWrite.All",
        "https://analysis.windows.net/powerbi/api/Lakehouse.ReadWrite.All",
        "https://analysis.windows.net/powerbi/api/Workspace.GitCommit.All",
        "https://analysis.windows.net/powerbi/api/Workspace.GitUpdate.All",
        "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
        "https://analysis.windows.net/powerbi/api/Workspace.ReadWrite.All",
      ],
      requiredScp: [
        "Dataset.ReadWrite.All",
        "Item.Execute.All",
        "Item.ReadWrite.All",
        "Lakehouse.ReadWrite.All",
        "Workspace.GitCommit.All",
        "Workspace.GitUpdate.All",
        "Workspace.Read.All",
        "Workspace.ReadWrite.All",
      ],
    },
  ];
}

// ─── Token acquisition ────────────────────────────────────────────────────────

/**
 * Acquires a bearer token for the configured API scope.
 *
 * Silent acquisition is always attempted first.
 * If that fails with InteractionRequiredAuthError, a popup is opened — BUT
 * only when MSAL is not already handling another interaction. If MSAL is busy
 * the error is re-thrown so the caller can decide how to handle it.
 *
 * Concurrent calls for the same scope share a single in-flight promise so
 * MSAL is never hit with parallel requests for identical tokens.
 */
export async function getActiveToken(
  forceRefresh: boolean = false
): Promise<string> {
  if (!globalMsalInstance) {
    throw new Error("Auth not initialized");
  }

  const account: AccountInfo | null = globalMsalInstance.getActiveAccount();
  if (!account) {
    throw new Error("No active account! Verify a user has been signed in.");
  }

  const inflightKey = `bearer:${globalApiScope}:${forceRefresh}`;

  // Return the existing in-flight promise if one exists for this key.
  const existing = tokenInflight.get(inflightKey);
  if (existing) return existing;

  const promise = (async (): Promise<string> => {
    try {
      const request = {
        scopes: [globalApiScope],
        account,
        forceRefresh,
      };

      const res = await globalMsalInstance!.acquireTokenSilent(request);
      sessionStorage.setItem("access_token", res.accessToken);
      return res.accessToken;
    } catch (error: unknown) {
      if (error instanceof InteractionRequiredAuthError) {
        // Only open a popup when MSAL is not already busy with another interaction.
        if (isMsalInteracting()) {
          console.warn(
            "[getActiveToken] Silent acquisition failed but MSAL interaction is in progress — cannot open popup now. Will retry silently later."
          );
          throw new Error(
            "interaction_in_progress: Cannot open popup while MSAL is busy. Please retry."
          );
        }

        console.warn(
          "[getActiveToken] Silent acquisition failed → falling back to popup"
        );

        try {
          const res = await globalMsalInstance!.acquireTokenPopup({
            scopes: [globalApiScope],
            account,
          });

          sessionStorage.setItem("access_token", res.accessToken);
          if (process.env.NODE_ENV === "development") {
            console.log("[getActiveToken] New token acquired via popup");
          }
          return res.accessToken;
        } catch (popupError) {
          console.error("[getActiveToken] Popup acquisition failed", popupError);
          throw new Error("Unable to acquire access token (popup failed)");
        }
      }

      console.error("[getActiveToken] Unexpected error", error);
      throw error;
    } finally {
      tokenInflight.delete(inflightKey);
    }
  })();

  // Register the in-flight promise.
  tokenInflight.set(inflightKey, promise);

  return promise;
}


/**
 * Acquires a token for Microsoft Fabric API scope.
 */
export async function getFabricToken(
  forceRefresh: boolean = false
): Promise<string> {
  if (!globalMsalInstance) {
    throw new Error("Auth not initialized");
  }

  const account: AccountInfo | null = globalMsalInstance.getActiveAccount();
  if (!account) {
    throw new Error("No active account! Verify a user has been signed in.");
  }

  const fabricScope = "https://api.fabric.microsoft.com/.default";
  const inflightKey = `fabric:${fabricScope}:${forceRefresh}`;

  const existing = tokenInflight.get(inflightKey);
  if (existing) return existing;

  const promise = (async (): Promise<string> => {
    try {
      const request = {
        scopes: [fabricScope],
        account,
        forceRefresh,
      };

      const res = await globalMsalInstance!.acquireTokenSilent(request);
      sessionStorage.setItem("fabric_access_token", res.accessToken);
      if (process.env.NODE_ENV === "development") {
        console.log("[getFabricToken] Fabric token acquired silently");
      }
      return res.accessToken;
    } catch (error: unknown) {
      if (error instanceof InteractionRequiredAuthError) {
        if (isMsalInteracting()) {
          console.warn(
            "[getFabricToken] Silent acquisition failed but MSAL interaction is in progress — cannot open popup now."
          );
          throw new Error(
            "interaction_in_progress: Cannot open popup while MSAL is busy."
          );
        }

        console.warn(
          "[getFabricToken] Silent acquisition failed → falling back to popup"
        );

        try {
          const res = await globalMsalInstance!.acquireTokenPopup({
            scopes: [fabricScope],
            account,
          });

          sessionStorage.setItem("fabric_access_token", res.accessToken);
          if (process.env.NODE_ENV === "development") {
            console.log("[getFabricToken] New Fabric token acquired via popup");
          }
          return res.accessToken;
        } catch (popupError) {
          console.error("[getFabricToken] Popup acquisition failed", popupError);
          throw new Error("Unable to acquire Fabric access token (popup failed)");
        }
      }

      console.error("[getFabricToken] Unexpected error", error);
      throw error;
    } finally {
      tokenInflight.delete(inflightKey);
    }
  })();

  // Register the in-flight promise.
  tokenInflight.set(inflightKey, promise);

  return promise;
}

// ─── Consent ──────────────────────────────────────────────────────────────────

/**
 * Checks if the user has consented to all required resources.
 * Returns true if all silent token checks pass, false if any need consent.
 *
 * IMPORTANT: Only calls acquireTokenSilent — never triggers redirect or popup.
 * Only call this after MSAL is fully initialized and inProgress === None.
 */
async function checkAllConsents(account: AccountInfo): Promise<boolean> {
  const resourcesToCheck = getConsentResources();

  if (process.env.NODE_ENV === "development") {
    console.group("[ensureConsent] Checking permissions for", account.username);
  }

  for (const resource of resourcesToCheck) {
    try {
      const tokenResponse = await globalMsalInstance!.acquireTokenSilent({
        scopes: resource.tokenScopes,
        account,
      });

      // Decode the token payload to inspect actual granted scopes
      const payload = JSON.parse(atob(tokenResponse.accessToken.split(".")[1]));
      const grantedScp: string[] = payload.scp ? payload.scp.split(" ") : [];

      // Check every required scope is present in the scp claim
      const missingScp = resource.requiredScp.filter(
        (s) => !grantedScp.includes(s)
      );

      if (missingScp.length > 0) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `❌ ${resource.label} — token acquired but missing scopes:`,
            missingScp,
            "\n   Granted scp:", grantedScp
          );
          console.groupEnd();
        }
        return false;
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          `✅ ${resource.label}`,
          "\n   Scopes granted:", tokenResponse.scopes,
          "\n   Token audience:", payload.aud,
          "\n   scp claim:", payload.scp || "(none)",
          "\n   roles claim:", payload.roles || "(none)"
        );
      }
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`❌ ${resource.label} — MISSING CONSENT`);
          console.groupEnd();
        }
        return false;
      }
      console.error(`⚠️ ${resource.label} — unexpected error`, error);
      if (process.env.NODE_ENV === "development") {
        console.groupEnd();
      }
      return false;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.groupEnd();
  }
  return true;
}

/**
 * Silently checks all required resources.
 * Returns true if all consents are in place, false if anything is missing.
 * Never triggers any redirect or popup — only silent checks.
 *
 * Callers must ensure MSAL is initialized and inProgress === None before calling.
 */
export async function ensureConsent(): Promise<boolean> {
  if (!globalMsalInstance) return false;
  const account = globalMsalInstance.getActiveAccount();
  if (!account) return true;
  return checkAllConsents(account);
}

/**
 * Opens a single loginPopup with prompt:"consent" and loginHint so
 * Azure AD skips credentials and shows only the consent screen.
 * loginPopup (not acquireTokenPopup) is the only MSAL call that triggers
 * the full app-level consent dialog covering all registered permissions.
 */
export async function grantConsent(): Promise<boolean> {
  if (!globalMsalInstance) return false;
  const account = globalMsalInstance.getActiveAccount();
  if (!account) return false;

  // Never open a consent popup while MSAL is already interacting.
  if (isMsalInteracting()) {
    console.warn("[grantConsent] MSAL interaction in progress — cannot open consent popup now.");
    return false;
  }

  const resources = getConsentResources();
  const missingResources: ConsentResource[] = [];

  // Determine which resources are still missing consent.
  for (const resource of resources) {
    try {
      const tokenResponse = await globalMsalInstance.acquireTokenSilent({
        scopes: resource.tokenScopes,
        account,
      });
      const payload = JSON.parse(atob(tokenResponse.accessToken.split(".")[1]));
      const grantedScp: string[] = payload.scp ? payload.scp.split(" ") : [];
      const missingScp = resource.requiredScp.filter((s) => !grantedScp.includes(s));

      if (missingScp.length > 0) {
        missingResources.push(resource);
      }
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        missingResources.push(resource);
      } else {
        console.error(`[grantConsent] Failed to check ${resource.label}`, error);
        missingResources.push(resource);
      }
    }
  }

  if (missingResources.length === 0) {
    console.log("[grantConsent] No missing consents found");
    return true;
  }

  try {
    // Azure AD does not allow oversized, cross-resource scope lists.
    // Request consent per missing resource to avoid AADSTS28004.
    for (const resource of missingResources) {
      // Re-check interaction status before each popup.
      if (isMsalInteracting()) {
        console.warn(`[grantConsent] MSAL became busy before consent popup for ${resource.label} — aborting.`);
        return false;
      }

      console.warn(`[grantConsent] Requesting consent for ${resource.label}`);
      const response = await globalMsalInstance.acquireTokenPopup({
        scopes: resource.consentScopes,
        account,
        prompt: "consent",
        loginHint: account.username,
      });

      if (response?.account) {
        globalMsalInstance.setActiveAccount(response.account);
      }
    }

    // IMPORTANT: only treat popup as success if all required scopes
    // are now actually present in issued tokens.
    const active = globalMsalInstance.getActiveAccount();
    if (!active) return false;

    const fullyConsented = await checkAllConsents(active);
    if (!fullyConsented) {
      console.warn("[grantConsent] Popup completed but required scopes are still missing");
      return false;
    }

    // Refresh API token after consent has been verified.
    try {
      await getActiveToken(true);
    } catch {
      // non-critical
    }

    console.log("[grantConsent] Consent granted and verified successfully");
    return true;
  } catch (err) {
    console.error("[grantConsent] Consent popup dismissed or failed", err);
    return false;
  }
}

// ─── MSAL initialization ──────────────────────────────────────────────────────

/**
 * Initializes the MSAL PublicClientApplication singleton.
 *
 * Lifecycle:
 *   1. Fetch config from /api/auth/config
 *   2. new PublicClientApplication(config)
 *   3. pca.initialize()
 *   4. pca.handleRedirectPromise()
 *      - Handles a valid redirect response (sets active account)
 *      - Handles no pending redirect (null response — normal page load)
 *      - Handles no_token_request_cache_error (expected on fresh loads, not fatal)
 *   5. Account selection (redirect → existing active → first available → none)
 *   6. globalMsalInstance = pca  ← app is now ready
 *   7. If account exists: token acquisition + consent check (deferred until here)
 *
 * The initializationPromise guard ensures this runs at most once,
 * even under React Strict Mode (double useEffect invocation in development).
 */
export async function initializeMsal(): Promise<PublicClientApplication> {
  // ── Guard: return existing instance immediately ──
  if (globalMsalInstance) return globalMsalInstance;

  // ── Guard: second call during initialization — share the first promise ──
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async (): Promise<PublicClientApplication> => {
    const res = await fetch("/api/auth/config");
    if (!res.ok) throw new Error("Failed to load auth config");
    const config = await res.json();

    // Hydrate migrationMode centrally
    useUIStore.getState().setMigrationMode(config.migrationMode || MIGRATION_MODE.STANDARD);

    globalApiScope = config.apiScope;

    const msalConfig = {
      auth: {
        clientId: config.clientId,
        authority: config.authority,
        redirectUri: config.redirectUri,
        postLogoutRedirectUri: config.postLogoutRedirectUri || config.redirectUri,
      },
      cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
      },
    };

    const pca = new PublicClientApplication(msalConfig);

    // Step 3: initialize() must complete before any other MSAL API call.
    await pca.initialize();

    // Step 4: handleRedirectPromise()
    // - Returns AuthenticationResult when processing a loginRedirect() callback.
    // - Returns null on a normal page load (no redirect in flight).
    // - Throws no_token_request_cache_error on a fresh load with no MSAL cache entry.
    //   This is expected and safe — it simply means there was nothing to process.
    try {
      const redirectResponse = await pca.handleRedirectPromise();

      if (redirectResponse?.account) {
        // A loginRedirect() just completed — use the returned account.
        pca.setActiveAccount(redirectResponse.account);
        if (process.env.NODE_ENV === "development") {
          console.log("[MsalProviderWrapper] Redirect response processed, account set:", redirectResponse.account.username);
        }
      }
    } catch (redirectError: unknown) {
      if (
        redirectError instanceof BrowserAuthError &&
        (redirectError as any).errorCode === "no_token_request_cache_error"
      ) {
        // Expected: no redirect was in progress. Not an application error.
        if (process.env.NODE_ENV === "development") {
          console.debug(
            "[MsalProviderWrapper] handleRedirectPromise: no pending redirect — normal page load."
          );
        }
      } else {
        // A genuine redirect-handling error. Re-throw so the init fails visibly.
        throw redirectError;
      }
    }

    // Step 5: Account selection
    // Priority: redirect account (already set above) → existing active → first available → none
    if (!pca.getActiveAccount()) {
      const allAccounts = pca.getAllAccounts();
      if (allAccounts.length > 0) {
        pca.setActiveAccount(allAccounts[0]);
      }
    }

    // Step 6: Mark MSAL ready — publish the instance BEFORE deferred work
    // so React can render children. Deferred work below must not block rendering.
    globalMsalInstance = pca;

    return pca;
  })();

  return initializationPromise;
}

// ─── React component ──────────────────────────────────────────────────────────

interface MsalProviderWrapperProps {
  children: ReactNode;
}

export default function MsalProviderWrapper({
  children,
}: MsalProviderWrapperProps) {
  const [msalInstance, setMsalInstance] =
    useState<PublicClientApplication | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [consentNeeded, setConsentNeeded] = useState(false);
  const [granting, setGranting] = useState(false);

  const handleGrantConsent = async () => {
    setGranting(true);
    try {
      const granted = await grantConsent();
      if (granted) setConsentNeeded(false);
    } finally {
      setGranting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        // initializeMsal() is idempotent: returns the cached instance or runs once.
        const pca = await initializeMsal();

        if (cancelled) return;

        setMsalInstance(pca);

        // ── Step 7: Deferred post-init work ──────────────────────────────────
        // Everything below runs AFTER MSAL is ready and the component has
        // updated its state. This guarantees we are not calling token
        // acquisition while handleRedirectPromise() is still in progress.
        const activeAccount = pca.getActiveAccount();
        if (activeAccount) {
          // Initial token acquisition (silent — no popup here).
          try {
            await getActiveToken();
            if (process.env.NODE_ENV === "development") {
              console.log("[MsalProviderWrapper] Initial access token acquired");
            }

            // Fetch and set user timezone preference (or auto-detect if new)
            useUIStore.getState().fetchTimezone().catch((err) => {
              console.warn("[MsalProviderWrapper] Failed to initialize timezone", err);
            });
          } catch (err) {
            console.warn(
              "[MsalProviderWrapper] Initial token acquisition failed",
              err
            );
          }

          // Consent check — silent only, no redirect or popup possible here.
          // Only runs when an account exists and MSAL is fully settled.
          try {
            const allGranted = await ensureConsent();
            if (!allGranted && !cancelled) {
              setConsentNeeded(true);
            }
          } catch (err) {
            console.warn("[MsalProviderWrapper] Consent check failed", err);
          }

          // ── Auto-seed refresh_token (server-side confidential flow) ──────
          // MSAL Browser can't emit an RT, so SK long runs need one seeded via a
          // one-time silent redirect (SSO session already exists → no new prompt).
          // Guarded by a JS-readable cookie + sessionStorage to avoid loops.
          try {
            maybeSeedRefreshToken();
          } catch (err) {
            console.warn("[MsalProviderWrapper] RT auto-seed check failed", err);
          }
        }

        // ── Proactive refresh every 20 min (tokens live ~60–90 min) ─────────
        // Refreshes tokens: bearer, fabric_access_token
        // This ensures long-running migrations (~1hr+) never hit expiry mid-run.
        const REFRESH_INTERVAL_MS = 20 * 60 * 1000;
        const interval = setInterval(async () => {
          const acc = pca.getActiveAccount();
          if (acc) {
            try {
              await Promise.all([
                getActiveToken(),   // refreshes bearer token → sessionStorage["access_token"]
                getFabricToken(),   // refreshes fabric token → sessionStorage["fabric_access_token"]
              ]);
              if (process.env.NODE_ENV === "development") {
                console.log("[MsalProviderWrapper] All tokens proactively refreshed (bearer, fabric)");
              }
            } catch (e) {
              console.warn("[MsalProviderWrapper] Proactive token refresh failed", e);
            }
          }
        }, REFRESH_INTERVAL_MS);

        return () => clearInterval(interval);
      } catch (err: any) {
        console.error("Auth init failed", err);
        if (!cancelled) {
          setInitError(err.message);
        }
      }
    };

    const cleanup = initialize();

    return () => {
      cancelled = true;
      // If initialize() returned a cleanup fn (clearInterval), call it.
      cleanup.then((fn) => fn?.());
    };
  }, []);

  if (initError) {
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fef2f2", color: "#ef4444", fontFamily: "sans-serif", padding: "20px", textAlign: "center" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>Authentication Failed</h2>
          <p>{initError}</p>
        </div>
      </div>
    );
  }

  if (!msalInstance) {
    // Background matches AuthGuard's settling-state spinner (both
    // var(--background), same size/label) so the two sequential loading
    // states -- MSAL init here, then AuthGuard's brief settle wait for
    // @azure/msal-react to catch up -- render as one continuous screen
    // instead of two visually distinct ones back to back.
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--background)" }}>
        <Spinner size="extra-large" label="Loading Application Context..." />
      </div>
    );
  }

  if (consentNeeded) {
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fffbeb", fontFamily: "sans-serif", padding: "20px", textAlign: "center" }}>
        <div style={{ maxWidth: "480px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "12px", color: "#92400e" }}>
            Permissions Required
          </h2>
          <p style={{ fontSize: "15px", color: "#78716c", marginBottom: "24px", lineHeight: "1.6" }}>
            This application needs your consent to access Microsoft services
            (Power BI, Azure Storage, and Fabric). Please click below to grant
            the required permissions.
          </p>
          <button
            onClick={handleGrantConsent}
            disabled={granting}
            style={{ padding: "12px 32px", fontSize: "16px", fontWeight: 600, color: "#ffffff", backgroundColor: granting ? "#a3a3a3" : "#2563eb", border: "none", borderRadius: "8px", cursor: granting ? "not-allowed" : "pointer" }}
          >
            {granting ? "Waiting for consent…" : "Grant Permissions"}
          </button>
          <p style={{ fontSize: "13px", color: "#a8a29e", marginTop: "16px" }}>
            A permission dialog will appear. Please accept all requested permissions.
          </p>
        </div>
      </div>
    );
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}