import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
import { MIGRATION_MODE } from "@/lib/constants";

export const dynamic = 'force-dynamic';

export async function GET() {
    const env = getEnv(); // Env is cached, so safely called here

    // Dynamic Base URL logic
    // Use the configured APP_URL or infer from headers if default is used, for Azure/Docker compatibility.

    let baseUrl = env.APP_URL;

    const headersList = await headers();
    const forwardedHost = headersList.get("x-forwarded-host");
    const host = headersList.get("host");

    if (env.APP_URL === "http://localhost:3000" && (forwardedHost || host)) {
        // If we are strictly on localhost default, but we have a real host header (e.g. in Azure), use it.
        const proto = headersList.get("x-forwarded-proto") || "http";
        const currentHost = forwardedHost || host;
        baseUrl = `${proto}://${currentHost}`;
    }

    // Create the return object strictly matching requirements
    // Note: We expose the clean props to the client, even though they come from server-side vars now.
    return NextResponse.json({
        clientId: env.MSAL_CLIENT_ID,
        tenantId: env.MSAL_TENANT_ID,
        authority: env.MSAL_AUTHORITY,
        apiScope: env.API_SCOPE,
        redirectUri: `${baseUrl}/auth/callback`,
        postLogoutRedirectUri: baseUrl,
        migrationMode: (env.AGENTVARIABLE || MIGRATION_MODE.STANDARD).trim(),
    });
}
