import { NextRequest, NextResponse } from 'next/server';
import { getQlikApiBaseUrl } from '@/lib/qlikApiBaseUrl';

// Reads the caller's Authorization header, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const base = getQlikApiBaseUrl();
  if (!base) {
    return NextResponse.json(
      { error: 'Qlik API URL is not configured. Please set NEXT_PUBLIC_QLIK_API_BASE_URL.' },
      { status: 500 }
    );
  }

  // The Qlik base API resolves the tenant from this token (GET <cosmos>/qlik),
  // then returns [{ id, name, spaceId }, ...]. Without it: 401.
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json(
      { error: 'No Authorization header provided' },
      { status: 401 }
    );
  }

  const { spaceId } = await params;
  if (!spaceId) {
    return NextResponse.json({ error: 'spaceId is required' }, { status: 400 });
  }

  // Which saved connection to resolve apps from -- see the matching comment in
  // app/api/get-spaces/route.ts. "personal" is a synthetic space id reused
  // across every tenant, so without this the wrong connection's apps could be
  // returned for it.
  const connectionId = request.nextUrl.searchParams.get('connection_id');
  const query = connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : '';
  // "personal" is a synthetic id the base API prepends to the space list; it is
  // routed to /items?resourceType=app upstream rather than a real space lookup.
  const GET_APPS_API = `${base}/getApps/${encodeURIComponent(spaceId)}${query}`;

  try {
    const response = await fetch(GET_APPS_API, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      cache: 'no-store',
    });

    const body = await response.text();

    if (!response.ok) {
      // Propagate the upstream status instead of flattening everything to 500,
      // so an expired token reads as 401 rather than a server fault.
      console.error(`[get-apps] ${GET_APPS_API} -> ${response.status}: ${body}`);
      return NextResponse.json(
        { error: `Failed to fetch apps: ${response.status} - ${body}` },
        { status: response.status }
      );
    }

    return NextResponse.json(body ? JSON.parse(body) : []);
  } catch (error) {
    console.error('Error in /api/get-apps:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}
