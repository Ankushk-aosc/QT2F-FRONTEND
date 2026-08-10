import React from "react";
import {
  Popover as FluentPopover,
  PopoverTrigger as FluentPopoverTrigger,
  PopoverSurface,
} from "@fluentui/react-components";

export function Popover({ children, open, onOpenChange, ...props }: any) {
  return (
    <FluentPopover
      open={open}
      onOpenChange={(_, data) => onOpenChange?.(data.open)}
      {...props}
    >
      {children}
    </FluentPopover>
  );
}

export function PopoverTrigger({ children, ...props }: any) {
  return <FluentPopoverTrigger {...props}>{children}</FluentPopoverTrigger>;
}

export function PopoverContent({ children, style, ...props }: any) {
  return (
    <PopoverSurface style={{ padding: "12px", ...style }} {...props}>
      {children}
    </PopoverSurface>
  );
}
