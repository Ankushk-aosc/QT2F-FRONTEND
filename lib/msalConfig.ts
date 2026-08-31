// lib/msalConfig.ts
// MSAL configuration - fetches from server-side API route
// 🚨 NO direct process.env access - all config from /api/auth/config

import { Configuration, PublicClientApplication } from "@azure/msal-browser";
import { fabricApiScopes } from "@/lib/auth-constants";

// Fetch MSAL config from server
async function fetchMsalConfig() {
  const response = await fetch("/api/auth/config");
  if (!response.ok) {
    throw new Error("Failed to fetch MSAL configuration from server");
  }
  return response.json();
}

let cachedConfig: {
  clientId: string;
  tenantId: string;
  authority: string;
  apiScope: string;
  redirectUri: string;
} | null = null;

export async function getMsalConfig() {
  if (!cachedConfig) {
    cachedConfig = await fetchMsalConfig();
  }
  return cachedConfig;
}

export async function createMsalConfiguration(): Promise<Configuration> {
  const config = await getMsalConfig();

  if (!config) {
    throw new Error("Failed to load MSAL configuration");
  }

  return {
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: config.redirectUri,
      postLogoutRedirectUri: config.redirectUri,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  };
}

let msalInstance: PublicClientApplication | null = null;
let initializePromise: Promise<void> | null = null;

export const getMsalInstance = async (): Promise<PublicClientApplication> => {
  if (typeof window === "undefined") {
    throw new Error("MSAL can only be used in browser");
  }

  if (!msalInstance) {
    const config = await createMsalConfiguration();
    msalInstance = new PublicClientApplication(config);
  }

  if (!initializePromise) {
    initializePromise = msalInstance.initialize().catch((err) => {
      console.error("[MSAL] Initialization failed", err);
      initializePromise = null;
      throw err;
    });
  }

  await initializePromise;
  return msalInstance;
};

// Login scopes - fetched from server config
export async function getLoginRequest() {
  const config = await getMsalConfig();

  if (!config) {
    throw new Error("Failed to load MSAL configuration");
  }

  const scopes = ["User.Read", "openid", "profile", "email"];
  if (config.apiScope && config.apiScope.trim().length > 0) {
    scopes.push(config.apiScope.trim());
  }

  return { scopes };
}

// Fabric API scopes -- re-exported from lib/auth-constants.ts, the single
// source of truth for this list (this file previously kept its own copy).
export { fabricApiScopes };

export const loginRequestFabric = {
  scopes: fabricApiScopes,
};

// Token decoder helper
export function decodeToken(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("[MSAL] Failed to decode token:", err);
    return null;
  }
}

export function validateTokenAudience(token: string, expectedAudience: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded) return false;

  const aud = decoded.aud;
  const valid = aud === expectedAudience;

  if (!valid) {
    console.error("[MSAL] ❌ Token audience mismatch!");
    console.error(`[MSAL] Expected: ${expectedAudience}`);
    console.error(`[MSAL] Received: ${aud}`);
    console.error(`[MSAL] This will cause 401 errors in APIM validate-jwt policy.`);
  } else {
    console.log("[MSAL] ✅ Token audience valid:", aud);
  }

  return valid;
}