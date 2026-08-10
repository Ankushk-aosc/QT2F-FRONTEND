"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface QlikSpace {
  id: string;
  name: string;
}

interface QlikSpaceSelectorProps {
  selectedQlikSpace: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  qlikSpaces: QlikSpace[];
  isProcessing: boolean;
  hasProcessed: boolean;
  showNoAppsPopup: boolean;
  setShowNoAppsPopup: (show: boolean) => void;
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

export function QlikSpaceSelectorContent({
  selectedQlikSpace,
  onChange,
  qlikSpaces,
  isProcessing,
  hasProcessed,
  showNoAppsPopup,
  setShowNoAppsPopup,
}: QlikSpaceSelectorProps) {
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (hasProcessed && !isProcessing) {
      setShowConfirmPopup(true);
    } else {
      onChange(e);
    }
  };

  const handleConfirm = () => {
    setShowConfirmPopup(false);
    window.location.reload();
  };

  const handleCancel = () => {
    setShowConfirmPopup(false);
  };

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Qlik Space</label>
        <div className="relative">
          <select
            value={selectedQlikSpace}
            onChange={handleChange}
            className={cn(
              "w-full p-2 border rounded-md appearance-none bg-white",
              isProcessing && "opacity-60 cursor-not-allowed"
            )}
            disabled={isProcessing}
          >
            <option value="" disabled>
              Select a workspace
            </option>
            {qlikSpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none" />
        </div>
      </div>
      {showNoAppsPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
            <h2 className="text-lg font-bold mb-4">No Qlik Apps Found</h2>
            <p className="mb-4">We couldn&apos;t find any apps for the selected space.</p>
            <Button
              onClick={() => setShowNoAppsPopup(false)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              OK
            </Button>
          </div>
        </div>
      )}
      {showConfirmPopup && <ConfirmationPopup onConfirm={handleConfirm} onCancel={handleCancel} />}
    </>
  );
}