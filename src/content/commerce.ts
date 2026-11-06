/**
 * Store settings. Every delivery price is a placeholder until the owner confirms it, and the
 * checkout says so. Stage 2 moves zones into the database so the owner can edit them.
 */
export const commerce = {
  currency: "UZS",
  maxCartLines: 20,
  maxLineQuantity: 10,
  /** Variants at or under this count show the remaining number. */
  lowStockAt: 2,
  deliveryZones: [
    { id: "tashkent", label: "Toshkent shahri", priceUzs: 30_000 },
    { id: "regions", label: "Viloyatlar", priceUzs: 50_000 },
  ],
  regions: [
    { id: "toshkent-shahri", label: "Toshkent shahri", zone: "tashkent" },
    { id: "toshkent-viloyati", label: "Toshkent viloyati", zone: "regions" },
    { id: "andijon", label: "Andijon viloyati", zone: "regions" },
    { id: "buxoro", label: "Buxoro viloyati", zone: "regions" },
    { id: "fargona", label: "Fargʻona viloyati", zone: "regions" },
    { id: "jizzax", label: "Jizzax viloyati", zone: "regions" },
    { id: "xorazm", label: "Xorazm viloyati", zone: "regions" },
    { id: "namangan", label: "Namangan viloyati", zone: "regions" },
    { id: "navoiy", label: "Navoiy viloyati", zone: "regions" },
    { id: "qashqadaryo", label: "Qashqadaryo viloyati", zone: "regions" },
    { id: "qoraqalpogiston", label: "Qoraqalpogʻiston Respublikasi", zone: "regions" },
    { id: "samarqand", label: "Samarqand viloyati", zone: "regions" },
    { id: "sirdaryo", label: "Sirdaryo viloyati", zone: "regions" },
    { id: "surxondaryo", label: "Surxondaryo viloyati", zone: "regions" },
  ],
} as const;

export type RegionId = (typeof commerce.regions)[number]["id"];
export type DeliveryZoneId = (typeof commerce.deliveryZones)[number]["id"];

export const regionIds = commerce.regions.map((region) => region.id) as [RegionId, ...RegionId[]];

export function regionById(id: string) {
  return commerce.regions.find((region) => region.id === id);
}

/** The delivery zone for a region, or undefined when the region is unknown. */
export function deliveryForRegion(regionId: string) {
  const region = regionById(regionId);
  return region && commerce.deliveryZones.find((zone) => zone.id === region.zone);
}
