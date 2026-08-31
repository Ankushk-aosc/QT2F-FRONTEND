import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  return `${apiBaseUrl.replace(/\/$/, "")}/api/records/interactive-status`;
};
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

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // Passing the backend's real status through (rather than collapsing
      // everything to 500) lets callers tell "not configured yet" (404) apart
      // from an actual failure — see RecordsService.getInteractiveStatus.
      console.error(`[API Records] GET backend responded with ${response.status}`);
      return NextResponse.json(
        data ?? { error: `Backend responded with ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API Records] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    console.log("[API Records] Patching Body:", JSON.stringify(body));
    const response = await fetch(baseUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
        let errorBody: any = null;
        try {
            errorBody = await response.json();
        } catch {
            // ignore
        }
      console.error(`[API Records] PATCH backend responded with ${response.status}`);
      return NextResponse.json(
        errorBody ?? { error: `Backend responded with ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API Records] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
