
// src/lib/httpClient.ts
// Central HTTP Utility for Server-Side calls (backend services)
import { getEnv } from "@/lib/env";

export async function fetchWithAuth<T>(
    url: string,
    token?: string | null,
    options: RequestInit = {}
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as any),
    };

    if (token) {
        // Handle "Bearer <token>" correctly
        const authValue = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
        headers["Authorization"] = authValue;
    }

    console.log(`[HttpClient] Requesting: ${url} [${options.method || "GET"}]`);
    console.log(`[HttpClient] Auth Header Present: ${!!headers["Authorization"]}`);

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorDetails = `Status: ${response.status} ${response.statusText}`;
        try {
            const errorBody = await response.text();
            errorDetails += ` - ${errorBody}`;
        } catch { /* ignore */ }
        const error = new Error(`API Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        (error as any).status = response.status;
        throw error;
    }

    // Handle 204 No Content or empty body
    if (response.status === 204) {
        return {} as T;
    }

    try {
        return await response.json() as T;
    } catch {
        // If JSON parsing fails but status is OK, return null or empty object? 
        // Or text content?
        // Assume JSON based on requirements.
        return {} as T;
    }
}
