import React from "react";

export function Label({ style, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      style={{
        fontSize: "14px",
        fontWeight: 500,
        color: "#374151",
        display: "inline-block",
        marginBottom: "4px",
        ...style,
      }}
      {...props}
    />
  );
}
