import React from "react";
import { tokens } from "@fluentui/react-components";

export function Card({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        backgroundColor: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        boxShadow: tokens.shadow2,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        ...style,
      }}
      {...props}
    />
  );
}

export function CardHeader({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px", ...style }} {...props} />;
}

export function CardTitle({ style, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 style={{ fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1, margin: 0, ...style }} {...props} />;
}

export function CardDescription({ style, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, margin: 0, ...style }} {...props} />;
}

export function CardContent({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ ...style }} {...props} />;
}

export function CardFooter({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "12px", ...style }} {...props} />;
}
