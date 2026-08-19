import { NextResponse } from "next/server";
import { relayUpstreamError } from "@/lib/api/routeHelpers";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().TABLEAU_API_URL;
  if (!apiBaseUrl) {
    throw new Error("[Env] Missing required environment variable: TABLEAU_API_URL");
  }
  return `${apiBaseUrl.replace(/\/$/, "")}/deployment/azure-devops`;
};

export const dynamic = "force-dynamic";

function getBearerAuthHeader(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ") || authHeader.trim().length <= 7) {
    return null;
  }

  return authHeader;
}

export async function GET(request: Request) {
  try {
    const authHeader = getBearerAuthHeader(request);
    if (!authHeader) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const response = await fetch(getBaseUrl(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return relayUpstreamError("[API /api/records/deployment/azure-devops]", getBaseUrl(), response);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API deployment/azure-devops] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authHeader = getBearerAuthHeader(request);
    if (!authHeader) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const response = await fetch(getBaseUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return relayUpstreamError("[API /api/records/deployment/azure-devops]", getBaseUrl(), response);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API deployment/azure-devops] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
