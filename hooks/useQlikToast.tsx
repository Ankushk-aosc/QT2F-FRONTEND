"use client";

import { useToastController, Toast, ToastTitle, ToastBody } from "@fluentui/react-components";

export const QLIK_TOASTER_ID = "qlik-toaster";

export function useQlikToast() {
  const { dispatchToast } = useToastController(QLIK_TOASTER_ID);

  return {
    success: (message: string) =>
      dispatchToast(
        <Toast>
          <ToastTitle>Success</ToastTitle>
          <ToastBody>{message}</ToastBody>
        </Toast>,
        { intent: "success" }
      ),
    error: (message: string) =>
      dispatchToast(
        <Toast>
          <ToastTitle>Error</ToastTitle>
          <ToastBody>{message}</ToastBody>
        </Toast>,
        { intent: "error" }
      ),
    info: (message: string) =>
      dispatchToast(
        <Toast>
          <ToastTitle>Info</ToastTitle>
          <ToastBody>{message}</ToastBody>
        </Toast>,
        { intent: "info" }
      ),
  };
}
