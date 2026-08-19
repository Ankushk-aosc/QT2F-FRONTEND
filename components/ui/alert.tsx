import React from "react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

export function Alert({ variant = "default", className, role, ...props }: AlertProps) {
  const classes = ["ui-alert", variant === "destructive" && "ui-alert-destructive", className].filter(Boolean).join(" ");
  return <div role={role ?? (variant === "destructive" ? "alert" : "status")} className={classes} {...props} />;
}

export function AlertTitle({ style, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 style={{ fontWeight: 600, margin: "0 0 4px 0", fontSize: "var(--text-base)", ...style }} {...props} />;
}

export function AlertDescription({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ fontSize: "var(--text-sm)", ...style }} {...props} />;
}
