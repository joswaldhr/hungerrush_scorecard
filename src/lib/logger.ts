import { errorSummary } from "./error-summary";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function log(entry: LogEntry) {
  const timestamp = new Date().toISOString();
  const payload = { timestamp, ...entry };
  // Never serialize enumerable driver fields (query, params, detail, or cause).
  const serialized = JSON.stringify(payload, (key, value: unknown) =>
    value instanceof Error || (key === "error" && value !== null && value !== undefined)
      ? errorSummary(value)
      : value
  );

  switch (entry.level) {
    case "debug":
      console.debug(serialized);
      break;
    case "info":
      console.info(serialized);
      break;
    case "warn":
      console.warn(serialized);
      break;
    case "error":
      console.error(serialized);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log({ level: "debug", message, context }),
  info: (message: string, context?: Record<string, unknown>) =>
    log({ level: "info", message, context }),
  warn: (message: string, context?: Record<string, unknown>) =>
    log({ level: "warn", message, context }),
  error: (message: string, context?: Record<string, unknown>) =>
    log({ level: "error", message, context }),
};
