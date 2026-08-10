// hooks/useAuth.ts
"use client";

import { useMsal, useAccount, useIsAuthenticated } from "@azure/msal-react";
import { getLoginRequest, fabricApiScopes } from "@/lib/auth-constants";
import { globalApiScope } from "@/components/providers/MsalProviderWrapper";

export function useAuth() {
  const { instance } = useMsal();
  const account = useAccount();
  const isAuthenticated = useIsAuthenticated();

  const login = () => {
    // Dynamically construct login request using the Scope loaded at runtime
    const request = getLoginRequest(globalApiScope);
    instance.loginRedirect(request);
  };

  const logout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: "/signin",
    });
  };

  const getAccessToken = async (scopes?: string[]) => {
    if (!account) {
      throw new Error("No active account! Please sign in.");
    }

    // Default to the API scope if no specific scopes provided
    const requestScopes = scopes || getLoginRequest(globalApiScope).scopes;

    try {
      const response = await instance.acquireTokenSilent({ scopes: requestScopes, account });
      return response.accessToken;
    } catch (error) {
      console.warn("[useAuth] Silent token failed, using popup fallback");
      const response = await instance.acquireTokenPopup({ scopes: requestScopes, account });
      return response.accessToken;
    }
  };

  const getFabricToken = async () => {
    return getAccessToken(fabricApiScopes);
  };

  return {
    isAuthenticated,
    account,
    login,
    logout,
    getAccessToken,
    getFabricToken,
    user: account ? {
      name: account.name || account.username || "",
      email: account.username || "",
      initials: (account.name || "").slice(0, 1).toUpperCase() || "U",
    } : null,
  };
}