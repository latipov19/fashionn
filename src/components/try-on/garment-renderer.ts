import type { GarmentProfile } from "@/lib/try-on/geometry";
import type { GarmentRig } from "@/lib/try-on/rig";
import type { Capsule, Fit, PixelRig, Triangle } from "@/lib/try-on/warp";
import { affine, gridTriangles, inflate, quadTriangles, sleeveQuads, toPixels, torsoOutline } from "@/lib/try-on/warp";

/** A packshot split once into a torso layer and a sleeves layer, ready to be bent each frame. */
export type PreparedGarment = {
  rig: PixelRig;
  torso: HTMLCanvasElement;
  sleeves: HTMLCanvasElement;
  /** The garment's bounds in the packshot, the area the torso grid covers. */
  area: { left: number; top: number; right: number; bottom: number };
};

/** Grid density for the torso: enough to follow a lean and a waist, few enough to draw every frame. */
const COLUMNS = 8;
const ROWS = 10;
/** Sleeve strips are drawn half as wide again as the rig says, so a bulging sleeve is never clipped. */
const SLEEVE_COVER = 1.5;

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable");
  return [canvas, context];
}

/** Splits the packshot into the torso (with hood or collar) and the sleeves, along the rig's sides. */
export function prepareGarment(image: HTMLImageElement, profile: GarmentProfile, rig: GarmentRig): PreparedGarment {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const pixels = toPixels(rig, width, height);
  const outline = torsoOutline(pixels, height);
  const path = new Path2D();
  path.moveTo(outline[0]!.x, outline[0]!.y);
  for (const point of outline.slice(1)) path.lineTo(point.x, point.y);
  path.closePath();

  const [torso, torsoContext] = canvasOf(width, height);
  torsoContext.drawImage(image, 0, 0);
  torsoContext.globalCompositeOperation = "destination-in";
  torsoContext.fill(path);

  const [sleeves, sleevesContext] = canvasOf(width, height);
  sleevesContext.drawImage(image, 0, 0);
  sleevesContext.globalCompositeOperation = "destination-out";
  sleevesContext.fill(path);

  return { rig: pixels, torso, sleeves, area: { left: profile.left, top: profile.top, right: profile.right + 1, bottom: profile.bottom + 1 } };
}

/** Draws one source triangle onto its target: clipped to the (slightly grown) target, one affine transform. */
function drawTriangle(context: CanvasRenderingContext2D, source: HTMLCanvasElement, triangle: Triangle) {
  const matrix = affine(triangle.source, triangle.target);
  if (!matrix) return;
  const [a, b, c] = inflate(triangle.target, 0.8);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.lineTo(c.x, c.y);
  context.closePath();
  context.clip();
  context.setTransform(...matrix);
  // Only the source triangle's box is drawn, not the whole packshot.
  const xs = triangle.source.map((point) => point.x);
  const ys = triangle.source.map((point) => point.y);
  const left = Math.max(0, Math.floor(Math.min(...xs)) - 2);
  const top = Math.max(0, Math.floor(Math.min(...ys)) - 2);
  const right = Math.min(source.width, Math.ceil(Math.max(...xs)) + 2);
  const bottom = Math.min(source.height, Math.ceil(Math.max(...ys)) + 2);
  if (right > left && bottom > top) context.drawImage(source, left, top, right - left, bottom - top, left, top, right - left, bottom - top);
  context.restore();
}

/** The current camera frame and where the wearer's hair, face and skin are in it. */
export type Occluder = { video: CanvasImageSource; head: HTMLCanvasElement; skin: HTMLCanvasElement };

/** One frame-sized scratch canvas, reused for every cut-out. */
let scratch: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;

/**
 * Draws the camera frame's pixels where the skin mask meets the given capsules (plus, when asked,
 * all of the hair and face), so those parts of the wearer show in front of what is already drawn.
 */
function drawWearer(context: CanvasRenderingContext2D, occluder: Occluder, capsules: readonly Capsule[], withHead: boolean) {
  const { width, height } = context.canvas;
  if (!scratch) scratch = canvasOf(width, height);
  const [layer, g] = scratch;
  if (layer.width !== width || layer.height !== height) {
    layer.width = width;
    layer.height = height;
  }
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, width, height);
  g.fillStyle = "#000";
  g.strokeStyle = "#000";
  g.lineJoin = "round";
  for (const capsule of capsules) {
    const [first, ...rest] = capsule.points;
    if (!first || !rest.length) continue;
    g.lineWidth = capsule.radius * 2;
    g.lineCap = capsule.roundStart ? "round" : "butt";
    g.beginPath();
    g.moveTo(first.x, first.y);
    for (const point of rest) g.lineTo(point.x, point.y);
    g.stroke();
    if (!capsule.roundStart) {
      const end = rest[rest.length - 1]!;
      g.beginPath();
      g.arc(end.x, end.y, capsule.radius, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Region ∩ skin, ∪ hair and face, then filled with the frame itself.
  g.globalCompositeOperation = "destination-in";
  g.drawImage(occluder.skin, 0, 0, width, height);
  if (withHead) {
    g.globalCompositeOperation = "source-over";
    g.drawImage(occluder.head, 0, 0, width, height);
  }
  g.globalCompositeOperation = "source-in";
  g.drawImage(occluder.video, 0, 0, width, height);
  g.globalCompositeOperation = "source-over";
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(layer, 0, 0);
}

/**
 * The garment on the body, back to front: the torso; the wearer's hair, face, neck and arms (so
 * they show in front of it); the sleeves (so they cover the arms they are on); the hands (so they
 * come out of the cuffs). Without an occluder the garment simply covers the body.
 */
export function drawGarment(context: CanvasRenderingContext2D, garment: PreparedGarment, fit: Fit, occluder: Occluder | null) {
  for (const triangle of gridTriangles(garment.area, COLUMNS, ROWS, fit.torso)) drawTriangle(context, garment.torso, triangle);
  if (occluder) drawWearer(context, occluder, fit.skin.body, true);
  for (const sleeve of [fit.sleeves.left, fit.sleeves.right]) {
    for (const quad of sleeveQuads(sleeve, SLEEVE_COVER)) for (const triangle of quadTriangles(quad)) drawTriangle(context, garment.sleeves, triangle);
  }
  if (occluder && fit.skin.hands.length) drawWearer(context, occluder, fit.skin.hands, false);
  context.setTransform(1, 0, 0, 1, 0, 0);
}
