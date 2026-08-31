"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Read-only display of the Qlik Cloud URL belonging to the selected saved
 * connection.
 *
 * The field used to own its own Edit / Update pair and POST the URL straight to
 * the records host. That is now the Configure dialog's job: the URL is one
 * attribute of a saved connection, so editing it in two places could leave the
 * page pointing at one tenant while the stored connection named another. This
 * mirrors T2F, where the server URL is likewise only editable inside Configure
 * Source Connection and never on the page itself.
 *
 * Kept as its own component rather than inlined so the Source panel keeps the
 * same label-above-input rhythm as the selectors beneath it.
 */
interface QlikUrlConfigProps {
  /** Applied from the saved connection; empty until one is configured. */
  qlikUrl: string;
}

export function QlikUrlConfigContent({ qlikUrl }: QlikUrlConfigProps) {
  return (
    <div>
      <Label className="text-primary">Qlik Cloud URL</Label>
      <div className="mt-1 flex items-center gap-3">
        <Input
          type="url"
          className="flex-1"
          value={qlikUrl || ""}
          readOnly
          disabled
          placeholder="Set this in Configure"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
