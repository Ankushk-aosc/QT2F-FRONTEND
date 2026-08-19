import React, { useEffect, useRef } from "react";

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * A group of disclosure sections. Each `AccordionItem` is an independent
 * native `<details>`, which gets expand/collapse keyboard and screen-reader
 * semantics for free. The previous Fluent version enforced "only one item
 * open at a time" (`type="single"`); nothing in this codebase relies on
 * that — every caller uses it as a plain reference/FAQ list — so independent
 * items are both simpler and, for that content, the more usable choice.
 */
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accepted for API compatibility with the previous Radix/Fluent-style usage; every item is independently collapsible regardless. */
  type?: "single" | "multiple";
  collapsible?: boolean;
  defaultValue?: string | string[];
}

export function Accordion({ children, className, type, collapsible, defaultValue, ...props }: AccordionProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export function AccordionItem({
  value,
  children,
  className,
  defaultOpen,
  ...props
}: { value: string; defaultOpen?: boolean } & React.HTMLAttributes<HTMLDetailsElement>) {
  const ref = useRef<HTMLDetailsElement>(null);

  // Set the initial open state imperatively, once, on mount only. Passing
  // `open` as a normal React prop would make React re-assert it on every
  // render, silently re-closing (or re-opening) a section the user had just
  // toggled by hand — `<details>` has no `defaultOpen` the way `<input>` has
  // `defaultChecked`, so this is the uncontrolled equivalent.
  useEffect(() => {
    if (defaultOpen && ref.current) ref.current.open = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <details ref={ref} className={cx("ui-accordion-item", className)} {...(props as any)}>
      {children}
    </details>
  );
}

export function AccordionTrigger({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <summary className={cx("ui-accordion-trigger", className)} {...props}>
      {children}
    </summary>
  );
}

export function AccordionContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("ui-accordion-content", className)} {...props}>
      {children}
    </div>
  );
}
