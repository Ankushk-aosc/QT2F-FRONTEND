"use client";
import React, { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
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

export function Combobox({
  children,
  value,
  onChange,
  selectedOptions = [],
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
  const [filterQuery, setFilterQuery] = useState("");

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

  const selectableOptions = useMemo(
    () => options.filter((o) => !o.disabled && o.value !== undefined && o.value !== ""),
    [options]
  );

  const filteredOptions = useMemo(() => {
    if (!filterQuery.trim()) return options;
    const q = filterQuery.toLowerCase();
    return options.filter((o) => (o.text || "").toLowerCase().includes(q));
  }, [options, filterQuery]);

  const setOpenState = (next: boolean, event: React.SyntheticEvent | null = null) => {
    if (disabled && next) return;
    setOpen(next);
    if (!next) setFilterQuery("");
    onOpenChange?.(event, { open: next });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenState(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!multiselect) {
    return (
      <div ref={containerRef} className={`relative inline-block w-full ${className || ""}`} style={style}>
        <input
          list={listId}
          className="ui-input w-full pr-8"
          placeholder={placeholder}
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => {
            onChange?.(e);
            const match = options.find((o) => o.text === e.target.value);
            if (match)
              onOptionSelect?.(e, {
                optionValue: match.value,
                optionText: match.text,
                selectedOptions: [match.value],
              });
          }}
        />
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-60"
        />
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o.value} value={o.text} />
          ))}
        </datalist>
      </div>
    );
  }

  const allSelected =
    selectableOptions.length > 0 &&
    selectableOptions.every((o) => selectedOptions.includes(o.value));

  const handleToggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allSelected) {
      onOptionSelect?.(null, {
        optionValue: "select-all",
        optionText: "Select All",
        selectedOptions: [],
      });
    } else {
      const allIds = selectableOptions.map((o) => o.value);
      onOptionSelect?.(null, {
        optionValue: "select-all",
        optionText: "Select All",
        selectedOptions: allIds,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full ${className || ""}`}
      style={style}
    >
      {/* Trigger */}
      <div
        className={`relative flex items-center ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        onClick={() => !disabled && setOpenState(!open)}
      >
        <input
          className="ui-input w-full cursor-pointer pr-9 text-left font-normal select-none"
          placeholder={placeholder}
          disabled={disabled}
          readOnly
          value={value ?? ""}
        />
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform duration-200">
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${open ? "rotate-180 text-primary" : "text-muted-foreground"}`}
          />
        </div>
      </div>

      {/* Floating Popover Checklist */}
      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 flex flex-col rounded-lg border border-[#cbd5e1] bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-100"
          style={{
            maxHeight: "320px",
            minWidth: "100%",
            backgroundColor: "#ffffff",
            color: "#0f172a",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search bar & Select All inside popover if options exist */}
          {selectableOptions.length > 4 && (
            <div className="border-b border-[#e2e8f0] bg-[#ffffff] p-2">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-[#64748b]" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter applications..."
                  className="w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] py-1.5 pl-8 pr-7 text-xs text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
                  autoFocus
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery("")}
                    className="absolute right-2 text-[#64748b] hover:text-[#0f172a]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Action Header */}
          {selectableOptions.length > 1 && !filterQuery && (
            <div
              onClick={handleToggleAll}
              className="flex cursor-pointer items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#1e40af] hover:bg-[#f1f5f9]"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    allSelected
                      ? "border-[#2563eb] bg-[#2563eb] text-white"
                      : "border-[#94a3b8] bg-white hover:border-[#2563eb]"
                  }`}
                >
                  {allSelected && <Check size={12} strokeWidth={3} />}
                </div>
                <span>Select All Applications</span>
              </div>
              <span className="text-[11px] font-normal text-[#64748b]">
                ({selectableOptions.length})
              </span>
            </div>
          )}

          {/* Option List */}
          <div className="max-h-[220px] overflow-y-auto bg-white p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#64748b]">
                No matching applications found
              </div>
            ) : (
              filteredOptions.map((o) => {
                const isSelected = !!selectedOptions?.includes(o.value);
                return (
                  <div
                    key={o.value ?? o.text}
                    onClick={() => {
                      if (o.disabled) return;
                      const current = selectedOptions || [];
                      const next = isSelected
                        ? current.filter((v) => v !== o.value)
                        : [...current, o.value];
                      onOptionSelect?.(null, {
                        optionValue: o.value,
                        optionText: o.text,
                        selectedOptions: next,
                      });
                    }}
                    className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                      o.disabled
                        ? "cursor-not-allowed text-[#94a3b8] opacity-50"
                        : isSelected
                        ? "bg-[#eff6ff] font-medium text-[#1d4ed8]"
                        : "cursor-pointer text-[#1e293b] hover:bg-[#f1f5f9] hover:text-[#1e40af]"
                    }`}
                    style={o.style}
                  >
                    {!o.disabled && (
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isSelected
                            ? "border-[#2563eb] bg-[#2563eb] text-white"
                            : "border-[#94a3b8] bg-white group-hover:border-[#2563eb]"
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    )}
                    <span className="truncate">{o.text}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
