import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { env } from "../env";

/**
 * File storage adapter. Files are kept outside any public web root and are only ever served
 * through authorised API endpoints. Local disk for now; swap for S3-compatible storage later.
 */
export async function putObject(orgId: string, data: Buffer): Promise<{ key: string; sha256: string; size: number }> {
  const key = `${orgId}/${randomUUID()}`;
  const full = path.join(env.storageDir, key);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, data);
  return { key, sha256: createHash("sha256").update(data).digest("hex"), size: data.length };
}

export function readObject(key: string): fs.ReadStream {
  const full = path.join(env.storageDir, key);
  if (!full.startsWith(env.storageDir)) throw new Error("Invalid storage key");
  return fs.createReadStream(full);
}

export async function readObjectBuffer(key: string): Promise<Buffer> {
  return fsp.readFile(path.join(env.storageDir, key));
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  txt: ["text/plain"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
};

/** Returns an error message if the file type isn't allowed, otherwise null. */
export function checkFileType(name: string, mime: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const ok = ALLOWED[ext];
  if (!ok) return "This file type isn't allowed.";
  if (mime && mime !== "application/octet-stream" && !ok.includes(mime)) return "The file doesn't match its type.";
  return null;
}

export function isImage(name: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}
