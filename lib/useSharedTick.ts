"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let currentTimestamp = Date.now();

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (!timer && typeof window !== "undefined") {
    timer = setInterval(() => {
      currentTimestamp = Date.now();
      listeners.forEach((cb) => cb());
    }, 1000);
  }

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return currentTimestamp;
}

function getServerSnapshot(): number {
  return 0;
}

const noopSubscribe = () => () => {};

/**
 * A centralized, shared 1-second interval hook that coordinates all active timers across
 * the application to share a single interval tick instead of spinning up independent timers.
 *
 * Automatically pauses the shared timer when no active components are subscribed.
 */
export function useSharedTick(isActive: boolean = true): number {
  return useSyncExternalStore(
    isActive ? subscribe : noopSubscribe,
    getSnapshot,
    getServerSnapshot
  );
}
