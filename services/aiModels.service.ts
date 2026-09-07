import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { ApplicationError } from "@/lib/error-handler";

export interface AiModelDB {
  _id?: string;
  id: string;
  provider: string;
  name: string;
  model_name: string;
  base_url?: string;
  api_version?: string;
  api_key?: string;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export const aiModelsService = {
  async getAiModels(): Promise<AiModelDB[]> {
    try {
      const response = await fetchWithAuth<AiModelDB[]>("/api/ai-models", {
        method: "GET",
      });
      return response || [];
    } catch (error) {
      console.error("[AiModelsService] getAiModels error:", error);
      throw new ApplicationError("Unable to fetch AI Models from backend", "FETCH_MODELS_ERROR", 500);
    }
  },

  async updateAiModel(id: string, updates: Partial<AiModelDB>): Promise<AiModelDB> {
    try {
      const response = await fetchWithAuth<AiModelDB>("/api/ai-models", {
        method: "PATCH",
        body: JSON.stringify({ id, ...updates }),
      });
      return response;
    } catch (error) {
      console.error("[AiModelsService] updateAiModel error:", error);
      throw new ApplicationError("Unable to update AI Model", "UPDATE_MODEL_ERROR", 500);
    }
  }
};
