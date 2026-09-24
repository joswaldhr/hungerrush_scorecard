/** Capabilities of connectors actually shipped in this application. */
export function sourceSupport(type: string): "supported" | "retired" | "unsupported" {
  if (type === "zendesk") return "supported";
  if (type === "assembled") return "retired";
  return "unsupported";
}
