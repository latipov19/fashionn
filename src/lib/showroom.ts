/**
 * Signed distance from the chosen item, the short way round a list of `count`. Returns a value
 * in [-count / 2, count / 2). Shared by the 3D Showroom and its DOM poster, so both place
 * products in the same order.
 */
export function wrapOffset(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((((value + count / 2) % count) + count) % count) - count / 2;
}
