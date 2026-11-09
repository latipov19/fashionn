import { Cormorant, Geologica, Sofia_Sans_Extra_Condensed } from "next/font/google";

/*
 * Self-hosted by next/font. Latin and Latin Extended cover Uzbek, including oʻ and gʻ (U+02BB)
 * and the tutuq belgisi (U+02BC). Add the "cyrillic" subset together with the Russian locale.
 */

/** Body and UI, weights 300 to 700. Variable, so one file. */
export const geologica = Geologica({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-geologica" });

/** Display voice for DARK MODE, RAW ENERGY and the neutral pages. */
export const sofiaCondensed = Sofia_Sans_Extra_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["800", "900"],
  display: "swap",
  variable: "--font-sofia-condensed",
});

/** Display voice for SOFT SIGNAL only, so it is not preloaded on every page. */
export const cormorant = Cormorant({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  display: "swap",
  preload: false,
  variable: "--font-cormorant",
});
