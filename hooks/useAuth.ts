// hooks/useAuth.ts
"use client";

import { useMsal, useAccount, useIsAuthenticated } from "@azure/msal-react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import { getLoginRequest, fabricApiScopes } from "@/lib/auth-constants";
import { globalApiScope } from "@/components/providers/MsalProviderWrapper";

export function useAuth() {
  const { instance, inProgress } = useMsal();
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
      if (error instanceof InteractionRequiredAuthError) {
        // Only open a popup when MSAL is not already in an active interaction.
        // Opening a popup inside an existing interaction causes block_nested_popups.
        if (inProgress !== InteractionStatus.None) {
          console.warn(
            "[useAuth] Silent token failed but MSAL interaction is in progress — cannot open popup now."
          );
          throw new Error(
            "interaction_in_progress: Cannot open popup while MSAL is busy. Please retry."
          );
        }

        console.warn("[useAuth] Silent token failed, using popup fallback");
        const response = await instance.acquireTokenPopup({ scopes: requestScopes, account });
        return response.accessToken;
      }
      throw error;
    }
  };

  const getFabricToken = async () => {
    return getAccessToken(fabricApiScopes);
  };

  return {
    isAuthenticated,
    /**
     * True while MSAL is mid-interaction (redirect handling, token renewal).
     * Consumers use it to hold a spinner rather than briefly rendering a
     * signed-out view over a session that is still resolving.
     */
    isLoading: inProgress !== InteractionStatus.None,
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