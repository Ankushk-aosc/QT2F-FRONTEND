"use client"

import React, { useEffect, useState } from "react"
import { CheckCircle2, XCircle, Info, X } from "lucide-react"

export type ToastIntent = "success" | "error" | "info"

interface ToastRecord {
  id: string
  title: string
  message: string
  intent: ToastIntent
}

/**
 * A minimal global toast stack — the non-Fluent replacement for
 * `useToastController` + `<Toaster toasterId>`.
 *
 * Fluent's version let each screen mount its own named toaster; nothing here
 * mounts more than one at a time, so a single module-level list plus one
 * `<Toaster />` (rendered once, near the root) covers every caller.
 */
let toasts: ToastRecord[] = []
const listeners = new Set<(next: ToastRecord[]) => void>()

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

function push(intent: ToastIntent, title: string, message: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  toasts = [...toasts, { id, title, message, intent }]
  emit()
  setTimeout(() => dismiss(id), 5000)
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

/** Push a toast from anywhere — no provider needed, `<Toaster />` just needs to be mounted once. */
export function toast(intent: ToastIntent, message: string) {
  const title = intent === "success" ? "Success" : intent === "error" ? "Error" : "Info"
  push(intent, title, message)
}

const ICON: Record<ToastIntent, React.ReactElement> = {
  success: <CheckCircle2 size={18} style={{ color: "var(--success)" }} />,
  error: <XCircle size={18} style={{ color: "var(--danger)" }} />,
  info: <Info size={18} style={{ color: "var(--primary)" }} />,
}

/** Mount once per page that needs toasts (matches where `<Toaster toasterId>` used to be mounted). */
export function Toaster() {
  const [items, setItems] = useState<ToastRecord[]>(toasts)

  useEffect(() => {
    listeners.add(setItems)
    return () => {
      listeners.delete(setItems)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="ui-toaster">
      {items.map((item) => (
        <div key={item.id} className={`ui-toast ui-toast-${item.intent}`} role="status">
          {ICON[item.intent]}
          <div className="ui-toast-body">
            <div className="ui-toast-title">{item.title}</div>
            <div className="ui-toast-message">{item.message}</div>
          </div>
          <button type="button" className="ui-toast-close" aria-label="Dismiss" onClick={() => dismiss(item.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
