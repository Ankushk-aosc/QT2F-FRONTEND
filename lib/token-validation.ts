import "server-only";
import { getEnv } from "./env";

export interface DecodedToken {
    aud?: string | string[];
    exp?: number;
    scp?: string;
    [key: string]: any;
}

export function decodeToken(token: string): DecodedToken | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        // JWT structure: Header.Payload.Signature
        const payload = parts[1];

        // Base64Url decode
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("[TokenValidation] Failed to decode token", e);
        return null;
    }
}

export function validateTokenAudience(token: string): boolean {
    if (!token) return false;

    // handling "Bearer " prefix if passed
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token.trim();

    const decoded = decodeToken(cleanToken);
    if (!decoded) return false;

    // Check Expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
        console.warn("[TokenValidation] Token expired");
        return false;
    }

    // Validate Audience
    const env = getEnv();
    // Extract UUID from api://<UUID>/Scope
    let expectedAudience = "";
    if (env.API_SCOPE.startsWith("api://")) {
        const parts = env.API_SCOPE.split('/');
        if (parts.length >= 3) {
            expectedAudience = parts[2];
        }
    }

    if (!decoded.aud) return false;

    const aud = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];

    // We validate if the token is intended for this API (API_SCOPE resource) or the Client (Graph/MSAL)
    // Usually the access token for the backend should have the Backend's App ID as audience.
    // The frontend calls THIS Next.js API.
    // If the frontend acquires a token for `API_SCOPE`, the audience IS the Backend App ID (from API_SCOPE).

    const isValid = aud.some(a =>
        (expectedAudience && a === expectedAudience) ||
        (env.MSAL_CLIENT_ID && a === env.MSAL_CLIENT_ID) ||
        (expectedAudience && a === `api://${expectedAudience}`)
    );

    if (!isValid) {
        console.warn(`[TokenValidation] Invalid Audience. Expected ${expectedAudience} or ${env.MSAL_CLIENT_ID}. Got: ${aud.join(', ')}`);
    }

    return isValid;
}
