// features/auth/auth.service.ts
"use client";

import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  Configuration,
} from "@azure/msal-browser";
import type { AuthUser } from "./auth.types";

const msalConfig: Configuration = {
  auth: {
    clientId: "dc669cf4-798f-4951-bec7-a1db505798e5",
    authority: "https://login.microsoftonline.com/4dab0fef-f02d-440b-97c3-712e9483bd68",
    redirectUri: "/signin",
    postLogoutRedirectUri: "/",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    "User.Read"
  ],
};

let msalInstance: PublicClientApplication | undefined;

function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

export class AuthService {
  private instance = getMsalInstance();

  async initialize(): Promise<void> {
    await this.instance.initialize();
    await this.handleRedirect(); // ← CRITICAL

    const accounts = this.instance.getAllAccounts();
    if (accounts.length > 0 && !this.instance.getActiveAccount()) {
      this.instance.setActiveAccount(accounts[0]);
    }
  }

  // ← ADD THIS METHOD
 private async handleRedirect(): Promise<void> {
  try {
    const response = await this.instance.handleRedirectPromise();
    if (response && !this.instance.getActiveAccount()) {
      this.instance.setActiveAccount(response.account);
    }
  } catch (error: any) {
    if (error?.errorMessage?.includes("No redirect") || error?.errorCode === "no_token_request_cache_error") {
      console.log("Ignoring expected MSAL cache error - no active redirect");
      return;
    }
    console.error("handleRedirect error:", error);
  }
}

  async login(): Promise<void> {
  try {
    await this.instance.loginRedirect(loginRequest); // ← use redirect first
  } catch (err) {
    console.error("Login failed", err);
    throw err;
  }
}
  async logout(): Promise<void> {
    await this.instance.logoutPopup();
  }

  getUser(): AuthUser | null {
  const account = this.instance.getActiveAccount();
  if (!account) return null;

  return {
    id: account.localAccountId || account.homeAccountId.split('.')[0],
    email: account.username,
    name: account.name || undefined,
  };
}

  async getAccessToken(customScopes?: string[]): Promise<string | null> {
    const account = this.instance.getActiveAccount();
    if (!account) return null;

    const scopes = customScopes || loginRequest.scopes;

    try {
      const response = await this.instance.acquireTokenSilent({ scopes, account });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const response = await this.instance.acquireTokenPopup({ scopes });
        return response.accessToken;
      }
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.instance.getActiveAccount();
  }

  // Compatibility
  getStoredToken(): string | null { return null; }
  getStoredUser() { return this.getUser(); }
  storeUser() { /* no-op */ }
}

export const authService = new AuthService();