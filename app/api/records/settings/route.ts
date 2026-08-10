import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("[Env] Missing required environment variable: API_BASE_URL");
  }
  return `${apiBaseUrl.replace(/\/$/, "")}/records/settings`;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    const response = await fetch(baseUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API records/settings] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
