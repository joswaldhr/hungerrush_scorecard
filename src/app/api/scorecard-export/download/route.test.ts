// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: session }));
import { POST } from "./route";
import { MAX_EXPORT_BYTES } from "@/lib/export-download";

const origin = "https://cadence.example.test";
function request(
  data: BlobPart = "%PDF-1.3\nfixture",
  filename = "scorecard.pdf",
  type = "application/pdf",
  from = origin
) {
  const form = new FormData();
  form.append("file", new File([data], filename, { type }));
  return new Request(`${origin}/api/scorecard-export/download`, {
    method: "POST",
    headers: { Origin: from },
    body: form,
  });
}
beforeEach(() => session.mockResolvedValue({ user: { email: "presenter@example.test" } }));
describe("authenticated ephemeral export downloads", () => {
  it.each([
    ["pdf", "application/pdf", "%PDF-1.3\nfixture"],
    [
      "csv",
      "text/csv;charset=utf-8",
      '\uFEFF"Employee","Period","Metric"\n"Synthetic","Week","Zero"',
    ],
  ])("returns exact %s bytes as a private attachment", async (extension, type, data) => {
    const response = await POST(request(data, `scorecard.${extension}`, type));
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new TextEncoder().encode(data));
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="scorecard.${extension}"`
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("returns the exact PNG bytes", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const response = await POST(request(bytes, "scorecard.png", "image/png"));
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });
  it("denies unauthenticated and cross-origin submissions", async () => {
    session.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    expect(
      (await POST(request(undefined, undefined, undefined, "https://other.example.test"))).status
    ).toBe(403);
    const noOrigin = request();
    noOrigin.headers.delete("origin");
    expect((await POST(noOrigin)).status).toBe(403);
  });
  it.each([
    ["scorecard.html", "text/html", "<script>bad</script>"],
    ["scorecard.pdf", "application/pdf", "not a PDF"],
    ["scorecard.png", "image/png", "not a PNG"],
    ["scorecard.csv", "text/csv", "not a scorecard"],
    ["scorecard.pdf", "text/plain", "%PDF-1.3"],
    ["scorecard.pdf", "application/pdf", ""],
  ])("rejects mismatched or malformed file %s %s", async (name, type, contents) => {
    expect((await POST(request(contents, name, type))).status).toBe(400);
  });
  it("rejects unsafe header filenames", async () => {
    expect((await POST(request(undefined, 'bad"name.pdf'))).status).toBe(400);
  });
  it("bounds payloads even without Content-Length", async () => {
    for (const size of [MAX_EXPORT_BYTES + 1, MAX_EXPORT_BYTES + 100_000]) {
      const outgoing = request(new Uint8Array(size));
      // Model incoming HTTP bytes, not Undici's outgoing multipart encoder (whose
      // cancellation can enqueue into its already-closed internal stream).
      const incoming = new Request(outgoing.url, {
        method: "POST",
        headers: outgoing.headers,
        body: await outgoing.arrayBuffer(),
      });
      expect((await POST(incoming)).status).toBe(413);
    }
    const declared = request();
    declared.headers.set("content-length", "9999999");
    expect((await POST(declared)).status).toBe(413);
  });
  it("rejects unsupported content and malformed multipart", async () => {
    for (const type of ["application/json", "multipart/form-data; boundary=missing"]) {
      const req = new Request(`${origin}/api/scorecard-export/download`, {
        method: "POST",
        headers: { origin, "content-type": type },
        body: "bad",
      });
      expect((await POST(req)).status).toBe(400);
    }
  });
});
