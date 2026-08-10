"use client";

import { useMsal, useAccount, useIsAuthenticated } from "@azure/msal-react";
import { globalApiScope } from "@/components/providers/MsalProviderWrapper";

export interface ApiClient {
    get: <T>(url: string, headers?: HeadersInit) => Promise<T>;
    post: <T>(url: string, body?: any, headers?: HeadersInit) => Promise<T>;
    put: <T>(url: string, body?: any, headers?: HeadersInit) => Promise<T>;
    delete: <T>(url: string, headers?: HeadersInit) => Promise<T>;
}

export function useApiClient(): ApiClient {
    const { instance } = useMsal();
    const account = useAccount();
    const isAuthenticated = useIsAuthenticated();

    const getAccessToken = async (): Promise<string> => {
        if (!account) {
            throw new Error("User is not authenticated");
        }

        try {
            const response = await instance.acquireTokenSilent({
                scopes: [globalApiScope],
                account,
            });
            return response.accessToken;
        } catch (error) {
            console.warn("[useApiClient] Silent token acquisition failed, attempting popup...", error);
            const response = await instance.acquireTokenPopup({
                scopes: [globalApiScope],
                account,
            });
            return response.accessToken;
        }
    };

    const request = async <T>(method: string, url: string, body?: any, customHeaders?: HeadersInit): Promise<T> => {
        if (!isAuthenticated) {
            throw new Error("User must be signed in to make API calls.");
        }

        const token = await getAccessToken();

        const headers: HeadersInit = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...customHeaders,
        };

        const config: RequestInit = {
            method,
            headers,
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(url, config);

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `API Error ${response.status}: ${response.statusText}`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) errorMessage = errorJson.error;
                if (errorJson.message) errorMessage = errorJson.message;
            } catch {
                // use raw text
                if (errorText) errorMessage = errorText;
            }
            throw new Error(errorMessage);
        }

        // Handle empty responses
        const text = await response.text();
        return text ? JSON.parse(text) : ({} as T);
    };

    return {
        get: <T>(url: string, headers?: HeadersInit) => request<T>("GET", url, undefined, headers),
        post: <T>(url: string, body?: any, headers?: HeadersInit) => request<T>("POST", url, body, headers),
        put: <T>(url: string, body?: any, headers?: HeadersInit) => request<T>("PUT", url, body, headers),
        delete: <T>(url: string, headers?: HeadersInit) => request<T>("DELETE", url, undefined, headers),
    };
}
