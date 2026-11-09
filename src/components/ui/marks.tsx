import type { ComponentProps } from "react";
import { brand } from "@/content/copy";

const RAYS = 16;

/** The small mark: sixteen pleats around an open centre, the Sunray Portal at icon size. */
export function SunrayMark({ className, ...rest }: ComponentProps<"svg">) {
  const step = (Math.PI * 2) / RAYS;
  const point = (r: number, a: number) => `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 - r * Math.sin(a)).toFixed(2)}`;
  return (
    <svg {...rest} className={className} viewBox="0 0 24 24" aria-hidden="true">
      {Array.from({ length: RAYS }, (_, i) => {
        const a = i * step;
        return (
          <path
            key={i}
            d={`M${point(5, a - step * 0.32)}L${point(11.5, a - step * 0.46)}L${point(11.5, a + step * 0.12)}L${point(5, a + step * 0.08)}Z`}
            fill="currentColor"
            opacity={i % 2 === 0 ? 1 : 0.45}
          />
        );
      })}
    </svg>
  );
}

/** Typographic wordmark. The name is still a working name, so it stays live text. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className ? `wordmark ${className}` : "wordmark"}>
      <SunrayMark />
      {brand.name}
    </span>
  );
}
