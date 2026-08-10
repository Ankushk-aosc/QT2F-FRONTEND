// services/fabric.service.ts
import { ApplicationError } from "@/lib/error-handler";
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
  private accessToken: string = "";
  // We keep correct structure but remove stateful token management in preparation for hook usage or stateless calls
  // However, existing component code calls `initialize(getToken)`.
  // We must support that signature OR update component.
  // Given instructions: "No duplicate HTTP clients" and "Every API call automatically sends Authorization".
  // The Component passes a callback `getToken`.
  // We should ignore that callback and use our centralized `fetchWithAuth` which gets token from `MsalProviderWrapper`.

  private initialized: boolean = false;

  initialize(getToken: () => Promise<string>): void {
    // Deprecated: We use fetchWithAuth now which internally gets token.
    // Keeping this method signature to avoid breaking component call sites immediately.
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async initializeConnection(): Promise<FabricCredentials> {
    // Call via local API proxy
    const credentials = await fetchWithAuth<FabricCredentials>(`${this.baseUrl}/connect`, {
      method: "POST"
    }, "fabric_access_token");

    this.credentials = { ...credentials, isConnected: true, connectionTime: new Date().toISOString() };
    return this.credentials!;
  }

  async getWorkspaces(): Promise<FabricWorkspace[]> {
    const data = await fetchWithAuth<any>(`${this.baseUrl}/workspaces`, {}, "fabric_access_token");
    return Array.isArray(data) ? data : (data.workspaces || []);
  }

  async selectWorkspace(workspaceId: string): Promise<void> {
    // Optional: Validate workspace access or store selection in backend session
  }

  async getLakehouses(workspaceId: string): Promise<FabricLakehouse[]> {
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