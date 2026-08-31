import { NextResponse } from 'next/server';
import { httpGet, errorResponse } from '@/lib/api/httpClient';

// Forwards the caller's Fabric bearer, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Proxy for the Fabric workspace list: GET {FABRIC_API_BASE_URL}, which
 * answers { value: [...] }.
 *
 * Previously this file resolved FABRIC_API_BASE_URL itself, independently of
 * (and disagreeing with) httpClient.ts's own resolution for apiType "fabric" --
 * two different fallback chains for the same host. It now goes through
 * httpClient the same way app/api/fabric/workspaces/route.ts already does, so
 * there is exactly one place FABRIC_API_BASE_URL is read (lib/env.ts, which
 * fails loudly if it's unset rather than silently falling back to Microsoft's
 * public endpoint).
 *
 * The user's Fabric access token is still minted in the browser and forwarded
 * here; this route never sources credentials of its own.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json(
      { error: 'No Authorization header provided (a Fabric access token is required)' },
      { status: 401 }
    );
  }

  try {
    const result = await httpGet<unknown>('fabric', '', {
      headers: { Authorization: authHeader },
    });
    return NextResponse.json(result.data);
  } catch (err: unknown) {
    console.error('[fabric-spaces] Request failed:', err);
    const { body, status } = errorResponse(err, 'Failed to fetch Fabric workspaces');
    return NextResponse.json(body, { status });
  }
}
