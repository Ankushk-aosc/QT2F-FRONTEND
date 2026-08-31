// // app/api/check-dimensions/route.ts   (App Router)


// import { NextRequest, NextResponse } from 'next/server';

// export async function POST(request: NextRequest) {
//   try {
//     // Parse incoming JSON (expects { dimension_count, dimensions: [...] } or similar)
//     const body = await request.json();

//     // Basic validation – must be an object
//     if (!body || typeof body !== 'object' || Array.isArray(body)) {
//       return NextResponse.json(
//         { error: 'Invalid request body. Expected an object containing dimensions (e.g. { dimension_count, dimensions: [...] }).' },
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
//     const externalApiUrl = `${baseUrl}/verify/validate-dimensions`;

//     // Forward the exact same payload to our FastAPI dimension validator
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
//       console.error('Dimension validator API error:', {
//         status: externalResponse.status,
//         body: errorText,
//       });
//       return NextResponse.json(
//         { error: `Dimension validation failed: ${errorText}` },
//         { status: externalResponse.status }
//       );
//     }

//     // Success – return validated dimensions with confidence scores
//     const validatedData = await externalResponse.json();

//     return NextResponse.json(validatedData, { status: 200 });
//   } catch (error: any) {
//     console.error('Internal error in /api/check-dimensions:', error);
//     return NextResponse.json(
//       { error: 'Internal server error during dimension validation.', details: error.message },
//       { status: 500 }
//     );
//   }
// }

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body. Expected an object with dimension details" },
        { status: 400 }
      );
    }

    // Read token from frontend
    const authHeader = request.headers.get("authorization");
    console.log("DIMENSIONS AUTH HEADER:", authHeader);

    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_CONVERSION_URL;

    if (!baseUrl) {
      console.error("Missing env variable NEXT_PUBLIC_CONVERSION_URL");
      return NextResponse.json(
        { error: "Server config error: missing NEXT_PUBLIC_CONVERSION_URL" },
        { status: 500 }
      );
    }

    const externalApiUrl = `${baseUrl}/verify/validate-dimensions`;

    const externalResponse = await fetch(externalApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader, // Forward same token
      },
      body: JSON.stringify(body),
    });

    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();
      console.error("FastAPI dimension validation error:", errorText);
      return NextResponse.json(
        { error: errorText },
        { status: externalResponse.status }
      );
    }

    const validatedData = await externalResponse.json();
    return NextResponse.json(validatedData);

  } catch (error: any) {
    console.error("Internal error in /api/check-dimensions:", error);
    return NextResponse.json(
      { error: "Internal server error while validating dimensions." },
      { status: 500 }
    );
  }
}
