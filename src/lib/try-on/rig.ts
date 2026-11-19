/*
 * Where a garment's body parts sit inside its packshot: the shoulder and hem corners of the torso,
 * and each sleeve's axis from shoulder to cuff. Coordinates are fractions of the image, and
 * "left" means the left of the image, which is the wearer's right when the garment faces us,
 * exactly as a person facing the camera appears in an unmirrored frame.
 *
 * Every AI packshot comes through `npm run assets:import`, which frames the garment the same way
 * (about 7 to 93 % of the width), so one rig per garment type fits all packshots of that type.
 * The values were read off the packshots on a 5 % grid on 2026-11-20. A sleeve axis runs through
 * the middle of the sleeve, from the shoulder seam to the bottom of the cuff.
 */

export type Point = { x: number; y: number };

export type SleeveRig = {
  shoulder: Point;
  /** Long sleeves bend at the elbow; a short sleeve has none. */
  elbow: Point | null;
  /** The cuff's centre, or the end of a short sleeve. */
  end: Point;
  /** Half the sleeve's width, as a fraction of the image width. */
  halfWidth: number;
};

export type GarmentRig = {
  /** The top of the hood or collar. */
  top: number;
  torso: { shoulderLeft: Point; shoulderRight: Point; hemLeft: Point; hemRight: Point };
  sleeves: { left: SleeveRig; right: SleeveRig };
  /** Where the hem falls along the body, from the shoulder line (0) to the hip joints (1). */
  hemAt: number;
  /** The bottom of the front neckline at the centre: the wearer's neck shows above it, never below. */
  neckline: number;
};

const mirror = (sleeve: SleeveRig): SleeveRig => ({
  shoulder: { x: 1 - sleeve.shoulder.x, y: sleeve.shoulder.y },
  elbow: sleeve.elbow ? { x: 1 - sleeve.elbow.x, y: sleeve.elbow.y } : null,
  end: { x: 1 - sleeve.end.x, y: sleeve.end.y },
  halfWidth: sleeve.halfWidth,
});

const symmetric = (rig: Omit<GarmentRig, "sleeves"> & { sleeve: SleeveRig }): GarmentRig => {
  const { sleeve, ...rest } = rig;
  return { ...rest, sleeves: { left: sleeve, right: mirror(sleeve) } };
};

/** A hoodie with dropped shoulders, sleeves hanging along the body. */
const hoodie = symmetric({
  top: 0.13,
  neckline: 0.28,
  torso: { shoulderLeft: { x: 0.26, y: 0.27 }, shoulderRight: { x: 0.74, y: 0.27 }, hemLeft: { x: 0.28, y: 0.84 }, hemRight: { x: 0.72, y: 0.84 } },
  sleeve: { shoulder: { x: 0.21, y: 0.33 }, elbow: { x: 0.17, y: 0.57 }, end: { x: 0.14, y: 0.86 }, halfWidth: 0.07 },
  hemAt: 1.05,
});

/** A jacket cut at the waist, sleeves hanging along the body. */
const jacket = symmetric({
  top: 0.15,
  neckline: 0.29,
  torso: { shoulderLeft: { x: 0.27, y: 0.24 }, shoulderRight: { x: 0.73, y: 0.24 }, hemLeft: { x: 0.275, y: 0.77 }, hemRight: { x: 0.725, y: 0.77 } },
  sleeve: { shoulder: { x: 0.2, y: 0.35 }, elbow: { x: 0.16, y: 0.58 }, end: { x: 0.185, y: 0.85 }, halfWidth: 0.08 },
  hemAt: 0.92,
});

/** A boxy T-shirt with dropped shoulders, short wide sleeves spread out. */
const tee = symmetric({
  top: 0.14,
  neckline: 0.2,
  torso: { shoulderLeft: { x: 0.25, y: 0.2 }, shoulderRight: { x: 0.75, y: 0.2 }, hemLeft: { x: 0.25, y: 0.86 }, hemRight: { x: 0.75, y: 0.86 } },
  sleeve: { shoulder: { x: 0.235, y: 0.27 }, elbow: null, end: { x: 0.16, y: 0.51 }, halfWidth: 0.098 },
  hemAt: 1.05,
});

const BY_CATEGORY: Record<string, GarmentRig> = {
  hudi: hoodie,
  kurtka: jacket,
  palto: { ...jacket, hemAt: 1.35 },
  futbolka: tee,
  "koʻylak": jacket,
};

/** The rig for a catalogue category; a jacket's when the category is unknown, the most neutral long-sleeved cut. */
export function rigForCategory(category: string): GarmentRig {
  return BY_CATEGORY[category.trim().toLowerCase()] ?? jacket;
}
