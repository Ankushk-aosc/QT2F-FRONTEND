import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "success" | "warning" | "outline";
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  const classes = ["ui-badge", `ui-badge-${variant}`, className].filter(Boolean).join(" ");
  return <span className={classes} {...props} />;
}
