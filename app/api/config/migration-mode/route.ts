import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { MIGRATION_MODE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getEnv();
  const isLite = (env.AGENTVARIABLE || MIGRATION_MODE.STANDARD).trim() === MIGRATION_MODE.LITE;
  // Absence (or any value other than "1") must resolve to false -- this flag
  // gates whether the full pipeline (Mapping onward) is even attempted, and
  // every deployment that has never heard of this variable, including the
  // client's, has to keep behaving exactly as it does today. See the safety
  // note on isPartialProcessing in lib/config.ts and PROCESSING_MODE.md.
  const enableFullProcessing = (env.ENABLE_FULL_PROCESSING || "").trim() === "1";
  return NextResponse.json({ isLite, enableFullProcessing });
}
