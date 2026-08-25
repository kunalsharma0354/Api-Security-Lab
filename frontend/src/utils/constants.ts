import type { ApiLab, IconName, ServiceStatus, StatItem } from "../types";

/** Primary navigation (rendered by the Sidebar). */
export interface NavEntry {
  label: string;
  path: string;
  icon: IconName;
  tag?: string;
}

export const NAV_MAIN: NavEntry[] = [
  { label: "Dashboard", path: "/", icon: "dashboard" },
  { label: "API Labs", path: "/labs", icon: "flask" },
];

export const NAV_MONITORING: NavEntry[] = [
  { label: "Request Logs", path: "/logs", icon: "logs", tag: "Part 2" },
  { label: "Analytics", path: "/analytics", icon: "analytics", tag: "Part 2" },
];

export const NAV_RESOURCES: NavEntry[] = [
  { label: "API Documentation", path: "/docs", icon: "book" },
  { label: "Settings", path: "/settings", icon: "settings" },
];

/** Dashboard statistic cards. Values are overridden with live /api/metrics data. */
export const DASHBOARD_STATS: StatItem[] = [
  {
    id: "total",
    label: "Total Requests",
    value: "0",
    hint: "Counted by the local backend",
    icon: "bolt",
    tone: "accent",
  },
  {
    id: "success",
    label: "Successful",
    value: "0",
    hint: "HTTP 2xx–3xx responses",
    icon: "check",
    tone: "success",
  },
  {
    id: "blocked",
    label: "Blocked",
    value: "0",
    hint: "Security middleware arrives later",
    icon: "block",
    tone: "warning",
  },
  {
    id: "errors",
    label: "Errors",
    value: "0",
    hint: "HTTP 4xx–5xx responses",
    icon: "alert",
    tone: "danger",
  },
  {
    id: "latency",
    label: "Average Latency",
    value: "0",
    unit: "ms",
    hint: "Measured across recorded requests",
    icon: "timer",
    tone: "info",
  },
  {
    id: "protection",
    label: "Active Protection",
    value: "OFF",
    hint: "Enable labs to activate",
    icon: "shield",
    tone: "default",
  },
];

/** The seven API lab modules (cards). Backends are implemented in Part 2. */
export const API_LABS: ApiLab[] = [
  {
    id: "normal-api",
    order: 1,
    name: "Normal API",
    description: "Baseline API without additional protection.",
    statusLabel: "Ready",
    statusTone: "ready",
    method: "GET",
    endpoint: "/api/demo",
  },
  {
    id: "rate-limit",
    order: 2,
    name: "Rate Limited API",
    description: "Demonstrates server-side request rate limiting.",
    statusLabel: "Active",
    statusTone: "ready",
    method: "GET",
    endpoint: "/api/rate-limit",
    protection: "RATE LIMIT",
  },
  {
    id: "auth",
    order: 3,
    name: "API Key Authentication",
    description: "Requires a valid API key header on every request.",
    statusLabel: "Active",
    statusTone: "ready",
    method: "GET",
    endpoint: "/api/auth",
    protection: "API KEY",
  },
  {
    id: "validate",
    order: 4,
    name: "Input Validation",
    description: "Rejects malformed or unsafe input before processing.",
    statusLabel: "Active",
    statusTone: "ready",
    method: "POST",
    endpoint: "/api/validate",
    protection: "INPUT VALIDATION",
  },
  {
    id: "payload",
    order: 5,
    name: "Request Size Protection",
    description: "Limits oversized request bodies before they hit logic.",
    statusLabel: "Protected",
    statusTone: "neutral",
    method: "POST",
    endpoint: "/api/payload",
    protection: "REQUEST SIZE",
  },
  {
    id: "timeout",
    order: 6,
    name: "Timeout Protection",
    description: "Terminates requests that exceed their time budget.",
    statusLabel: "Protected",
    statusTone: "neutral",
    method: "GET",
    endpoint: "/api/timeout",
    protection: "TIMEOUT",
  },
  {
    id: "protected",
    order: 7,
    name: "Multi-Layer Protected API",
    description: "Combines several defenses into one hardened endpoint.",
    statusLabel: "Protected",
    statusTone: "neutral",
    method: "GET",
    endpoint: "/api/protected",
    protection: "MULTI-LAYER",
  },
];

/** Static service rows. Backend + Rate Limiter rows are rendered live by ApiStatusPanel. */
export const SERVICE_STATUSES: ServiceStatus[] = [
  { id: "database", name: "Database", detail: "Not connected", state: "idle" },
];

/** Message shown when a not-yet-wired lab button is pressed. */
export const PART3_NOTICE = "This lab is not wired to the backend yet";

/** Labs that currently have a real backend implementation attached. */
export const WIRED_LAB_IDS = [
  "normal-api",
  "rate-limit",
  "auth",
  "validate",
] as const;

/** Default editor contents for the input-validation lab. */
export const DEFAULT_VALIDATE_BODY = `{
  "name": "Kunal Sharma",
  "email": "user@example.com",
  "age": 18
}`;

/**
 * Safe one-click payloads for the validation lab. Selecting a preset only
 * replaces the editor contents — nothing is sent until the user presses
 * SEND REQUEST.
 */
export const VALIDATION_PRESETS: { label: string; json: string }[] = [
  {
    label: "Valid Input",
    json: DEFAULT_VALIDATE_BODY,
  },
  {
    label: "Invalid Email",
    json: `{
  "name": "Kunal Sharma",
  "email": "not-an-email",
  "age": 18
}`,
  },
  {
    label: "Invalid Age",
    json: `{
  "name": "Kunal Sharma",
  "email": "user@example.com",
  "age": 5
}`,
  },
  {
    label: "Missing Name",
    json: `{
  "email": "user@example.com",
  "age": 18
}`,
  },
  {
    label: "Unknown Field",
    json: `{
  "name": "Kunal Sharma",
  "email": "user@example.com",
  "age": 18,
  "admin": true
}`,
  },
];
