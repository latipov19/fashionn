"use client";

import type { DrawingUtils, ImageSegmenter, ImageSegmenterResult, RGBAColor } from "@mediapipe/tasks-vision";

const WASM_BASE = "/vendor/mediapipe/wasm";
const MODEL_URL = "/vendor/mediapipe/selfie_multiclass_256x256.tflite";

/** selfie_multiclass_256x256 categories: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 other. */
const HAIR = 1;
const BODY_SKIN = 2;
const FACE_SKIN = 3;
const CATEGORIES = 6;
/** The masks are built small and scaled up. */
const MASK_WIDTH = 320;
/** Softens the model's 256 px steps once, on the small mask, rather than on every full-size frame. */
const SOFTEN = "blur(1px)";

const colours = (shown: number[]): RGBAColor[] => Array.from({ length: CATEGORIES }, (_, category) => (shown.includes(category) ? [255, 255, 255, 255] : [0, 0, 0, 0]));
const HEAD_COLOURS = colours([HAIR, FACE_SKIN]);
const SKIN_COLOURS = colours([BODY_SKIN]);
const CLEAR: RGBAColor = [0, 0, 0, 0];

/** Alpha masks of the current frame, small; draw them scaled to the frame. */
export type BodyMasks = {
  /** Hair and face: always in front of the garment. */
  head: HTMLCanvasElement;
  /** Neck, arms and hands (and any other bare skin): in front only where the fit allows it. */
  skin: HTMLCanvasElement;
};

export type BodyMasker = {
  /** Null until the first frame has been segmented. */
  readonly masks: BodyMasks | null;
  update: (video: HTMLVideoElement, timeMs: number) => void;
  close: () => void;
};

function canvasOf() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable");
  return { canvas, context };
}

/**
 * Finds the wearer's hair, face and skin in the camera frame (MediaPipe Selfie Multiclass, run in
 * this browser), so they can be drawn in front of the garment. Loaded on demand; the 16 MB model
 * comes from this site.
 *
 * On the GPU the mask never leaves it: MediaPipe draws it straight into the small mask canvases.
 * Reading it back to the CPU instead stalls the GPU for most of a frame.
 */
export async function createBodyMasker(): Promise<BodyMasker> {
  const { DrawingUtils: Drawing, FilesetResolver, ImageSegmenter: Segmenter } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const make = (delegate: "GPU" | "CPU", canvas?: HTMLCanvasElement) =>
    Segmenter.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL, delegate }, canvas, runningMode: "VIDEO", outputCategoryMask: true, outputConfidenceMasks: false });

  const head = canvasOf();
  const skin = canvasOf();
  let segmenter: ImageSegmenter;
  let drawing: { head: DrawingUtils; skin: DrawingUtils } | null = null;
  try {
    // The task's own WebGL canvas, so the mask can be drawn from its texture.
    const gpuCanvas = document.createElement("canvas");
    segmenter = await make("GPU", gpuCanvas);
    const gl = gpuCanvas.getContext("webgl2");
    if (gl) drawing = { head: new Drawing(head.context, gl), skin: new Drawing(skin.context, gl) };
  } catch {
    segmenter = await make("CPU");
  }

  let pixels: { head: ImageData; skin: ImageData } | null = null;
  const raw = { head: canvasOf(), skin: canvasOf() };
  let ready = false;

  /** CPU fallback: read the categories and write two alpha masks by hand. */
  const writeByHand = (result: ImageSegmenterResult, maskHeight: number) => {
    const category = result.categoryMask;
    if (!category || !pixels) return false;
    const data = category.getAsUint8Array();
    const sourceWidth = category.width;
    const sourceHeight = category.height;
    const headOut = pixels.head.data;
    const skinOut = pixels.skin.data;
    for (let y = 0; y < maskHeight; y++) {
      const row = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / maskHeight)) * sourceWidth;
      for (let x = 0; x < MASK_WIDTH; x++) {
        const value = data[row + Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / MASK_WIDTH))];
        const alpha = (y * MASK_WIDTH + x) * 4 + 3;
        headOut[alpha] = value === HAIR || value === FACE_SKIN ? 255 : 0;
        skinOut[alpha] = value === BODY_SKIN ? 255 : 0;
      }
    }
    for (const key of ["head", "skin"] as const) raw[key].context.putImageData(pixels[key], 0, 0);
    for (const [target, source] of [[head, raw.head], [skin, raw.skin]] as const) target.context.drawImage(source.canvas, 0, 0);
    return true;
  };

  return {
    get masks() {
      return ready ? { head: head.canvas, skin: skin.canvas } : null;
    },
    update(video, timeMs) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;
      const maskHeight = Math.round((MASK_WIDTH * height) / width);
      if (head.canvas.width !== MASK_WIDTH || head.canvas.height !== maskHeight) {
        for (const target of [head, skin, raw.head, raw.skin]) {
          target.canvas.width = MASK_WIDTH;
          target.canvas.height = maskHeight;
        }
        pixels = drawing ? null : { head: raw.head.context.createImageData(MASK_WIDTH, maskHeight), skin: raw.skin.context.createImageData(MASK_WIDTH, maskHeight) };
      }
      let written = false;
      segmenter.segmentForVideo(video, timeMs, (result) => {
        // Used inside the callback: the mask is released when it returns.
        for (const target of [head, skin]) {
          target.context.clearRect(0, 0, MASK_WIDTH, maskHeight);
          target.context.filter = SOFTEN;
        }
        if (drawing && result.categoryMask) {
          drawing.head.drawCategoryMask(result.categoryMask, HEAD_COLOURS, CLEAR);
          drawing.skin.drawCategoryMask(result.categoryMask, SKIN_COLOURS, CLEAR);
          written = true;
        } else {
          written = writeByHand(result, maskHeight);
        }
        for (const target of [head, skin]) target.context.filter = "none";
      });
      if (written) ready = true;
    },
    close() {
      drawing?.head.close();
      drawing?.skin.close();
      segmenter.close();
    },
  };
}
