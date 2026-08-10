import React from "react";
import { tokens } from "@fluentui/react-components";

export function Alert({ variant = "default", style, ...props }: any) {
  const isDestructive = variant === "destructive";
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${isDestructive ? tokens.colorStatusDangerBorder1 : tokens.colorNeutralStroke1}`,
        backgroundColor: isDestructive ? tokens.colorStatusDangerBackground1 : tokens.colorNeutralBackground2,
        color: isDestructive ? tokens.colorStatusDangerForeground1 : tokens.colorNeutralForeground1,
        marginBottom: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        ...style,
      }}
      {...props}
    />
  );
}

export function AlertTitle({ style, ...props }: any) {
  return (
    <h5
      style={{
        fontWeight: tokens.fontWeightSemibold,
        margin: "0 0 4px 0",
        fontSize: tokens.fontSizeBase300,
        ...style,
      }}
      {...props}
    />
  );
}

export function AlertDescription({ style, ...props }: any) {
  return (
    <div
      style={{
        fontSize: tokens.fontSizeBase200,
        ...style,
      }}
      {...props}
    />
  );
}
