import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("[Env] Missing required environment variable: API_BASE_URL");
  }
  return `${apiBaseUrl.replace(/\/$/, "")}/records/settings/timezone`;
};

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();

    const response = await fetch(baseUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        // ignore
      }
      throw new Error(`Backend responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API records/settings/timezone] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
