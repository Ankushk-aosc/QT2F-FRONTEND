// app/api/fetch-tables/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const folderName = req.nextUrl.searchParams.get("folder_name");
  const token = req.headers.get("Authorization"); // pass token from client
  console.info(`token: ${token}`)
  if (!folderName || !token) {
    return NextResponse.json({ error: "Missing folderName or token" }, { status: 400 });
  }

  try {
    const BASE_URL = process.env.NEXT_PUBLIC_CONVERSION_URL?.replace(/\/$/, "");
    const res = await fetch(`${BASE_URL}/fetch/fetch-tables?folder_name=${encodeURIComponent(folderName)}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: token, // pass token as-is
      },
    });

    if (!res.ok) throw new Error(`Fabric fetch failed with status ${res.status} token: ${token}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Fabric fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
  }
}
