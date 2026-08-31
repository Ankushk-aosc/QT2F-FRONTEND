import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const REPORT_GENERATION_API = process.env.REPORT_GENERATION_API;
    if (!REPORT_GENERATION_API) {
      throw new Error('Report Generation API is not defined in environment variables');
    }

    // Extract the Authorization header from the incoming request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else {
      console.warn('No Authorization header provided in request to /api/parsing');
      throw new Error('Missing Authorization header');
    }

    const response = await fetch(REPORT_GENERATION_API, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorText = 'Unknown error';
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorText = errorData.error || `HTTP error! Status: ${response.status}`;
      } else {
        errorText = await response.text();
        console.error('Non-JSON response:', errorText);
      }
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}. Response: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/report-generation:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An error occurred while processing the generation request',
      },
      { status: 500 }
    );
  }
}