import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseDBTimestamp(ts?: any): Date {
  if (!ts) return new Date(NaN);
  
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts !== "string") return new Date(String(ts));
  
  let cleanTs = ts.trim();
  // Check if it's a naive date string without timezone info and contains date & time
  const hasTz = /Z|[+-]\d{2}:?\d{2}$/i.test(cleanTs);
  if (!hasTz && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(cleanTs)) {
    cleanTs = cleanTs.replace(" ", "T") + "Z";
  }
  return new Date(cleanTs);
}

export function formatDBTimestamp(ts?: string | number, multiLine = false, timeZone = "UTC"): string {
  if (!ts) return "—";
  
  const date = parseDBTimestamp(ts);
  
  if (isNaN(date.getTime())) return String(ts);

  // Validate IANA timezone; fall back to UTC on any error
  let resolvedTz = "UTC";
  try {
    // Intl will throw a RangeError for invalid IANA strings
    Intl.DateTimeFormat(undefined, { timeZone }).format(date);
    resolvedTz = timeZone;
  } catch {
    resolvedTz = "UTC";
  }

  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolvedTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // → "2026-05-18"

  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: resolvedTz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date); // → "19:42:11"

  const tzLabel = resolvedTz === "UTC" ? " UTC" : ` (${resolvedTz})`;
  const separator = multiLine ? "\n" : " ";
  return `${datePart}${separator}${timePart}${tzLabel}`;
}

export function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function getTimeframeBoundaries(timeframe: string, timeZone: string): { start: Date; end: Date } {
  const now = new Date();
  
  // Helper to format/parse local parts in target timezone
  const getLocalParts = (d: Date, tz: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(d);

    const partVal = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0", 10);
    return {
      year: partVal("year"),
      month: partVal("month"),
      day: partVal("day"),
      hour: partVal("hour"),
      minute: partVal("minute"),
      second: partVal("second"),
    };
  };

  // Helper to construct UTC Date from local parts in timezone
  const getUTCDateTimeInTimezone = (
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
    seconds: number,
    tz: string
  ): Date => {
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(utcDate);

    const partVal = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0", 10);
    const formattedYear = partVal("year");
    const formattedMonth = partVal("month");
    const formattedDay = partVal("day");
    const formattedHour = partVal("hour") % 24;
    const formattedMin = partVal("minute");
    const formattedSec = partVal("second");

    const formattedUtc = Date.UTC(formattedYear, formattedMonth - 1, formattedDay, formattedHour, formattedMin, formattedSec);
    const diff = utcDate.getTime() - formattedUtc;

    return new Date(utcDate.getTime() + diff);
  };

  const localNow = getLocalParts(now, timeZone);
  const todayStart = getUTCDateTimeInTimezone(localNow.year, localNow.month, localNow.day, 0, 0, 0, timeZone);
  const todayEnd = getUTCDateTimeInTimezone(localNow.year, localNow.month, localNow.day, 23, 59, 59, timeZone);

  if (timeframe === "Today") {
    return { start: todayStart, end: todayEnd };
  }

  if (timeframe === "Yesterday") {
    const midYesterday = new Date(todayStart.getTime() - 12 * 60 * 60 * 1000);
    const yesterdayParts = getLocalParts(midYesterday, timeZone);
    const yesterdayStart = getUTCDateTimeInTimezone(yesterdayParts.year, yesterdayParts.month, yesterdayParts.day, 0, 0, 0, timeZone);
    const yesterdayEnd = getUTCDateTimeInTimezone(yesterdayParts.year, yesterdayParts.month, yesterdayParts.day, 23, 59, 59, timeZone);
    return { start: yesterdayStart, end: yesterdayEnd };
  }

  if (timeframe === "This Week") {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
    const dayOfWeek = dayNames.indexOf(weekdayStr);
    
    const todayMid = getUTCDateTimeInTimezone(localNow.year, localNow.month, localNow.day, 12, 0, 0, timeZone);
    const mondayMid = new Date(todayMid.getTime() - ((dayOfWeek + 6) % 7) * 24 * 60 * 60 * 1000);
    const mondayParts = getLocalParts(mondayMid, timeZone);
    
    const weekStart = getUTCDateTimeInTimezone(mondayParts.year, mondayParts.month, mondayParts.day, 0, 0, 0, timeZone);
    return { start: weekStart, end: todayEnd };
  }

  // Fallback for "All" or unknown
  return { start: new Date(0), end: new Date(8640000000000000) };
}

/**
 * Sanitizes and cleans up raw API errors (JSON strings, HTML error dumps, stack traces)
 * into friendly human-readable error messages.
 */
export function formatApiErrorMessage(rawError?: string | null): string {
  if (!rawError) return "An unexpected error occurred.";
  
  let msg = String(rawError).trim();
  
  // Try to parse if it's JSON
  try {
    if (msg.startsWith("{") && msg.endsWith("}")) {
      const parsed = JSON.parse(msg);
      if (parsed.error) msg = String(parsed.error);
      else if (parsed.message) msg = String(parsed.message);
      else if (parsed.detail) msg = String(parsed.detail);
    }
  } catch {
    // Not pure JSON
  }

  // If there is embedded JSON like `{"error":"..."}`
  const jsonMatch = msg.match(/\{.*"error"\s*:\s*"([^"]+)".*\}/);
  if (jsonMatch && jsonMatch[1]) {
    msg = jsonMatch[1];
  }

  // Remove HTML tags / boilerplate
  msg = msg.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  
  // Clean up common prefixes
  msg = msg.replace(/^Request failed \[\d+ [^\]]+\]:\s*/i, '');
  msg = msg.replace(/^Error:\s*/i, '');

  if (msg.includes("Cannot POST /unbuildApp") || msg.includes("404")) {
    return "The requested backend service endpoint was not found or is currently initializing.";
  }

  if (msg.includes("500") || msg.includes("Internal Server Error")) {
    return "The migration backend encountered an internal error. Please check your service connection and retry.";
  }

  if (msg.length > 300) {
    msg = msg.substring(0, 297) + "…";
  }

  return msg || "An unexpected error occurred.";
}

