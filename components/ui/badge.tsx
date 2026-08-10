import React from "react";
import { Badge as FluentBadge } from "@fluentui/react-components";

export function Badge({ variant = "default", style, ...props }: any) {
  let color: "brand" | "danger" | "success" | "warning" | "subtle" = "subtle";
  if (variant === "secondary") color = "subtle";
  if (variant === "destructive") color = "danger";
  if (variant === "success") color = "success";
  if (variant === "warning") color = "warning";
  if (variant === "default" || variant === "outline") color = "brand";

  return <FluentBadge color={color as any} style={style} {...props} />;
}
