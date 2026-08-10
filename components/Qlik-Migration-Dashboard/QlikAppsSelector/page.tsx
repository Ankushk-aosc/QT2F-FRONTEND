"use client";

import React, { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QlikApp } from "@/types/assessment";

interface QlikAppsSelectorProps {
  selectedApps: string[];
  apps: QlikApp[];
  isProcessing: boolean;
  hasProcessed: boolean;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  dropdownDirection: "down" | "up";
  setDropdownDirection: (direction: "right" | "up") => void;
  onAppSelection: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

// Confirmation Popup Component
const ConfirmationPopup: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
        <h2 className="text-lg font-bold mb-4">Start New Processing?</h2>
        <p className="mb-4">Do you want to start new processing?</p>
        <div className="flex justify-center gap-4">
          <Button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            OK
          </Button>
          <Button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-black rounded-md hover:bg-gray-400"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export function QlikAppsSelectorContent({
  selectedApps,
  apps,
  isProcessing,
  hasProcessed,
  dropdownOpen,
  setDropdownOpen,
  dropdownDirection,
  setDropdownDirection,
  onAppSelection,
  onRemoveApp,
  dropdownRef,
}: QlikAppsSelectorProps) {
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [pendingAppToRemove, setPendingAppToRemove] = useState<string | null>(null);

  const handleClick = () => {
    if (hasProcessed && !isProcessing) {
      setShowConfirmPopup(true);
    } else if (!isProcessing) {
      const triggerRect = dropdownRef.current?.getBoundingClientRect();
      if (triggerRect) {
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const dropdownHeight = 160;
        if (spaceBelow < dropdownHeight && triggerRect.top > dropdownHeight) {
          setDropdownDirection("up");
        } else {
          setDropdownDirection("right"); // Changed from "right" to "down" to match typical dropdown behavior
        }
      }
      setDropdownOpen(true);
    }
  };

  const handleRemoveApp = (appId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (hasProcessed && !isProcessing) {
      setPendingAppToRemove(appId);
      setShowConfirmPopup(true);
    } else {
      onRemoveApp(appId);
    }
  };

  const handleConfirm = () => {
    setShowConfirmPopup(false);
    if (pendingAppToRemove) {
      onRemoveApp(pendingAppToRemove);
      setPendingAppToRemove(null);
    }
    window.location.reload();
  };

  const handleCancel = () => {
    setShowConfirmPopup(false);
    setPendingAppToRemove(null);
  };

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Applications</label>
        <div className="relative" ref={dropdownRef}>
          <div
            className={cn(
              "w-full p-2 border rounded-md bg-white min-h-[40px] flex flex-wrap items-center gap-2",
              isProcessing ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            )}
            onClick={handleClick}
          >
            {selectedApps.map((appId) => {
              const app = apps.find((a) => a.id === appId);
              return app ? (
                <div key={appId} className="flex items-center bg-gray-200 text-sm px-2 py-1 rounded-full">
                  <span className="truncate">{app.name}</span>
                  {!isProcessing && (
                    <button
                      onClick={(e) => handleRemoveApp(appId, e)}
                      className="ml-1 text-red-500 hover:text-red-700 w-4 h-4 flex items-center justify-center rounded-full bg-white hover:bg-gray-300"
                    >
                      ×
                    </button>
                  )}
                </div>
              ) : null;
            })}
            {selectedApps.length === 0 && <span className="text-muted-foreground">Select applications</span>}
          </div>
          {dropdownOpen && !isProcessing && (
            <ul
              className={cn(
                "absolute z-10 w-full border rounded-md bg-white shadow-lg max-h-40 overflow-y-auto",
                dropdownDirection === "down" ? "top-full mt-1" : "bottom-full mb-1"
              )}
            >
              {apps
                .filter((app) => !selectedApps.includes(app.id))
                .map((app) => (
                  <li
                    key={app.id}
                    onClick={() => onAppSelection(app.id)}
                    className="p-2 cursor-pointer hover:bg-gray-100"
                  >
                    {app.name}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
      {showConfirmPopup && <ConfirmationPopup onConfirm={handleConfirm} onCancel={handleCancel} />}
    </>
  );
}