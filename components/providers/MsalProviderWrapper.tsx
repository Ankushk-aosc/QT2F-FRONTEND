"use client";

import { MsalProvider } from "@azure/msal-react";
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  AccountInfo,
} from "@azure/msal-browser";
import { ReactNode, useEffect, useState } from "react";
import { Spinner } from "@fluentui/react-components";
import { useUIStore } from "@/stores/ui.store";
import { MIGRATION_MODE } from "@/lib/constants";

export let globalApiScope: string = "";

let globalMsalInstance: PublicClientApplication | null = null;

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
      label: "Azure Storage",
      tokenScopes: ["https://storage.azure.com/user_impersonation"],
      consentScopes: ["https://storage.azure.com/user_impersonation"],
      requiredScp: ["user_impersonation"],
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

  try {
    const request = {
      scopes: [globalApiScope],
      account,
      forceRefresh, // useful when we know the token is bad
    };

    const res = await globalMsalInstance.acquireTokenSilent(request);
    sessionStorage.setItem("access_token", res.accessToken);
    return res.accessToken;
  } catch (error: unknown) {
    if (error instanceof InteractionRequiredAuthError) {
      console.warn(
        "[getActiveToken] Silent acquisition failed → falling back to popup"
      );

      try {
        const res = await globalMsalInstance.acquireTokenPopup({
          scopes: [globalApiScope],
          account,
        });

        sessionStorage.setItem("access_token", res.accessToken);
        console.log("[getActiveToken] New token acquired via popup");
        return res.accessToken;
      } catch (popupError) {
        console.error("[getActiveToken] Popup acquisition failed", popupError);
        throw new Error("Unable to acquire access token (popup failed)");
      }
    }

    console.error("[getActiveToken] Unexpected error", error);
    throw error;
  }
}

/**
 * Acquires a token for Azure Storage user_impersonation scope.
 */
export async function getStorageToken(
  forceRefresh: boolean = false
): Promise<string> {
  if (!globalMsalInstance) {
    throw new Error("Auth not initialized");
  }

  const account: AccountInfo | null = globalMsalInstance.getActiveAccount();
  if (!account) {
    throw new Error("No active account! Verify a user has been signed in.");
  }

  const storageScope = "https://storage.azure.com/user_impersonation";

  try {
    const request = {
      scopes: [storageScope],
      account,
      forceRefresh,
    };

    const res = await globalMsalInstance.acquireTokenSilent(request);
    sessionStorage.setItem("onelake_token", res.accessToken);
    console.log("[getStorageToken] One Lake token acquired silently");
    return res.accessToken;
  } catch (error: unknown) {
    if (error instanceof InteractionRequiredAuthError) {
      console.warn(
        "[getStorageToken] Silent acquisition failed → falling back to popup"
      );

      try {
        const res = await globalMsalInstance.acquireTokenPopup({
          scopes: [storageScope],
          account,
        });

        sessionStorage.setItem("onelake_token", res.accessToken);
        console.log("[getStorageToken] New One Lake token acquired via popup");
        return res.accessToken;
      } catch (popupError) {
        console.error("[getStorageToken] Popup acquisition failed", popupError);
        throw new Error("Unable to acquire One Lake access token (popup failed)");
      }
    }

    console.error("[getStorageToken] Unexpected error", error);
    throw error;
  }
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

  try {
    const request = {
      scopes: [fabricScope],
      account,
      forceRefresh,
    };

    const res = await globalMsalInstance.acquireTokenSilent(request);
    sessionStorage.setItem("fabric_access_token", res.accessToken);
    console.log("[getFabricToken] Fabric token acquired silently");
    return res.accessToken;
  } catch (error: unknown) {
    if (error instanceof InteractionRequiredAuthError) {
      console.warn(
        "[getFabricToken] Silent acquisition failed → falling back to popup"
      );

      try {
        const res = await globalMsalInstance.acquireTokenPopup({
          scopes: [fabricScope],
          account,
        });

        sessionStorage.setItem("fabric_access_token", res.accessToken);
        console.log("[getFabricToken] New Fabric token acquired via popup");
        return res.accessToken;
      } catch (popupError) {
        console.error("[getFabricToken] Popup acquisition failed", popupError);
        throw new Error("Unable to acquire Fabric access token (popup failed)");
      }
    }

    console.error("[getFabricToken] Unexpected error", error);
    throw error;
  }
}

