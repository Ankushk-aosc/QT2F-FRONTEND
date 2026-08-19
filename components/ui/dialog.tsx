import React, { createContext, useContext, useEffect, useRef, useState } from "react";

const DialogContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  // Uncontrolled when `open` is omitted — mirrors the previous Fluent
  // Dialog's self-managed state for the common "DialogTrigger opens it,
  // nothing else observes" usage.
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <DialogContext.Provider value={{ open: resolvedOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
}: {
  children: React.ReactElement;
  /** Accepted for API compatibility with the previous Fluent usage; not otherwise used. */
  disableButtonEnhancement?: boolean;
}) {
  const { setOpen } = useContext(DialogContext);
  return React.cloneElement(children, { onClick: () => setOpen(true) });
}

export function DialogClose({ children }: { children: React.ReactElement }) {
  const { setOpen } = useContext(DialogContext);
  return React.cloneElement(children, { onClick: () => setOpen(false) });
}

/**
 * The dialog surface, backed by the native `<dialog>` element via
 * `showModal()`. That single call is what gives this focus trapping, a
 * backdrop, and Escape-to-close for free — behaviour the previous
 * Fluent-backed version got from Fluent's `Dialog` and that a hand-rolled
 * `<div>` overlay would have had to reimplement.
 */
export function DialogContent({
  children,
  className,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { open, setOpen } = useContext(DialogContext);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={["ui-dialog", className].filter(Boolean).join(" ")}
      style={style}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onClick={(e) => {
        // Clicking the backdrop lands on the <dialog> element itself (the
        // content has its own box); clicking inside the content does not.
        if (e.target === ref.current) setOpen(false);
      }}
    >
      {open && children}
    </dialog>
  );
}

export function DialogHeader({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px", ...style }} {...props} />;
}

export function DialogTitle({ style, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, margin: 0, color: "var(--text)", ...style }} {...props} />;
}

export function DialogDescription({ style, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: 0, ...style }} {...props} />;
}

export function DialogFooter({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px", ...style }} {...props} />;
}
