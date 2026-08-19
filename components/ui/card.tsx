import React from "react";

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-card", className)} {...props} />;
}

export function CardHeader({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px", ...style }} {...props} />;
}

export function CardTitle({ style, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text)", margin: 0, ...style }} {...props} />;
}

export function CardDescription({ style, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: 0, ...style }} {...props} />;
}

export function CardContent({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ ...style }} {...props} />;
}

export function CardFooter({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "12px", ...style }} {...props} />;
}