/**
 * Checks if the user has consented to all required resources.
 * Returns true if all silent token checks pass, false if any need consent.
 */
async function checkAllConsents(account: AccountInfo): Promise<boolean> {
  const resourcesToCheck = getConsentResources();

  console.group("[ensureConsent] Checking permissions for", account.username);

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
        console.warn(
          `❌ ${resource.label} — token acquired but missing scopes:`,
          missingScp,
          "\n   Granted scp:", grantedScp
        );
        console.groupEnd();
        return false;
      }

      console.log(
        `✅ ${resource.label}`,
        "\n   Scopes granted:", tokenResponse.scopes,
        "\n   Token audience:", payload.aud,
        "\n   scp claim:", payload.scp || "(none)",
        "\n   roles claim:", payload.roles || "(none)"
      );
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        console.warn(`❌ ${resource.label} — MISSING CONSENT`);
        console.groupEnd();
        return false;
      }
      console.error(`⚠️ ${resource.label} — unexpected error`, error);
      console.groupEnd();
      return false;
    }
  }

  console.groupEnd();
  return true;
}

/**
 * Silently checks all required resources.
 * Returns true if all consents are in place, false if anything is missing.
 * Never triggers any redirect or popup — only silent checks.
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
    const initialize = async () => {
      if (globalMsalInstance) {
        setMsalInstance(globalMsalInstance);
        return;
      }

      try {
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
            postLogoutRedirectUri:
              config.postLogoutRedirectUri || config.redirectUri,
          },
          cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
          },
        };

        const pca = new PublicClientApplication(msalConfig);
        await pca.initialize();

        await pca.handleRedirectPromise().then((response) => {
          if (response?.account) {
            pca.setActiveAccount(response.account);
          }
        });

        if (!pca.getActiveAccount() && pca.getAllAccounts().length > 0) {
          pca.setActiveAccount(pca.getAllAccounts()[0]);
        }

        globalMsalInstance = pca;
        setMsalInstance(pca);

        const activeAccount = pca.getActiveAccount();
        if (activeAccount) {
          try {
            await getActiveToken(); // initial token
            console.log(
              "[MsalProviderWrapper] Initial access token acquired"
            );
            
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

          // Check consent silently — if missing, show blocking screen.
          // Never redirects, no loop possible.
          try {
            const allGranted = await ensureConsent();
            if (!allGranted) {
              setConsentNeeded(true);
            }
          } catch (err) {
            console.warn("[MsalProviderWrapper] Consent check failed", err);
          }

          // ── Auto-seed refresh_token (server-side confidential flow) ──────────
          // MSAL Browser can't emit an RT, so SK long runs need one seeded via a
          // one-time silent redirect (SSO session already exists → no new prompt).
          // Guarded by a JS-readable cookie + sessionStorage to avoid loops.
          try {
            maybeSeedRefreshToken();
          } catch (err) {
            console.warn("[MsalProviderWrapper] RT auto-seed check failed", err);
          }
        }

        // ── Proactive refresh every 20 min (tokens live ~60–90 min) ──────────────
        // Refreshes ALL three tokens: bearer, fabric_access_token, onelake_token
        // This ensures long-running migrations (~1hr+) never hit expiry mid-run.
        const REFRESH_INTERVAL_MS = 20 * 60 * 1000;
        const interval = setInterval(async () => {
          const acc = pca.getActiveAccount();
          if (acc) {
            try {
              await Promise.all([
                getActiveToken(),      // refreshes bearer token → sessionStorage["access_token"]
                getFabricToken(),      // refreshes fabric token → sessionStorage["fabric_access_token"]
                getStorageToken(),     // refreshes onelake token → sessionStorage["onelake_token"]
              ]);
              console.log("[MsalProviderWrapper] All tokens proactively refreshed (bearer, fabric, onelake)");
            } catch (e) {
              console.warn("[MsalProviderWrapper] Proactive token refresh failed", e);
            }
          }
        }, REFRESH_INTERVAL_MS);

        return () => clearInterval(interval);
      } catch (err: any) {
        console.error("Auth init failed", err);
        setInitError(err.message);
      }
    };

    initialize();
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
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
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