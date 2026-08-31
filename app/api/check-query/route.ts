// // app/api/check-query/route.ts   (App Router)

// import { NextRequest, NextResponse } from 'next/server';

// export async function POST(request: NextRequest) {
//   try {
//     // Parse incoming JSON (expects { table1: 'query_string', ... } or similar)
//     const body = await request.json();

//     // Basic validation – must be an object
//     if (!body || typeof body !== 'object' || Array.isArray(body)) {
//       return NextResponse.json(
//         { error: 'Invalid request body. Expected an object containing queries (e.g. { table1: "query_string", ... }).' },
//         { status: 400 }
//       );
//     }

//     // Your FastAPI base URL (set this in .env.local)
//     const baseUrl = process.env.NEXT_PUBLIC_CONVERSION_URL;

//     if (!baseUrl) {
//       console.error('Missing environment variable: NEXT_PUBLIC_CONVERSION_URL');
//       return NextResponse.json(
//         { error: 'Server configuration error: missing NEXT_PUBLIC_CONVERSION_URL.' },
//         { status: 500 }
//       );
//     }

//     // This matches the FastAPI endpoint we created
//     const externalApiUrl = `${baseUrl}/verify/validate-query`;

//     // Forward the exact same payload to our FastAPI query validator
//     const externalResponse = await fetch(externalApiUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(body),
//     });

//     // Handle errors from FastAPI
//     if (!externalResponse.ok) {
//       const errorText = await externalResponse.text();
//       console.error('Query validator API error:', {
//         status: externalResponse.status,
//         body: errorText,
//       });
//       return NextResponse.json(
//         { error: `Query validation failed: ${errorText}` },
//         { status: externalResponse.status }
//       );
//     }

//     // Success – return validated queries with confidence scores
//     const validatedData = await externalResponse.json();

//     return NextResponse.json(validatedData, { status: 200 });
//   } catch (error: any) {
//     console.error('Internal error in /api/check-query:', error);
//     return NextResponse.json(
//       { error: 'Internal server error during query validation.', details: error.message },
//       { status: 500 }
//     );
//   }
// }

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Parse Payload
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        {
          error:
            "Invalid request body. Expected an object like { table1: 'query_string' }",
        },
        { status: 400 }
      );
    }

    // ⛔ Extract Authorization Header from client request
    const authHeader = request.headers.get("authorization");
    console.log("CHECK-QUERY AUTH HEADER:", authHeader);

    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_CONVERSION_URL;

    if (!baseUrl) {
      console.error("Missing env var NEXT_PUBLIC_CONVERSION_URL");
      return NextResponse.json(
        { error: "Server misconfiguration: missing NEXT_PUBLIC_CONVERSION_URL" },
        { status: 500 }
      );
    }

    // Target FastAPI route
    const externalApiUrl = `${baseUrl}/verify/validate-query`;

    // Forward request to FastAPI with Authorization header
    const externalResponse = await fetch(externalApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,  // 🔥 Forwarding token
      },
      body: JSON.stringify(body),
    });

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();

      console.error("Query validator API error:", {
        status: externalResponse.status,
        body: errorText,
      });

      return NextResponse.json(
        { error: `Query validation failed: ${errorText}` },
        { status: externalResponse.status }
      );
    }

    // Success
    const validatedData = await externalResponse.json();
    return NextResponse.json(validatedData, { status: 200 });
  } catch (error: any) {
    console.error("Internal error in /api/check-query:", error);
    return NextResponse.json(
      {
        error: "Internal server error during query validation.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
