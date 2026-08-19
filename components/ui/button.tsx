import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  /** Renders as an anchor instead of a button — used for "Go Home" style links. */
  as?: "button" | "a";
  href?: string;
}

/**
 * The application's button. Plain HTML underneath — a native `<button>`
 * (or `<a>` when `as="a"`) gets keyboard activation and focus handling for
 * free, which is what the previous Fluent-backed wrapper depended on Fluent
 * for. Variant/size are CSS classes (see `.ui-btn*` in globals.css) so
 * hover/focus-visible states are real CSS, not something reimplemented in JS.
 */
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ variant = "default", size = "default", as = "button", style, disabled, className, ...props }, ref) => {
    const classes = ["ui-btn", `ui-btn-${variant}`, `ui-btn-${size}`, className].filter(Boolean).join(" ");

    if (as === "a") {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          style={style}
          className={classes}
          aria-disabled={disabled}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        />
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={props.type ?? "button"}
        style={style}
        className={classes}
        disabled={disabled}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
