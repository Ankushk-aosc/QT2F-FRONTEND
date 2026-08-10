import { NextResponse } from "next/server";

import { errorResponse, requireAuth, successResponse } from "@/lib/api/routeHelpers";
import { getSettings, updateSettings } from "@/lib/settings/repository";
import { getApplicationVersion } from "@/lib/settings/version";
import type { PlatformSettingsPatch, PlatformSettingsResponse } from "@/types/settings";

/**
 * Platform settings for the Enterprise Administration Center.
 *
 * GET  — current settings plus the running application version.
 * PUT  — merges a partial patch into the stored settings.
 *
 * Both require a bearer token: platform configuration is an administrative
 * surface and must never be readable or writable anonymously.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = requireAuth(request.headers.get("Authorization"));
  if (unauthorized) return unauthorized;

  try {
    const { settings, updatedAt } = await getSettings();
    const payload: PlatformSettingsResponse = {
      settings,
      applicationVersion: getApplicationVersion(),
      updatedAt,
    };
    return successResponse(payload);
  } catch (error) {
    console.error("[API settings] GET failed:", error);
    return errorResponse("Failed to load platform settings");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const unauthorized = requireAuth(request.headers.get("Authorization"));
  if (unauthorized) return unauthorized;

  let patch: PlatformSettingsPatch;
  try {
    patch = (await request.json()) as PlatformSettingsPatch;
  } catch {
    return errorResponse("Request body must be valid JSON", 400);
  }

  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return errorResponse("Request body must be a settings patch object", 400);
  }

  try {
    // The repository validates every field against its allowed values, so an
    // unexpected or malicious payload cannot reach storage.
    const { settings, updatedAt } = await updateSettings(patch);
    const payload: PlatformSettingsResponse = {
      settings,
      applicationVersion: getApplicationVersion(),
      updatedAt,
    };
    return successResponse(payload);
  } catch (error) {
    console.error("[API settings] PUT failed:", error);
    return errorResponse("Failed to save platform settings");
  }
}
