// app/api/logs/route.ts
// GET /api/logs — centralized logging endpoint
// 🚨 GET ONLY - NO POST ALLOWED
// Logging is disabled by architectural decision

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    console.log("[API /api/logs] GET request received - logging is disabled");

    return NextResponse.json(
        {
            message: "Logging endpoint - GET only",
            status: "disabled",
            info: "Logging functionality has been disabled by architectural decision"
        },
        { status: 200 }
    );
}

// Explicitly reject POST requests
export async function POST(req: NextRequest) {
    console.error("[API /api/logs] ❌ POST request rejected - only GET allowed");

    return NextResponse.json(
        {
            error: "Method not allowed - POST requests to /api/logs are disabled",
            code: "METHOD_NOT_ALLOWED",
            allowed_methods: ["GET"]
        },
        { status: 405 }
    );
}
