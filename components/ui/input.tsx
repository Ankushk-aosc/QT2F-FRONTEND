import React from "react";
import { Input as FluentInput } from "@fluentui/react-components";

export const Input = React.forwardRef<any, any>(({ className, ...props }, ref) => {
  return (
    <FluentInput
      ref={ref}
      style={{
        width: "100%",
        boxSizing: "border-box",
      }}
      {...props as any}
    />
  );
});

Input.displayName = "Input";
