export const MAX_EXPORT_BYTES = 3_500_000;

/** Use a normal HTTP attachment for browsers that cannot save blob URLs. */
export function requestExportDownload(blob: Blob, filename: string) {
  if (blob.size > MAX_EXPORT_BYTES) {
    throw new Error(
      "This file is too large to download here. Use Open preview to save it, or export CSV."
    );
  }
  const container = document.createElement("div");
  container.hidden = true;
  const frame = document.createElement("iframe");
  frame.name = `scorecard-download-${crypto.randomUUID()}`;
  frame.title = "Scorecard file download";
  const form = document.createElement("form");
  form.action = "/api/scorecard-export/download";
  form.method = "POST";
  form.enctype = "multipart/form-data";
  form.target = frame.name;
  const input = document.createElement("input");
  input.type = "file";
  input.name = "file";
  const transfer = new DataTransfer();
  transfer.items.add(new File([blob], filename, { type: blob.type }));
  input.files = transfer.files;
  form.append(input);
  container.append(frame, form);
  document.body.append(container);
  try {
    form.requestSubmit();
  } catch (error) {
    container.remove();
    throw error;
  }
  // Keep the native submission alive through dialog closure. Nothing is stored server-side.
  setTimeout(() => container.remove(), 60_000);
}
