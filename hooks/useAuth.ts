// hooks/useAuth.ts
"use client";

import { useMsal, useAccount, useIsAuthenticated } from "@azure/msal-react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import { getLoginRequest, fabricApiScopes } from "@/lib/auth-constants";
import { globalApiScope } from "@/components/providers/MsalProviderWrapper";

import { useAuthStore } from "@/stores/auth.store";

export function useAuth() {
  const { instance, inProgress } = useMsal();
  const account = useAccount();
  const isAuthenticated = useIsAuthenticated();
  const storeUser = useAuthStore((s) => s.user);
  const isStoreAuthed = useAuthStore((s) => s.isAuthenticated);

  const login = () => {
    // Dynamically construct login request using the Scope loaded at runtime
    const request = getLoginRequest(globalApiScope);
    instance.loginRedirect(request);
  };

  const logout = () => {
    useAuthStore.getState().logout();
    try {
      instance.logoutRedirect({
        postLogoutRedirectUri: "/signin",
      });
    } catch {
      window.location.href = "/signin";
    }
  };

  const getAccessToken = async (scopes?: string[]) => {
    if (!account) {
      throw new Error("[useAuth] getAccessToken called with no signed-in account");
    }

    // Default to the API scope if no specific scopes provided
    const requestScopes = scopes || getLoginRequest(globalApiScope).scopes;

    try {
      const response = await instance.acquireTokenSilent({ scopes: requestScopes, account });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        if (inProgress !== InteractionStatus.None) {
          throw new Error(
            "[useAuth] Silent token acquisition failed and an MSAL interaction is already in progress"
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
    isAuthenticated: isAuthenticated || isStoreAuthed,
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
    } : storeUser ? {
      name: storeUser.name || storeUser.email || "Admin",
      email: storeUser.email || "",
      initials: storeUser.initials || "A",
    } : null,
  };
}