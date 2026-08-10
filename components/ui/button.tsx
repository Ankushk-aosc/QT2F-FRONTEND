import React from "react";
import { Button as FluentButton, ButtonProps as FluentButtonProps } from "@fluentui/react-components";

export interface ButtonProps extends Omit<FluentButtonProps, "size"> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<any, any>(
  ({ variant = "default", size = "default", ...props }, ref) => {
    let appearance: FluentButtonProps["appearance"] = "primary";
    if (variant === "outline") appearance = "outline";
    if (variant === "ghost" || variant === "link") appearance = "subtle";
    if (variant === "secondary") appearance = "secondary";
    if (variant === "destructive") appearance = "primary";

    return <FluentButton ref={ref} appearance={appearance} {...props as any} />;
  }
);

Button.displayName = "Button";
