import type { Slot } from "@/content/types";

/** A look is dressed in this order, one piece per slot. */
export const LOOK_ORDER: readonly Slot[] = ["outerwear", "top", "bottom", "shoes", "accessory"];

/** The first piece of each slot in the world's curated order. Shared by the home page and tools/assets. */
export function pickLook<T extends { slot: Slot }>(shelf: readonly T[]): T[] {
  return LOOK_ORDER.flatMap((slot) => {
    const piece = shelf.find((candidate) => candidate.slot === slot);
    return piece ? [piece] : [];
  });
}
