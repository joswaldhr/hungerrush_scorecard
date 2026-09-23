/** Database error messages and enumerable properties can contain SQL and row values. */
export function errorSummary(error: unknown): { name: string; message: string; code?: string } {
  const seen = new Set<unknown>();
  let current = error;
  let databaseError = false;
  let code: string | undefined;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const detail = current as Record<string, unknown>;
    if ("query" in detail || "params" in detail || detail.name === "PostgresError") {
      databaseError = true;
    }
    if (typeof detail.code === "string" && /^[0-9A-Z]{5}$/.test(detail.code)) {
      databaseError = true;
      code = detail.code;
    }
    current = detail.cause;
  }
  if (databaseError) {
    return {
      name: "DatabaseError",
      message: "Database operation failed",
      ...(code ? { code } : {}),
    };
  }
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "Error", message: "Operation failed" };
}

export function safeErrorMessage(error: unknown): string {
  const summary = errorSummary(error);
  return summary.code ? `${summary.message} (${summary.code})` : summary.message;
}
