import type { ComponentProps, ElementType, ReactNode } from "react";
import { copy } from "@/content/copy";

export type PlacardProps = Omit<ComponentProps<"div">, "children"> & {
  /** Peg number or a label such as `Room I, morning`. */
  peg?: ReactNode;
  name?: ReactNode;
  /** Heading level for the name, so the outline stays correct where the placard is used. */
  nameAs?: ElementType;
  clothLine?: ReactNode;
  price?: ReactNode;
  soldOut?: boolean;
  /** Links, buttons or body text, placed last. */
  children?: ReactNode;
};

/** Opaque `raised` plate. This is the only place text sits next to a garment. */
export function Placard({ peg, name, nameAs: Name = "h3", clothLine, price, soldOut, children, className, ...rest }: PlacardProps) {
  return (
    <div {...rest} data-ground="raised" className={className ? `placard ${className}` : "placard"}>
      {peg != null && <p className="t-label t-secondary">{peg}</p>}
      {name != null && <Name className="t-display-m">{name}</Name>}
      {clothLine != null && <p className="t-small">{clothLine}</p>}
      {price != null && <p className="t-price">{price}</p>}
      {soldOut && <p className="t-label">{copy.micro.soldOut}</p>}
      {children}
    </div>
  );
}
