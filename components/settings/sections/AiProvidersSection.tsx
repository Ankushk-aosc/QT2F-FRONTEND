"use client";

import React, { useEffect, useState } from "react";
import { getSection } from "@/lib/settings/navigation";
import { SettingsPanel, SettingsGroup, SettingRow } from "../SettingsPrimitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { aiModelsService, type AiModelDB } from "@/services/aiModels.service";

function ProviderCard({ 
  model, 
  onSave 
}: { 
  model: AiModelDB; 
  onSave: (id: string, updates: Partial<AiModelDB>) => Promise<void>; 
}) {
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Local state for edits
  const [name, setName] = useState(model.name);
  const [baseUrl, setBaseUrl] = useState(model.base_url || "");
  const [apiKey, setApiKey] = useState(""); // Start blank for security
  const [apiVersion, setApiVersion] = useState(model.api_version || "");
  const [modelName, setModelName] = useState(model.model_name || "");

  // Status badging
  const activeLabel = model.is_active ? "Active" : "Inactive";
  const defaultLabel = model.is_default ? "Default" : "Not Default";

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<AiModelDB> = {
        name,
        base_url: baseUrl,
        api_version: apiVersion,
        model_name: modelName
      };

      // Only include api_key if the user actually typed a new one
      if (apiKey && apiKey.trim() !== "") {
        updates.api_key = apiKey;
      }

      await onSave(model.id, updates);
      setEditing(false);
      // Reset api key field after save
      setApiKey("");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(model.name);
    setBaseUrl(model.base_url || "");
    setApiKey(""); // Reset to blank
    setApiVersion(model.api_version || "");
    setModelName(model.model_name || "");
    setEditing(false);
  };

  return (
    <SettingsGroup title={model.provider === "azure_openai" ? "Azure OpenAI" : model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}>
      <SettingRow stacked label="" hint="">
        <div className="flex space-x-2 mb-2">
          <Badge variant={model.is_active ? "success" : "secondary"}>
            {activeLabel}
          </Badge>
          <Badge variant={model.is_default ? "default" : "secondary"}>
            {defaultLabel}
          </Badge>
        </div>
      </SettingRow>

      <SettingRow label="Provider Name">
        <Input 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          readOnly={!editing} 
          disabled={!editing || saving}
          className="max-w-md" 
        />
      </SettingRow>

      <SettingRow label={model.provider === "azure_openai" ? "Endpoint" : "Base URL"}>
        <Input 
          value={baseUrl} 
          onChange={(e) => setBaseUrl(e.target.value)}
          readOnly={!editing} 
          disabled={!editing || saving}
          className="max-w-md" 
        />
      </SettingRow>

      <SettingRow label="API Key">
        <div className="flex max-w-md items-center space-x-2">
          <Input 
            type={showKey || editing ? "text" : "password"} 
            value={editing ? apiKey : "••••••••••••••••"} 
            onChange={(e) => setApiKey(e.target.value)}
            readOnly={!editing} 
            disabled={!editing || saving}
            className="flex-1 font-mono" 
            placeholder={editing ? "Enter new API key (leave blank to keep existing)" : ""}
          />
          <Button 
            variant="outline" 
            size="icon" 
            type="button"
            disabled={saving}
            onClick={() => setShowKey(!showKey)}
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </SettingRow>

      {model.provider === "azure_openai" && (
        <SettingRow label="API Version">
          <Input 
            value={apiVersion} 
            onChange={(e) => setApiVersion(e.target.value)}
            readOnly={!editing} 
            disabled={!editing || saving}
            className="max-w-md" 
          />
        </SettingRow>
      )}

      <SettingRow label={model.provider === "azure_openai" ? "Model / Deployment" : "Model Name"}>
        <Input 
          value={modelName} 
          onChange={(e) => setModelName(e.target.value)}
          readOnly={!editing} 
          disabled={!editing || saving}
          className="max-w-md" 
        />
      </SettingRow>

      <SettingRow stacked label="" hint="">
        <div className="flex space-x-3 pt-2">
          {editing ? (
            <>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>Edit Configuration</Button>
          )}
          <Button disabled variant="outline" title="A secure backend test endpoint is required to use this feature.">
            Test Connection
          </Button>
        </div>
      </SettingRow>
    </SettingsGroup>
  );
}

export function AiProvidersSection() {
  const section = getSection("ai-providers");
  const { toast } = useToast();
  
  const [models, setModels] = useState<AiModelDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    aiModelsService.getAiModels()
      .then((data) => {
        if (mounted) {
          setModels(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch ai_models", err);
        if (mounted) {
          setError("Unable to load AI provider configuration.");
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, []);

  const handleSave = async (id: string, updates: Partial<AiModelDB>) => {
    try {
      const updatedModel = await aiModelsService.updateAiModel(id, updates);
      setModels(prev => prev.map(m => m.id === id ? { ...m, ...updatedModel } : m));
      toast({
        title: "Configuration Saved",
        description: "Provider settings have been successfully updated.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update provider configuration.",
        variant: "destructive",
      });
      throw err; // Re-throw to prevent closing edit mode
    }
  };

  if (!section) return null;

  return (
    <SettingsPanel title={section.label} description="Manage the AI providers used by the migration pipeline.">
      {loading ? (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground p-4">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading provider configuration...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : models.length === 0 ? (
        <Alert className="mt-4">
          <AlertTitle>No providers configured</AlertTitle>
          <AlertDescription>There are currently no AI providers configured in the database.</AlertDescription>
        </Alert>
      ) : (
        models.map(model => (
          <ProviderCard key={model.id} model={model} onSave={handleSave} />
        ))
      )}
    </SettingsPanel>
  );
}
