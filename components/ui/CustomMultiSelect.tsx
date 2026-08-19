"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X, Search, Layers, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface CustomMultiSelectProps {
  label?: string;
  placeholder?: string;
  selectedValues: string[];
  options: MultiSelectOption[];
  onSelect: (value: string) => void;
  onRemove: (value: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  error?: string | null;
}

export function CustomMultiSelect({
  label,
  placeholder = "Select applications...",
  selectedValues,
  options,
  onSelect,
  onRemove,
  onSelectAll,
  onClearAll,
  disabled = false,
  isLoading = false,
  className,
  error = null,
}: CustomMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const selectedOptions = options.filter((opt) => selectedValues.includes(opt.value));
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onRemove(val);
    } else {
      onSelect(val);
    }
  };

  return (
    <div className={cn("space-y-1.5 w-full", className)} ref={containerRef}>
      <div className="flex items-center justify-between">
        {label && (
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </label>
        )}
        {selectedValues.length > 0 && !disabled && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">{selectedValues.length} selected</span>
            {onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-rose-500 hover:text-rose-600 font-medium underline hover:no-underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <div
          onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
          className={cn(
            "w-full min-h-[46px] p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl flex flex-wrap items-center gap-1.5 transition-all duration-200 cursor-pointer",
            "hover:border-blue-400 dark:hover:border-blue-500/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/40",
            isOpen && "border-blue-500 ring-2 ring-blue-500/20 shadow-sm",
            disabled && "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200"
          )}
        >
          {selectedOptions.length === 0 ? (
            <div className="flex items-center justify-between w-full px-2 py-0.5 text-slate-400 text-sm font-normal">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                {isLoading ? "Loading applications..." : placeholder}
              </span>
              <ChevronDown
                className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180 text-blue-500")}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 w-full pr-7">
              {selectedOptions.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 shadow-xs animate-in fade-in-50 duration-150"
                >
                  <span className="truncate max-w-[160px]">{opt.label}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(opt.value);
                      }}
                      className="p-0.5 rounded-md hover:bg-blue-200/80 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300 hover:text-blue-900 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              <div className="absolute right-3 top-3.5 pointer-events-none">
                <ChevronDown
                  className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180 text-blue-500")}
                />
              </div>
            </div>
          )}
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-xl shadow-slate-900/10 overflow-hidden py-1.5 animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="px-2.5 pb-2 pt-0.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="relative flex-1 flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {onSelectAll && options.length > 0 && (
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors shrink-0"
                >
                  Select all
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto px-1 py-1 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-6 px-3 text-center text-xs text-slate-400">
                  {searchQuery ? "No matching applications found" : "No applications available"}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleOption(opt.value)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-lg text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0">
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="truncate">
                          <div className="truncate">{opt.label}</div>
                          {opt.sublabel && (
                            <div className="text-[10px] text-slate-400 font-normal truncate">
                              {opt.sublabel}
                            </div>
                          )}
                        </div>
                      </div>
                      {opt.badge && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
                          {opt.badge}
                        </Badge>
                      )}
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
        </div>
      )}
    </div>
  );
}
