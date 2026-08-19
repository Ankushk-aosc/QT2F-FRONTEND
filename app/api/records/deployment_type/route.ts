// app/api/records/deployment_type/route.ts
import { NextResponse } from "next/server";
import { relayUpstreamError } from "@/lib/api/routeHelpers";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("[Env] Missing required environment variable: API_BASE_URL");
  }
  return `${apiBaseUrl.replace(/\/$/, "")}/records/deployment_type`;
};

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    const response = await fetch(baseUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return relayUpstreamError("[API /api/records/deployment_type]", baseUrl, response);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API deployment_type] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    console.log("[API deployment_type] Patching Body:", JSON.stringify(body));

    const response = await fetch(baseUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return relayUpstreamError("[API /api/records/deployment_type]", baseUrl, response);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API deployment_type] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
