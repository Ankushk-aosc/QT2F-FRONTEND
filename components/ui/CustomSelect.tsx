"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface CustomSelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchable?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function CustomSelect({
  label,
  placeholder = "Select an option",
  value,
  options,
  onChange,
  disabled = false,
  isLoading = false,
  error = null,
  onRetry,
  searchable = true,
  className,
  icon,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, searchable]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={cn("space-y-1.5 w-full", className)} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-left text-sm font-medium transition-all duration-200",
            "hover:border-blue-400 dark:hover:border-blue-500/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/40",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
            isOpen && "border-blue-500 ring-2 ring-blue-500/20 shadow-sm",
            disabled && "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200",
            error && "border-rose-300 dark:border-rose-800 bg-rose-50/20"
          )}
        >
          <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
            ) : icon ? (
              <span className="text-slate-400 dark:text-slate-500 shrink-0">{icon}</span>
            ) : null}

            {selectedOption ? (
              <span className="truncate text-slate-900 dark:text-slate-100 font-medium">
                {selectedOption.label}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 truncate font-normal">
                {isLoading ? "Loading..." : placeholder}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-200",
              isOpen && "rotate-180 text-blue-500"
            )}
          />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-xl shadow-slate-900/10 overflow-hidden py-1.5 animate-in fade-in-0 zoom-in-95 duration-150">
            {searchable && options.length > 5 && (
              <div className="px-2.5 pb-1.5 pt-0.5 border-b border-slate-100 dark:border-slate-800">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto px-1 py-1 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-6 px-3 text-center text-xs text-slate-400">
                  {searchQuery ? "No matching options found" : "No options available"}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-lg text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                        opt.disabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <div className="truncate">
                          <div className="truncate">{opt.label}</div>
                          {opt.sublabel && (
                            <div className="text-[10px] text-slate-400 font-normal truncate">
                              {opt.sublabel}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && !isLoading && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold underline hover:no-underline ml-1"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
