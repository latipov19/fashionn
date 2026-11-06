import type { Cloth } from "./types";

/**
 * Brief section 13.2. Every value is a placeholder until the client confirms it.
 * Fibre statements carry legal weight.
 */
export const cloths: Cloth[] = [
  {
    id: "wool-twill-540",
    label: "Heavy wool twill",
    weave: "twill22",
    composition: "90% wool, 10% cashmere",
    gsm: 540,
    warpPerCm: 14,
    weftPerCm: 12,
    bend: 0.82,
    roughness: 0.78,
    sheen: 0.45,
    fuzz: 0.55,
    wrap: 0.2
  },
  {
    id: "wool-herringbone-430",
    label: "Wool herringbone",
    weave: "herringbone",
    composition: "100% wool",
    gsm: 430,
    warpPerCm: 16,
    weftPerCm: 13,
    bend: 0.7,
    roughness: 0.8,
    sheen: 0.35,
    fuzz: 0.45,
    wrap: 0.18
  },
  {
    id: "wool-hopsack-380",
    label: "Wool hopsack",
    weave: "hopsack",
    composition: "100% wool",
    gsm: 380,
    warpPerCm: 12,
    weftPerCm: 12,
    bend: 0.6,
    roughness: 0.82,
    sheen: 0.35,
    fuzz: 0.5,
    wrap: 0.22
  },
  {
    id: "cotton-canvas-340",
    label: "Cotton canvas",
    weave: "plain",
    composition: "100% cotton",
    gsm: 340,
    warpPerCm: 18,
    weftPerCm: 14,
    bend: 0.74,
    roughness: 0.85,
    sheen: 0.1,
    fuzz: 0.15,
    wrap: 0.14
  },
  {
    id: "linen-twill-260",
    label: "Linen twill",
    weave: "twill22",
    composition: "100% linen",
    gsm: 260,
    warpPerCm: 22,
    weftPerCm: 18,
    bend: 0.52,
    roughness: 0.8,
    sheen: 0.18,
    fuzz: 0.25,
    wrap: 0.22
  },
  {
    id: "wool-gabardine-280",
    label: "Wool gabardine",
    weave: "twill22",
    composition: "100% wool",
    gsm: 280,
    warpPerCm: 34,
    weftPerCm: 24,
    bend: 0.46,
    roughness: 0.62,
    sheen: 0.3,
    fuzz: 0.1,
    wrap: 0.18
  },
  {
    id: "linen-plain-190",
    label: "Linen plain weave",
    weave: "plain",
    composition: "100% linen",
    gsm: 190,
    warpPerCm: 20,
    weftPerCm: 18,
    bend: 0.38,
    roughness: 0.84,
    sheen: 0.12,
    fuzz: 0.28,
    wrap: 0.28
  },
  {
    id: "cotton-poplin-120",
    label: "Cotton poplin",
    weave: "plain",
    composition: "100% cotton",
    gsm: 120,
    warpPerCm: 48,
    weftPerCm: 26,
    bend: 0.22,
    roughness: 0.7,
    sheen: 0.14,
    fuzz: 0.05,
    wrap: 0.32
  },
  {
    id: "silk-satin-210",
    label: "Silk satin",
    weave: "satin5",
    composition: "100% silk",
    gsm: 210,
    warpPerCm: 60,
    weftPerCm: 34,
    bend: 0.2,
    roughness: 0.32,
    sheen: 0.7,
    fuzz: 0.02,
    wrap: 0.3
  },
  {
    id: "silk-wool-twill-110",
    label: "Silk wool twill",
    weave: "twill22",
    composition: "70% wool, 30% silk",
    gsm: 110,
    warpPerCm: 42,
    weftPerCm: 34,
    bend: 0.12,
    roughness: 0.55,
    sheen: 0.5,
    fuzz: 0.12,
    wrap: 0.4
  }
];

export function clothById(id: string): Cloth | undefined {
  return cloths.find((cloth) => cloth.id === id);
}
