import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./provider";

export const UPLOADS_URL = "/uploads";

/** Names come from processUpload. This pattern stops anything else reaching the disk. */
export const UPLOAD_NAME = /^[a-f0-9-]{36}-\d{3,4}\.webp$/;

export const uploadsDir = () => path.join(process.cwd(), "public", "uploads");

export const localStorage: StorageProvider = {
  async put(name, bytes) {
    if (!UPLOAD_NAME.test(name)) throw new Error("Refused an upload name");
    const dir = uploadsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    return { url: `${UPLOADS_URL}/${name}` };
  },

  async remove(url) {
    const name = url.startsWith(`${UPLOADS_URL}/`) ? url.slice(UPLOADS_URL.length + 1) : "";
    if (!UPLOAD_NAME.test(name)) return;
    await rm(path.join(uploadsDir(), name), { force: true });
  },
};
