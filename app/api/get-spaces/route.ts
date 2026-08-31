import { NextRequest, NextResponse } from 'next/server';
import { getQlikApiBaseUrl } from '@/lib/qlikApiBaseUrl';

// Reads the caller's Authorization header, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const base = getQlikApiBaseUrl();
  if (!base) {
    return NextResponse.json(
      { error: 'Qlik API URL is not configured. Please set NEXT_PUBLIC_QLIK_API_BASE_URL.' },
      { status: 500 }
    );
  }

  // The Qlik base API resolves the tenant from this token (GET <cosmos>/qlik),
  // then returns [{ id, name, type, isPersonal }, ...]. Without it: 401.
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json(
      { error: 'No Authorization header provided' },
      { status: 401 }
    );
  }

  // Which saved connection to resolve spaces from -- a user can have more than
  // one Qlik connection stored, so the bearer token alone is ambiguous.
  // Forwarded as-is; omitted when absent so upstream keeps its token-only fallback.
  const connectionId = request.nextUrl.searchParams.get('connection_id');
  const query = connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : '';
  const GET_SPACES_API = `${base}/getSpaces${query}`;

  try {
    const response = await fetch(GET_SPACES_API, {
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
      console.error(`[get-spaces] ${GET_SPACES_API} -> ${response.status}: ${body}`);
      return NextResponse.json(
        { error: `Failed to fetch spaces: ${response.status} - ${body}` },
        { status: response.status }
      );
    }

    return NextResponse.json(body ? JSON.parse(body) : []);
  } catch (error) {
    console.error('Error in /api/get-spaces:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}