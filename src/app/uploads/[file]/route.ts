import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_NAME, uploadsDir } from "@/server/storage/local";

/**
 * `next start` lists public/ once at boot, so files uploaded later would 404. This serves
 * them, and only names that match what the upload step generates.
 */
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  if (!UPLOAD_NAME.test(file)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(uploadsDir(), file));
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
