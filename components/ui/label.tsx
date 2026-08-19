import React from "react";

export function Label({
  weight,
  style,
  ...props
}: { weight?: "regular" | "semibold" } & React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      style={{
        fontSize: "14px",
        fontWeight: weight === "semibold" ? 600 : weight === "regular" ? 400 : 500,
        color: "#374151",
        display: "inline-block",
        marginBottom: "4px",
        ...style,
      }}
      {...props}
    />
  );
}
