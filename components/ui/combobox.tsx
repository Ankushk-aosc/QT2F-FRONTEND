"use client";
import React, { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import { Option } from "./dropdown";

export { Option };

interface ComboboxOptionSelectData {
  optionValue?: string;
  optionText?: string;
  selectedOptions: string[];
}

export interface ComboboxProps {
  children?: React.ReactNode;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedOptions?: string[];
  onOptionSelect?: (event: React.SyntheticEvent | null, data: ComboboxOptionSelectData) => void;
  onOpenChange?: (event: React.SyntheticEvent | null, data: { open: boolean }) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  freeform?: boolean;
  multiselect?: boolean;
  style?: React.CSSProperties;
  positioning?: string;
}

/**
 * Two modes, matching the previous Fluent `Combobox`'s shape so call sites
 * didn't need to change:
 *  - single (freeform): a text input backed by a native `<datalist>`.
 *  - multiselect: a text input that opens a custom checklist popover, since
 *    HTML has no native searchable-multiselect element.
 */
export function Combobox({
  children,
  value,
  onChange,
  selectedOptions,
  onOptionSelect,
  onOpenChange,
  disabled,
  className,
  placeholder,
  multiselect,
  style,
}: ComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const options: { value: string; text: string; disabled?: boolean; style?: React.CSSProperties }[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as any;
      options.push({
        value: props.value,
        text: props.text ?? (typeof props.children === "string" ? props.children : props.value),
        disabled: props.disabled,
        style: props.style,
      });
    }
  });

  const setOpenState = (next: boolean, event: React.SyntheticEvent | null = null) => {
    setOpen(next);
    onOpenChange?.(event, { open: next });
  };

  useEffect(() => {
    if (!multiselect || !open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange?.(null, { open: false });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiselect, open]);

  if (!multiselect) {
    return (
      <>
        <input
          list={listId}
          className={["ui-input", className].filter(Boolean).join(" ")}
          style={style}
          placeholder={placeholder}
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => {
            onChange?.(e);
            const match = options.find((o) => o.text === e.target.value);
            if (match) onOptionSelect?.(e, { optionValue: match.value, optionText: match.text, selectedOptions: [match.value] });
          }}
        />
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o.value} value={o.text} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", ...style }}>
      <input
        className="ui-input"
        style={{ width: "100%" }}
        placeholder={placeholder}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => {
          onChange?.(e);
          if (!open) setOpenState(true, e);
        }}
        onFocus={(e) => setOpenState(true, e)}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            boxShadow: "var(--shadow-md)",
            maxHeight: "280px",
            overflowY: "auto",
            marginTop: "4px",
          }}
        >
          {options.map((o) => {
            const isSelected = !!selectedOptions?.includes(o.value);
            return (
              <div
                key={o.value ?? o.text}
                onClick={() => {
                  if (o.disabled) return;
                  const current = selectedOptions || [];
                  const next = isSelected ? current.filter((v) => v !== o.value) : [...current, o.value];
                  onOptionSelect?.(null, { optionValue: o.value, optionText: o.text, selectedOptions: next });
                }}
                style={{
                  padding: "8px 12px",
                  cursor: o.disabled ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: isSelected ? "var(--surface-subtle)" : undefined,
                  opacity: o.disabled ? 0.5 : 1,
                  ...o.style,
                }}
              >
                {!o.disabled && <input type="checkbox" checked={isSelected} readOnly />}
                <span>{o.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
