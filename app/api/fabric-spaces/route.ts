import { NextResponse } from 'next/server';

// Forwards the caller's Fabric bearer, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Proxy for the Fabric workspace list: GET {FABRIC_API_BASE_URL}
 * (https://api.fabric.microsoft.com/v1/workspaces), which answers { value: [...] }.
 *
 * Previously this file was a stub returning `{ status: "ok" }` and the client
 * called Microsoft directly using `process.env.NEXT_PUBLIC_FABRIC_API`, read at
 * module scope in src/lib/routes.ts. Next inlines NEXT_PUBLIC_* at build time,
 * and .dockerignore keeps .env* out of the build context, so an image built
 * without --build-arg NEXT_PUBLIC_FABRIC_API baked in `undefined`. The call then
 * became `fetch(undefined)`, which resolves against the app's own origin and
 * 404s -- leaving the workspace dropdown silently empty in the container while
 * working locally, where `next dev` reads .env.local in-process.
 *
 * The host is now resolved at request time from FABRIC_API_BASE_URL, a
 * server-side variable the container already sets (see the Dockerfile's runner
 * notes). NEXT_PUBLIC_FABRIC_API is accepted as a fallback so an environment
 * configured only the old way keeps working.
 *
 * The user's Fabric access token is still minted in the browser and forwarded
 * here; this route never sources credentials of its own.
 */
export async function GET(request: Request) {
  const base = (
    process.env.FABRIC_API_BASE_URL || process.env.NEXT_PUBLIC_FABRIC_API
  )?.trim().replace(/\/+$/, '');

  if (!base) {
    return NextResponse.json(
      {
        error:
          'FABRIC_API_BASE_URL is not set on the server (NEXT_PUBLIC_FABRIC_API is ' +
          'also accepted). The Fabric workspace list cannot be resolved without it.',
      },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json(
      { error: 'No Authorization header provided (a Fabric access token is required)' },
      { status: 401 }
    );
  }

  try {
    const response = await fetch(base, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      cache: 'no-store',
    });

    const body = await response.text();

    if (!response.ok) {
      // Propagate the upstream status: a Fabric token missing Workspace.Read.All
      // must read as 401/403, not as a server fault.
      console.error(`[fabric-spaces] ${base} -> ${response.status}: ${body}`);
      return NextResponse.json(
        { error: `Failed to fetch Fabric workspaces: ${response.status} - ${body}` },
        { status: response.status }
      );
    }

    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[fabric-spaces] Request failed:', err?.message);
    return NextResponse.json(
      { error: `Failed to reach the Fabric API: ${err?.message ?? 'unknown error'}` },
      { status: 502 }
    );
  }
}
