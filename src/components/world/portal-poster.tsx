import type { PortalLook } from "@/content/worlds";
import { BLADES_DESKTOP, bladeLayout, faceLight } from "@/lib/portal";

const xy = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(4)} ${(-r * Math.sin(a)).toFixed(4)}`;

/**
 * The Sunray Portal drawn as SVG from the same blade maths as the 3D scene. Colours are CSS
 * tokens, so it changes world with the page. Shown before the 3D loads, and instead of it with
 * no WebGL, after context loss, under reduced motion and in light mode.
 */
export function PortalPoster({ look, count = BLADES_DESKTOP, className }: { look: PortalLook; count?: number; className?: string }) {
  const blades = bladeLayout(count, look);

  return (
    <svg className={className} viewBox="-1 -1 2 2" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="portal-depth" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse">
          <stop offset="0.55" stopColor="#000" stopOpacity="0.38" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.08" />
          <stop offset="0.95" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {blades.map((blade, i) => {
        const a0 = blade.angle - blade.halfWidth;
        const a1 = blade.angle + blade.halfWidth;
        const d = `M${xy(blade.inner, a0)}L${xy(blade.outer, a0)}L${xy(blade.outer, a1)}L${xy(blade.inner, a1)}Z`;
        // Rounded: Node and the browser can differ in the last digit of Math.sin, and the poster
        // is server rendered, so unrounded values would not hydrate.
        const light = faceLight(blade.angle, blade.lean);
        return (
          <g key={i}>
            <path d={d} fill="var(--portal-blade)" />
            <path d={d} fill={light > 0 ? "var(--portal-hi)" : "var(--portal-lo)"} fillOpacity={Math.round(Math.min(1, Math.abs(light) * 1.6) * 1000) / 1000} />
          </g>
        );
      })}
      <circle r="0.98" fill="url(#portal-depth)" />
    </svg>
  );
}
