import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log(
    `[${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })}] /api/sync POST received`
  );

  try {
    // ----- 1. Accept whatever the client sends -----
    const clientPayload = await req.json();
    console.log("Client payload →", clientPayload);

    // ----- 2. Validate required env vars -----
    const syncApiUrl = process.env.SYNC_API_URL;
    if (!syncApiUrl) {
      console.error("SYNC_API_URL not configured");
      return NextResponse.json(
        { error: "SYNC_API_URL is not configured" },
        { status: 500 }
      );
    }

    const gitRepoUrl = process.env.GIT_REPO_URL;
    if (!gitRepoUrl) {
      console.error("GIT_REPO_URL not configured");
      return NextResponse.json(
        { error: "GIT_REPO_URL is not configured" },
        { status: 500 }
      );
    }

    // ----- 3. Build final body for the external sync service -----
    const finalBody = {
      ...clientPayload,                     // everything the client gave us
      gitProviderDetails: {
        ...(clientPayload.gitProviderDetails ?? {}),
        repositoryUrl: gitRepoUrl,          // inject server-side secret
      },
    };

    console.log(`Sending to ${syncApiUrl}:`, finalBody);

    // ----- 4. Call the real sync endpoint -----
    const response = await fetch(syncApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalBody),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Sync service error ${response.status}: ${err}`);
      throw new Error(err);
    }

    const data = await response.json();
    console.log("Sync service response →", data);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("Error in /api/sync:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}