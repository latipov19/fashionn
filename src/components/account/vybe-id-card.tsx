import { SunrayMark } from "@/components/ui/marks";
import { brand, copy } from "@/content/copy";
import type { World } from "@/content/worlds";
import { worldList } from "@/content/worlds";
import { VybeTilt } from "./vybe-tilt";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * VYBE ID: the shopper's pass into a world, standing on the sign-in page where the portal stands
 * on the home page. Its face is cut from the world's own pleat material (the portal blade
 * tokens), so it changes with the world but stays one object. Decorative: the world it names is
 * also stated in text beside it, so the whole artifact is hidden from assistive technology.
 */
export function VybeIdCard({ world }: { world: World }) {
  const text = copy.account.login.card;

  return (
    <div className="vybe-artifact" aria-hidden="true">
      <VybeTilt>
        <div className="vybe-halo">
          <span className="vybe-halo-glow" />
          <span className="vybe-halo-ring" />
          <SunrayMark className="vybe-halo-rays" />
        </div>
        <div className="vybe-float">
          <div className="vybe-card">
            <span className="vybe-pleats" />
            <span className="vybe-sheen" />
            <div className="vybe-top">
              <span className="vybe-brand">
                <SunrayMark />
                {brand.name}
              </span>
              <span className="vybe-tag">{text.id}</span>
            </div>
            <div className="vybe-emblem">
              <SunrayMark />
            </div>
            <div className="vybe-bottom">
              <span className="vybe-micro">{text.access}</span>
              <span className="vybe-world">
                <span className="t-slant">{world.name}</span>
              </span>
              <span className="vybe-rule" />
              <span className="vybe-meta">
                <span>
                  {text.world} {world.index}/{pad(worldList.length)}
                </span>
                <span>N° {world.index.padStart(3, "0")}</span>
              </span>
              <span className="vybe-micro">{text.motto}</span>
            </div>
          </div>
        </div>
        <span className="vybe-floor" />
      </VybeTilt>
    </div>
  );
}
