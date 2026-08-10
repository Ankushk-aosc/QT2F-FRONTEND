import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export async function GET() {
  try {
    const data = await httpClient.get<any>("/qlik", { apiType: "sql" });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching Qlik URL:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch Qlik URL" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await httpClient.post<any>("/qlik", body, { apiType: "sql" });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error saving Qlik URL:", error);
    return NextResponse.json(
      { message: error.message || "Failed to save Qlik URL" },
      { status: error.status || 500 }
    );
  }
}
