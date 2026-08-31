import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { resolveBaseUrl } from "@/lib/auth/serverAuth";
import { MIGRATION_MODE } from "@/lib/constants";

export const dynamic = 'force-dynamic';

export async function GET() {
    const env = getEnv(); // Env is cached, so safely called here

    // Shared with the server-side auth-code flow so the browser's redirectUri and
    // the redirect_uri sent to Entra are always the same string.
    const baseUrl = await resolveBaseUrl();

    // Create the return object strictly matching requirements
    // Note: We expose the clean props to the client, even though they come from server-side vars now.
    return NextResponse.json({
        clientId: env.MSAL_CLIENT_ID,
        tenantId: env.MSAL_TENANT_ID,
        authority: env.MSAL_AUTHORITY,
        apiScope: env.API_SCOPE,
        redirectUri: baseUrl,
        postLogoutRedirectUri: baseUrl,
        migrationMode: (env.AGENTVARIABLE || MIGRATION_MODE.STANDARD).trim(),
    });
}
