import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * MediaPipe's WebAssembly runtime for the try-on page, served from the installed package so the
 * browser never fetches it from a third party and the repository does not carry a 15 MB copy.
 * Only the two files the pose task loads are served; any other name is a 404.
 */
const FILES: Record<string, string> = {
  "vision_wasm_internal.js": "text/javascript; charset=utf-8",
  "vision_wasm_internal.wasm": "application/wasm",
};

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const type = FILES[file];
  if (!type) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision", "wasm", file));
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
