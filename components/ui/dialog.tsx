import React from "react";
import {
  Dialog as FluentDialog,
  DialogTrigger as FluentDialogTrigger,
  DialogSurface,
  DialogTitle as FluentDialogTitle,
  DialogBody,
} from "@fluentui/react-components";

export function Dialog({ children, open, onOpenChange, ...props }: any) {
  return (
    <FluentDialog
      open={open}
      onOpenChange={(_, data) => onOpenChange?.(data.open)}
      {...props}
    >
      {children}
    </FluentDialog>
  );
}

export function DialogTrigger({ children, ...props }: any) {
  return <FluentDialogTrigger {...props}>{children}</FluentDialogTrigger>;
}

export function DialogContent({ children, style, ...props }: any) {
  return (
    <DialogSurface style={{ maxWidth: "600px", width: "100%", padding: "20px", ...style }} {...props}>
      <DialogBody>{children}</DialogBody>
    </DialogSurface>
  );
}

export function DialogHeader({ style, ...props }: any) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px", ...style }} {...props} />;
}

export function DialogTitle({ children, ...props }: any) {
  return <FluentDialogTitle {...props}>{children}</FluentDialogTitle>;
}

export function DialogDescription({ style, ...props }: any) {
  return <div style={{ fontSize: "14.5px", color: "#64748b", ...style }} {...props} />;
}

export function DialogClose({ children, ...props }: any) {
  return (
    <FluentDialogTrigger action="close" {...props}>
      {children}
    </FluentDialogTrigger>
  );
}
export function DialogFooter({ style, ...props }: any) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px", ...style }} {...props} />;
}
