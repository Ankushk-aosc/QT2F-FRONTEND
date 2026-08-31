
// app/api/history-results/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRecordsApiBaseUrl } from '@/lib/recordsApiBaseUrl';

// Resolved per request -- see the note in app/api/history/route.ts.
const backendBaseUrl = () => getRecordsApiBaseUrl();


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const folder = searchParams.get('folder');
  const authHeader = req.headers.get('authorization');
  if (!type || !folder) {
    return NextResponse.json({ error: 'Type and folder are required' }, { status: 400 });
  }

  const validTypes = ['assessment', 'parsing', 'mapping', 'report-generation'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  try {
    // 2. Prepare headers for the backend call
    const backendHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // 3. Forward the token if it exists
    if (authHeader) {
      backendHeaders['Authorization'] = authHeader;
    }
    console.log(`authHeader${backendHeaders}`)
    const response = await fetch(`${backendBaseUrl()}/${type}/${encodeURIComponent(folder)}`, {
      method: 'GET',
      headers: backendHeaders,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${type} results: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching ${type} results:`, error);
    return NextResponse.json({ error: `Failed to load ${type} results` }, { status: 500 });
  }
}