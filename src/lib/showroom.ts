/**
 * Signed distance from the chosen item, the short way round a list of `count`. Returns a value
 * in [-count / 2, count / 2). Shared by the 3D Showroom and its DOM poster, so both place
 * products in the same order.
 */
export function wrapOffset(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((((value + count / 2) % count) + count) % count) - count / 2;
}

const TAU = Math.PI * 2;

/** How far a model tilts toward the viewer, radians: a look from above (about 26°)... */
export const PITCH_MAX = 0.45;
/** ...and from below (about 17°). Garments are made to be seen from the front and a little above. */
export const PITCH_MIN = -0.3;

/** A vertical drag's tilt, held within what still frames the whole product. */
export function clampPitch(value: number): number {
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, value));
}

/** The front-facing turn nearest to `spin`, so a model returns to its front the short way round. */
export function frontOf(spin: number): number {
  return Math.round(spin / TAU) * TAU;
}

/** Whether item `index` stands within `reach` places of the chosen item, where its GLB is worth loading. */
export function withinReach(index: number, target: number, count: number, reach: number): boolean {
  return Math.abs(Math.round(wrapOffset(index - target, count))) <= reach;
}
