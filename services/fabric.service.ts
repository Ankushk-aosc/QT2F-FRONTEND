// services/fabric.service.ts
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export interface FabricCredentials {
  tenantId: string;
  workspaceId: string;
  isConnected: boolean;
  connectionTime?: string;
}

export interface FabricWorkspace {
  id: string;
  name: string;
  displayName?: string; // API often returns 'displayName'
  type: string;
  capacityId?: string;
}

export interface FabricLakehouse {
  id: string;
  displayName: string;
  description?: string;
}

class FabricService {
  private baseUrl: string = "/api/fabric"; // Always use local proxy
  private credentials: FabricCredentials | null = null;
  private initialized: boolean = false;

  initialize(getToken: () => Promise<string>): void {
    // Deprecated: We use fetchWithAuth now which internally gets token.
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensures a valid Fabric-scoped MSAL token (https://api.fabric.microsoft.com/.default)
   * is stored in sessionStorage["fabric_access_token"] BEFORE we call fetchWithAuth.
   *
   * ROOT-CAUSE FIX: fetchWithAuth falls back to getActiveToken() when the key is empty.
   * getActiveToken() acquires the BACKEND API scope token, NOT the Fabric scope.
   * Forwarding that to https://api.fabric.microsoft.com returns HTTP 401.
   * We must pre-populate sessionStorage with the correct Fabric token here.
   */
  private async _ensureFabricToken(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const { getFabricToken } = await import(
        "@/components/providers/MsalProviderWrapper"
      );
      // Silent acquire — stores result in sessionStorage["fabric_access_token"]
      await getFabricToken();
    } catch (err) {
      // Non-fatal: if a cached token exists it will still be used by fetchWithAuth.
      // If there is no token at all, fetchWithAuth will surface the 401 to the caller.
      console.warn("[FabricService] Could not pre-acquire Fabric token:", err);
    }
  }

  async initializeConnection(): Promise<FabricCredentials> {
    await this._ensureFabricToken();
    const credentials = await fetchWithAuth<FabricCredentials>(
      `${this.baseUrl}/connect`,
      { method: "POST" },
      "fabric_access_token"
    );
    this.credentials = {
      ...credentials,
      isConnected: true,
      connectionTime: new Date().toISOString(),
    };
    return this.credentials!;
  }

  async getWorkspaces(): Promise<FabricWorkspace[]> {
    // CRITICAL: Pre-acquire the Fabric-scoped token before fetchWithAuth reads sessionStorage.
    await this._ensureFabricToken();
    const data = await fetchWithAuth<any>(
      `${this.baseUrl}/workspaces`,
      {},
      "fabric_access_token"
    );
    return Array.isArray(data) ? data : (data.workspaces || []);
  }

  async selectWorkspace(workspaceId: string): Promise<void> {
    // Optional: Validate workspace access or store selection in backend session
  }

  async getLakehouses(workspaceId: string): Promise<FabricLakehouse[]> {
    await this._ensureFabricToken();
    const data = await fetchWithAuth<any>(
      `${this.baseUrl}/lakehouses?workspaceId=${encodeURIComponent(workspaceId)}`,
      {},
      "fabric_access_token"
    );
    return Array.isArray(data) ? data : (data.lakehouses || []);
  }

  disconnect(): void {
    this.credentials = null;
    this.initialized = false;
  }

  getCredentials() {
    return this.credentials;
  }
}

export const fabricService = new FabricService();