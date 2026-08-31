import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = getEnv();
    return NextResponse.json({
      env,
      processEnv: {
        NEXT_PUBLIC_RECORDS_API_BASE_URL: process.env.NEXT_PUBLIC_RECORDS_API_BASE_URL,
        MONGO_API_URL: process.env.MONGO_API_URL,
        API_BASE_URL: process.env.API_BASE_URL,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
