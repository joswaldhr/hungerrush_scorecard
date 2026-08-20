type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function log(entry: LogEntry) {
  const timestamp = new Date().toISOString();
  const payload = { timestamp, ...entry };

  switch (entry.level) {
    case "debug":
      console.debug(JSON.stringify(payload));
      break;
    case "info":
      console.info(JSON.stringify(payload));
      break;
    case "warn":
      console.warn(JSON.stringify(payload));
      break;
    case "error":
      console.error(JSON.stringify(payload));
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
