import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      digest?: string;
      stack?: string;
      url?: string;
    };

    logger.error("Client-side error boundary triggered", {
      message: body.message,
      digest: body.digest,
      stack: body.stack,
      url: body.url,
    });
  } catch {
    // Reporting the error must never itself throw back at the client.
  }

  return NextResponse.json({ ok: true });
}
