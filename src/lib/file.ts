import type { FilePayload } from "./api";

export const MAX_BYTES = 4 * 1024 * 1024;
const OK_EXT = ["pdf", "png", "jpg", "jpeg"];

/** Returns an error message, or null when the file can be uploaded. */
export function checkFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!OK_EXT.includes(ext)) return "Only PDF, PNG, JPG and JPEG files are accepted.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_BYTES) return "This file is larger than 4 MB. Choose a smaller file.";
  return null;
}

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Plain base64, no "data:" prefix. */
export function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

export async function toPayload(file: File): Promise<FilePayload> {
  return { fileName: file.name, fileType: file.type || "application/octet-stream", fileBase64: await readBase64(file) };
}

export function downloadPayload(p: FilePayload) {
  const bytes = Uint8Array.from(atob(p.fileBase64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: p.fileType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = p.fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
