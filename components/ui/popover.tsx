import React, { createContext, useContext, useEffect, useRef, useState } from "react";

const PopoverContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement> | null;
}>({ open: false, setOpen: () => {}, containerRef: null });

/**
 * An anchored popover. Uncontrolled by default (matches how the previous
 * Fluent version was used — an info button that toggles its own content),
 * with `open`/`onOpenChange` available for callers that want to drive it.
 */
export function Popover({
  children,
  open,
  onOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Accepted for API compatibility with the previous Fluent usage; not otherwise used. */
  trapFocus?: boolean;
  withArrow?: boolean;
  positioning?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Outside click and Escape both close the popover — the same two exits a
  // Fluent Popover offered.
  useEffect(() => {
    if (!resolvedOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedOpen]);

  return (
    <PopoverContext.Provider value={{ open: resolvedOpen, setOpen, containerRef }}>
      <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  children,
  asChild,
}: {
  children: React.ReactElement;
  asChild?: boolean;
  /** Accepted for API compatibility with the previous Fluent usage; not otherwise used. */
  disableButtonEnhancement?: boolean;
}) {
  const { open, setOpen } = useContext(PopoverContext);

  const onClick = (e: React.MouseEvent) => {
    children.props.onClick?.(e);
    setOpen(!open);
  };

  if (asChild) {
    return React.cloneElement(children, { onClick, "aria-expanded": open });
  }

  return (
    <button type="button" onClick={onClick} aria-expanded={open}>
      {children}
    </button>
  );
}

export function PopoverContent({
  children,
  className,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { open } = useContext(PopoverContext);
  if (!open) return null;

  return (
    <div
      role="dialog"
      className={["ui-popover", className].filter(Boolean).join(" ")}
      style={{ top: "calc(100% + 4px)", left: 0, ...style }}
    >
      {children}
    </div>
  );
}
