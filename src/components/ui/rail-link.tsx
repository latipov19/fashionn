import Link from "next/link";
import type { ComponentProps } from "react";

export type RailLinkProps = ComponentProps<typeof Link> & {
  /** Keep the underline at rest. Use this for links inside running text. */
  underlined?: boolean;
};

/** A link with a 1 px underline in currentColor that draws from the left on hover. */
export function RailLink({ underlined, className, ...rest }: RailLinkProps) {
  return (
    <Link
      {...rest}
      className={className ? `rail-link ${className}` : "rail-link"}
      data-underlined={underlined || undefined}
    />
  );
}
