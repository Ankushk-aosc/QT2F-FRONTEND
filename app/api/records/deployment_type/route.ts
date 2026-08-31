// app/api/records/deployment_type/route.ts
// Proxies GET/PATCH to the Q2F Cosmos records API, same Settings flow as
// vl-t2f-frontend:
//   GET/PATCH {API_BASE_URL}/api/records/deployment_type
//   body: { "deployment_type": "GIT" | "DIRECT_FABRIC" | "AZURE_DEVOPS" }
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  return `${apiBaseUrl.replace(/\/$/, "")}/api/records/deployment_type`;
};

export const dynamic = 'force-dynamic';

/**
 * Node's fetch reports every transport failure as the bare string "fetch failed"
 * and hides the real reason (DNS miss, refused connection, TLS error, timeout)
 * on `error.cause`. Returning just the message makes an unreachable backend
 * indistinguishable from a bug in this route, so unwrap the cause.
 */
function describeError(error: any): string {
  const cause = error?.cause;
  if (!cause) return error?.message ?? String(error);
  const detail = [cause.code, cause.syscall, cause.hostname, cause.message]
    .filter(Boolean)
    .join(" ");
  return `${error.message}: ${detail}`;
}

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
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API deployment_type] GET Error:", error);
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    console.log("[API deployment_type] Patching Body:", JSON.stringify(body));

    const headers = {
      "Content-Type": "application/json",
      ...(authHeader ? { "Authorization": authHeader } : {}),
    };

    let response = await fetch(baseUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    // The records API updates in place and 404s when the settings row does not
    // exist yet -- but its GET synthesises a default ("Azure DevOps") rather
    // than 404ing, so the drawer shows a deployment target that cannot be
    // changed: every PATCH from that first-run state fails and the dropdown
    // silently reverts. POST is the create half of the same resource, so fall
    // through to it once and let the first save establish the row.
    if (response.status === 404) {
      console.info("[API deployment_type] No stored deployment type yet; creating it via POST.");
      response = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    }

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
    console.error("[API deployment_type] PATCH Error:", error);
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
}
