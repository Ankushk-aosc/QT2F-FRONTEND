import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

type ProxyConfig = {
  envKey: keyof ReturnType<typeof getEnv>; // Type safety for env keys
  backendPath: string;
  serviceName: string;
  defaultPort?: number;
  timeoutMs?: number;
};

export async function proxyToMicroservice(
  req: NextRequest,
  config: ProxyConfig
): Promise<NextResponse> {
  const env = getEnv();
  const {
    envKey,
    backendPath,
    serviceName,
    timeoutMs = 45000,
  } = config;

  try {
    let body: any;
    // Only parse body for methods that support it
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.json();
      } catch {
        // Ignore body parsing error if body is optional, or handle?
        // Original code returned 400.
        // But sometimes we just want to proxy. 
        // We'll stick to safety.
      }
    }

    const baseUrl = env[envKey] as string;
    // Typescript might complain accessing via index string if not cast
    // but getEnv() returns strict type.

    if (!baseUrl) {
      console.error(`Missing env var for ${envKey}`);
      return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    const targetUrl = `${baseUrl}${backendPath}`;

    // Extract Authorization header
    const authHeader = req.headers.get("authorization");

    // Log
    // console.log(`Proxying ${req.method} to ${targetUrl}`);

    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: any;
    const contentType = backendRes.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await backendRes.json();
    } else {
      data = { message: await backendRes.text() };
    }

    return NextResponse.json(data, { status: backendRes.status });

  } catch (err: any) {
    console.error(`Proxy failed for ${serviceName}:`, err);
    return NextResponse.json({ error: "Proxy Error", details: err.message }, { status: 502 });
  }
}