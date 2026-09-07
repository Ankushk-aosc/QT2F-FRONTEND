"use client";

import React, { useEffect, useState } from "react";
import { getSection } from "@/lib/settings/navigation";
import { SettingsPanel, SettingsGroup, SettingRow } from "../SettingsPrimitives";
import { recordsService } from "@/services/records.service";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AiAgentsSection() {
  const section = getSection("ai-agents");
  const { toast } = useToast();

  const [interactive, setInteractive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    recordsService.getInteractiveStatus()
      .then((data) => {
        if (mounted) {
          setInteractive(data.status);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load interactive status", err);
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (!section) return null;

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    // Optimistic update
    setInteractive(checked);
    try {
      await recordsService.updateInteractiveStatus(checked);
      toast({
        title: "Saved",
        description: `Interactive Mode is now ${checked ? "enabled" : "disabled"}.`,
      });
    } catch (err) {
      console.error("Failed to update interactive status", err);
      // Revert optimistic update
      setInteractive(!checked);
      toast({
        title: "Error",
        description: "Failed to save interactive status.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPanel title={section.label} description={section.description}>
      <SettingsGroup title="Migration Execution">
        <SettingRow
          label="Interactive Mode"
          hint="Pause migration between stages (Assessment, Parsing, Mapping, Generation) to allow manual review and refinement of agent outputs."
        >
          {loading ? (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /><span>Loading...</span></div>
          ) : (
            <Switch
              checked={interactive}
              disabled={saving}
              onChange={(checked) => void handleToggle(checked)}
            />
          )}
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  );
}
