import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { clientErrorReport } from "@/lib/client-error-report";

export async function POST(request: Request) {
  try {
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ ok: true });
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 4096) {
          await reader.cancel();
          return NextResponse.json({ ok: true });
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
    const body: unknown = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ ok: true });
    logger.error("Client-side error boundary triggered", clientErrorReport(body));
  } catch {
    // Reporting the error must never itself throw back at the client.
  }

  return NextResponse.json({ ok: true });
}
