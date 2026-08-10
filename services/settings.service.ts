import { fetchWithAuth } from "@/lib/fetchWithAuth";

import type { PlatformSettingsPatch, PlatformSettingsResponse } from "@/types/settings";

/**
 * Client-side access to platform settings for the Administration Center.
 *
 * Mirrors the existing service conventions in this repository: a thin class
 * exported as a singleton, talking to a Next.js route via `fetchWithAuth` so
 * the bearer token is attached consistently.
 */
class SettingsService {
  async getSettings(): Promise<PlatformSettingsResponse> {
    try {
      return await fetchWithAuth<PlatformSettingsResponse>("/api/settings");
    } catch (error) {
      console.error("[SettingsService] getSettings error:", error);
      throw error;
    }
  }

  /**
   * Merges a partial patch into the stored settings and returns the saved
   * document, so callers can reconcile their local state with what the server
   * actually accepted after validation.
   */
  async updateSettings(patch: PlatformSettingsPatch): Promise<PlatformSettingsResponse> {
    try {
      return await fetchWithAuth<PlatformSettingsResponse>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    } catch (error) {
      console.error("[SettingsService] updateSettings error:", error);
      throw error;
    }
  }
}

export const settingsService = new SettingsService();
