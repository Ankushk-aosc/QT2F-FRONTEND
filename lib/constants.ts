export const MIGRATION_MODE = {
  LITE: "0",
  STANDARD: "1",
} as const;

export type MigrationMode = typeof MIGRATION_MODE[keyof typeof MIGRATION_MODE];

export const SUPPORTED_TIMEZONES = [
  "UTC",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];
