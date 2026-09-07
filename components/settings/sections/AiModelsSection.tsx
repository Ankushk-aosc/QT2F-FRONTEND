"use client";

import React, { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settings.store";
import { Select, SelectItem } from "@/components/ui/select";
import { getSection } from "@/lib/settings/navigation";
import { SettingsPanel, SettingsGroup, SettingRow } from "../SettingsPrimitives";
import { aiModelsService, type AiModelDB } from "@/services/aiModels.service";
import { Loader2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function AiModelsSection() {
  const section = getSection("ai-models");
  const aiSettings = useSettingsStore((state) => state.settings.ai);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const [backendModels, setBackendModels] = useState<AiModelDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    aiModelsService.getAiModels()
      .then((data) => {
        if (mounted) {
          setBackendModels(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch ai_models", err);
        if (mounted) {
          setError("Unable to load AI models.");
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, []);

  if (!section) return null;

  const patchAzure = (val: string) => updateSettings({ ai: { selectedModel: val } });
  const patchGroq = (val: string) => updateSettings({ ai: { groqModel: val } });

  // Group models by provider
  const azureModels = backendModels.filter(m => m.provider === "azure_openai" || m.provider === "azure");
  const groqModels = backendModels.filter(m => m.provider === "groq");

  return (
    <SettingsPanel title={section.label} description="Discovered models and per-workflow model assignment.">
      {loading ? (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground p-4">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading available models...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <SettingsGroup title="Azure OpenAI">
            <SettingRow
              label="Default Agent Model"
              hint="The primary AI model used by Semantic Kernel for assessment, generation, and standard orchestration tasks."
            >
              <div className="flex flex-col space-y-3 max-w-md">
                <Select
                  value={aiSettings.selectedModel || "auto"}
                  onValueChange={(val: string) => patchAzure(val)}
                >
                  <SelectItem value="auto">Auto (Let backend decide)</SelectItem>
                  {azureModels.map(m => (
                    <SelectItem key={m.id} value={m.model_name}>
                      {m.name || m.model_name} {!m.is_active ? "(Inactive)" : ""} {m.is_default ? "(Default)" : ""}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </SettingRow>
          </SettingsGroup>

          <SettingsGroup title="Groq">
            <SettingRow
              label="DAX Mapping Model"
              hint="The high-speed model used for translating Qlik/Tableau formulas into Power BI DAX expressions."
            >
              <div className="flex flex-col space-y-3 max-w-md">
                <Select
                  value={aiSettings.groqModel || "auto"}
                  onValueChange={(val: string) => patchGroq(val)}
                >
                  <SelectItem value="auto">Auto (Let backend decide)</SelectItem>
                  {groqModels.map(m => (
                    <SelectItem key={m.id} value={m.model_name}>
                      {m.name || m.model_name} {!m.is_active ? "(Inactive)" : ""} {m.is_default ? "(Default)" : ""}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </SettingRow>
          </SettingsGroup>
        </>
      )}
    </SettingsPanel>
  );
}
