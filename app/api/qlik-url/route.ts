import { NextResponse } from 'next/server';
import { getRecordsApiBaseUrl } from '@/lib/recordsApiBaseUrl';

// Reads the caller's Authorization header, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Proxy for the tenant's saved Qlik Cloud URL record: GET/POST {RECORDS_BASE}/qlik.
 *
 * Previously this file was a stub returning `{ status: "ok" }`, and the client
 * bypassed it: src/lib/routes.ts built an ABSOLUTE url from
 * `process.env.NEXT_PUBLIC_RECORDS_API_BASE_URL` and the browser called the
 * records host cross-origin.
 *
 * Routing through this handler moved the lookup server-side, but the handler
 * then made the same mistake one layer down: it read the variable with DOT
 * notation, which SWC substitutes at build time even in a route handler. Built
 * without the --build-arg, the compiled route held "" and answered every
 * request with its "not set" 500 regardless of the container's configuration --
 * so the migration page's `qlikUrl` stayed empty, the Assess button stayed
 * disabled, and the hint read "Qlik Cloud URL (not loaded)". getRecordsApiBaseUrl
 * resolves it at REQUEST time and falls back to the deployed records host, so
 * this route works whether or not the image was built with the variable.
 */
function recordsBase(): string | null {
  return getRecordsApiBaseUrl() || null;
}

const MISSING_BASE = {
  error:
    'The records API base URL could not be resolved. Set NEXT_PUBLIC_RECORDS_API_BASE_URL ' +
    '(see lib/recordsApiBaseUrl.ts for the accepted aliases).',
};

export async function GET(request: Request) {
  const base = recordsBase();
  if (!base) return NextResponse.json(MISSING_BASE, { status: 500 });

  // Deliberately NOT required. Upstream GET {records}/qlik is unauthenticated --
  // it returns the tenant's server_url, which is not user-scoped data -- and
  // rejecting here instead made the URL unavailable whenever the MSAL token was
  // slow, expired or unobtainable, which is a strictly worse failure than the
  // one it was guarding against. Forwarded when present so this keeps working
  // if the records host starts requiring it.
  const authHeader = request.headers.get('Authorization');

  const target = `${base}/qlik`;

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: 'no-store',
    });

    const body = await response.text();

    if (!response.ok) {
      // Propagate the upstream status so an expired token reads as 401 rather
      // than a server fault.
      console.error(`[qlik-url GET] ${target} -> ${response.status}: ${body}`);
      return NextResponse.json(
        { error: `Failed to fetch Qlik URL: ${response.status} - ${body}` },
        { status: response.status }
      );
    }

    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[qlik-url GET] Request failed:', err?.message);
    return NextResponse.json(
      { error: `Failed to reach the records API: ${err?.message ?? 'unknown error'}` },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const base = recordsBase();
  if (!base) return NextResponse.json(MISSING_BASE, { status: 500 });

  const target = `${base}/qlik`;
  const authHeader = request.headers.get('Authorization');

  try {
    const payload = await request.json();

    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // publishTenantUrl sends no bearer today; forward one when present so
        // this keeps working if the records host starts requiring it.
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();

    if (!response.ok) {
      console.error(`[qlik-url POST] ${target} -> ${response.status}: ${body}`);
      return NextResponse.json(
        { message: `Failed to save Qlik URL: ${response.status} - ${body}` },
        { status: response.status }
      );
    }

    return new NextResponse(body || '{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[qlik-url POST] Request failed:', err?.message);
    return NextResponse.json(
      { message: `Failed to reach the records API: ${err?.message ?? 'unknown error'}` },
      { status: 502 }
    );
  }
}
