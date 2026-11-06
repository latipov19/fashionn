/** Colourway-to-wall separation from brief section 9.6: CIE76 delta E >= 30, delta L* >= 12. */

export const MIN_DELTA_E = 30;
export const MIN_DELTA_L = 12;

type Lab = { l: number; a: number; b: number };

function hexToLab(hex: string): Lab {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const linear = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const [r, g, b] = linear;
  // sRGB to XYZ, D65 white.
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  return { l: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

export type Separation = { deltaE: number; deltaL: number; passes: boolean };

export function separation(colourHex: string, wallHex: string): Separation {
  const c = hexToLab(colourHex);
  const w = hexToLab(wallHex);
  const deltaE = Math.hypot(c.l - w.l, c.a - w.a, c.b - w.b);
  const deltaL = Math.abs(c.l - w.l);
  return { deltaE, deltaL, passes: deltaE >= MIN_DELTA_E && deltaL >= MIN_DELTA_L };
}
