import { auth } from "@/lib/auth";
import { MAX_EXPORT_BYTES } from "@/lib/export-download";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = MAX_EXPORT_BYTES + 32_768;
const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: privateHeaders });
}

/** Authenticated ephemeral download relay. No database, storage, source reads or payload logging. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return failure("Sign in before downloading.", 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return failure("Same-origin download required.", 403);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) return failure("Invalid file request.", 400);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES)
    return failure("Export is too large.", 413);
  if (!request.body) return failure("Missing file.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    // Bound the actual stream: Content-Length may be absent or incorrect.
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return failure("Export is too large.", 413);
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    const form = await new Response(body, { headers: { "Content-Type": contentType } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return failure("Missing file.", 400);
    if (file.size > MAX_EXPORT_BYTES) return failure("Export is too large.", 413);
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,179}\.(pdf|png|csv)$/.test(file.name)) {
      return failure("Invalid filename.", 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = file.name.split(".").at(-1)!;
    const mime = { pdf: "application/pdf", png: "image/png", csv: "text/csv" }[extension];
    if (file.type.split(";")[0] !== mime) return failure("Invalid file type.", 400);
    const valid =
      extension === "pdf"
        ? new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-"
        : extension === "png"
          ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
          : new TextDecoder("utf-8", { fatal: true })
              .decode(bytes)
              .startsWith('"Employee","Period",');
    if (!valid) return failure("Invalid file contents.", 400);
    return new Response(bytes, {
      headers: {
        ...privateHeaders,
        "Content-Type": mime!,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return failure("Unable to prepare the download.", 400);
  } finally {
    reader.releaseLock();
  }
}
