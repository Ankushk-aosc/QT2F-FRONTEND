import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Proxies Azure DevOps deployment credentials — same pattern as vl-t2f-frontend's
 * `/api/records/deployment/azure-devops`, pointed at the Q2F Cosmos records API:
 * `{API_BASE_URL}/api/records/deployment/azure-devops`
 * (also aliased at `/deployment/azure-devops`).
 */
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

const getEndpoints = () => {
  const apiBaseUrl = getEnv().API_BASE_URL.replace(/\/$/, "");
  return [
    `${apiBaseUrl}/api/records/deployment/azure-devops`,
    `${apiBaseUrl}/deployment/azure-devops`,
  ];
};

export async function GET(request: Request) {
  try {
    const authHeader = getBearerAuthHeader(request);
    if (!authHeader) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const endpoints = getEndpoints();

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          cache: "no-store",
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }

        if (response.status === 404) {
          continue;
        }

        throw new Error(`Backend responded with ${response.status}`);
      } catch (err) {
        if (url === endpoints[endpoints.length - 1]) {
          throw err;
        }
      }
    }

    // Empty defaults when no settings row exists yet (first-run).
    return NextResponse.json({
      azure_devops_org: "",
      azure_devops_project: "",
      azure_devops_repo: "",
      azure_devops_branch: "dev",
    });
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

    const endpoints = getEndpoints();
    let lastResponse: Response | null = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }

        lastResponse = response;
        if (response.status === 404) {
          continue;
        }

        let errorText = "";
        try {
          errorText = await response.text();
        } catch {
          // ignore
        }
        throw new Error(`Backend responded with ${response.status}: ${errorText}`);
      } catch (err: any) {
        if (url === endpoints[endpoints.length - 1]) {
          throw err;
        }
      }
    }

    if (lastResponse && !lastResponse.ok) {
      throw new Error(`Backend responded with ${lastResponse.status}`);
    }

    return NextResponse.json({ success: true, ...body });
  } catch (error: any) {
    console.error("[API deployment/azure-devops] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
