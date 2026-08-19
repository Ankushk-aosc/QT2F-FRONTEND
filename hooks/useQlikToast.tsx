"use client";

import { toast } from "@/components/ui/toaster";

/** Kept for callers that still import a toaster id; the toast stack is global now, so this is unused. */
export const QLIK_TOASTER_ID = "qlik-toaster";

export function useQlikToast() {
  return {
    success: (message: string) => toast("success", message),
    error: (message: string) => toast("error", message),
    info: (message: string) => toast("info", message),
  };
}
