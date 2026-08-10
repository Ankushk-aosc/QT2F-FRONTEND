"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const QLIK_URL_ROUTES = {
  GET_QLIK_URL: "/api/qlik/qlik-url",
  SAVE_QLIK_URL: "/api/qlik/qlik-url",
};

interface QlikUrlConfigProps {
  qlikUrl: string;
  setQlikUrl: (url: string) => void;
  originalQlikUrl: string;
  setOriginalQlikUrl: (url: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
  success: string | null;
  setSuccess: (success: string | null) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  onSaveSuccess: () => void;
}

export function QlikUrlConfigContent({
  qlikUrl,
  setQlikUrl,
  originalQlikUrl,
  setOriginalQlikUrl,
  error,
  setError,
  success,
  setSuccess,
  isEditing,
  setIsEditing,
  isSaving,
  setIsSaving,
  onSaveSuccess,
}: QlikUrlConfigProps) {
  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (qlikUrl === originalQlikUrl) {
      setSuccess("No changes detected.");
      setTimeout(() => setSuccess(null), 1500);
      setIsEditing(false);
      return;
    }

    if (!qlikUrl) {
      setError("Please fill in the Qlik URL.");
      return;
    }

    const urlPattern = /^(https?:\/\/)/i;
    if (!urlPattern.test(qlikUrl)) {
      setError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setIsSaving(true);
    try {
      const api = QLIK_URL_ROUTES.SAVE_QLIK_URL;
      if (!api) {
        throw new Error("Qlik URL API route is not defined");
      }
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server_url: qlikUrl }),
      });
      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(errorResponse.message || "Failed to save settings to server.");
      }
      setOriginalQlikUrl(qlikUrl);
      localStorage.setItem("qlikUrl", qlikUrl);
      setSuccess("✅ Settings saved successfully!");
      setTimeout(() => {
        onSaveSuccess();
      }, 1500);
      setIsEditing(false);
    } catch (e: any) {
      setError(e.message || "Failed to save settings. Please check your browser console for details.");
      console.error("Save error:", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Qlik Cloud URL</label>
        <input
          type="url"
          value={qlikUrl}
          onChange={(e) => setQlikUrl(e.target.value)}
          readOnly={!isEditing}
          className={cn(
            "mt-1 block w-full p-2 border rounded-md bg-white text-black",
            !isEditing && "opacity-60 cursor-not-allowed"
          )}
          placeholder="https://your-qlik-url.com"
          autoComplete="off"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && <p className="text-green-500 text-sm">{success}</p>}
      {isSaving && <p className="text-blue-500 text-sm">Saving...</p>}
      {!isEditing ? (
        <Button
          onClick={() => setIsEditing(true)}
          className="px-4 py-2  text-white rounded-md hover:bg-yellow-600 w-full"
          disabled={isSaving}
        >
          Edit
        </Button>
      ) : (
        <Button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2 w-full"
          disabled={isSaving}
        >
          {isSaving && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
          Update
        </Button>
      )}
    </div>
  );
}