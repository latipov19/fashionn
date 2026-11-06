/** Every input crosses the server boundary through one of these schemas. */
import { z } from "zod";
import { commerce, regionIds } from "@/content/commerce";
import { copy } from "@/content/copy";
import { SLOTS, WORLD_SLUGS } from "@/content/types";

const required = (max: number) =>
  z
    .string({ error: copy.forms.required })
    .trim()
    .min(1, copy.forms.required)
    .max(max, copy.forms.tooLong);

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, copy.forms.tooLong)
    .optional()
    .transform((value) => (value ? value : null));

export const emailSchema = z
  .string({ error: copy.forms.email })
  .trim()
  .toLowerCase()
  .max(254, copy.forms.tooLong)
  .pipe(z.email(copy.forms.email));

export const idSchema = z.uuid();

/** Accepts `+998 90 123-45-67`, `998901234567` and `901234567`. Stores `+998901234567`. */
export const phoneSchema = z
  .string({ error: copy.forms.phone })
  .transform((value) => value.replace(/[\s()\-.]/g, ""))
  .pipe(z.string().regex(/^(?:\+?998)?\d{9}$/, copy.forms.phone))
  .transform((value) => `+998${value.slice(-9)}`);

/* Cart */

export const quantitySchema = z.coerce
  .number({ error: copy.forms.quantity })
  .int(copy.forms.quantity)
  .min(1, copy.forms.quantity)
  .max(commerce.maxLineQuantity, copy.forms.quantity);

export const cartLineSchema = z.object({ variantId: idSchema, quantity: quantitySchema });
export type CartLine = z.infer<typeof cartLineSchema>;

export const addToCartSchema = z.object({ variantId: idSchema, quantity: quantitySchema.default(1) });

export const updateCartLineSchema = z.object({
  variantId: idSchema,
  quantity: z.coerce.number().int().min(0).max(commerce.maxLineQuantity),
});

export const removeCartLineSchema = z.object({ variantId: idSchema });

/* Checkout */

export const checkoutSchema = z.object({
  customerName: required(120),
  phone: phoneSchema,
  email: z
    .union([z.literal(""), emailSchema])
    .optional()
    .transform((value) => (value ? value : null)),
  region: z.enum(regionIds, { error: copy.forms.invalidChoice }),
  city: required(120),
  addressLine: required(300),
  notes: optional(500),
  /** One per checkout page load, so a double submit lands on the same order. */
  idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutDetails = z.output<typeof checkoutSchema>;

/** Only variant ids and quantities are read. Any price field a client adds is dropped here. */
export const placeOrderSchema = checkoutSchema.extend({
  lines: z.array(cartLineSchema).max(commerce.maxCartLines),
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

export const orderTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);

/* Accounts */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, copy.forms.required).max(512, copy.forms.tooLong),
});

export const newsletterSchema = z.object({ email: emailSchema });

/* Catalog filters. Bad values are dropped, so a stale URL still shows a page. */

export const SORTS = ["featured", "newest", "price-asc", "price-desc", "name"] as const;
export type Sort = (typeof SORTS)[number];

const filterValue = z.string().trim().min(1).max(60).optional().catch(undefined);

/** A blank field in a GET form means "no limit", never zero. */
const priceBound = z.preprocess(
  (value) => (typeof value === "string" ? value.replace(/[\s ]/g, "") || undefined : value),
  z.coerce.number().int().min(0).max(2_000_000_000).optional().catch(undefined),
);

export const catalogFiltersSchema = z.object({
  q: z.string().trim().min(1).max(80).optional().catch(undefined),
  world: z.enum(WORLD_SLUGS).optional().catch(undefined),
  category: filterValue,
  size: filterValue,
  color: filterValue,
  min: priceBound,
  max: priceBound,
  sort: z.enum(SORTS).default("featured").catch("featured"),
});
export type CatalogFilters = z.input<typeof catalogFiltersSchema>;
export type ParsedCatalogFilters = z.output<typeof catalogFiltersSchema>;

/* Admin: products */

const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Rangni #1C1C20 koʻrinishida kiriting.");

const handleSchema = z
  .string()
  .trim()
  .min(1, copy.forms.required)
  .max(80, copy.forms.tooLong)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Faqat kichik lotin harflari, raqam va chiziqcha.");

export const colorInputSchema = z.object({
  /** Keep the slug of an existing colour to update it. A new slug adds one. */
  slug: handleSchema,
  name: required(60),
  hex: hexSchema,
});

export const sizeChartSchema = z.object({
  columns: z.array(required(40)).max(12),
  rows: z.array(z.array(z.string().trim().max(40)).min(1).max(12)).max(40),
});

const priceSchema = z.number({ error: copy.forms.required }).int().min(0).max(100_000_000);

const productFields = z.object({
  name: required(120),
  category: required(60),
  slot: z.enum(SLOTS, { error: copy.forms.invalidChoice }),
  worlds: z
    .array(z.enum(WORLD_SLUGS, { error: copy.forms.invalidChoice }))
    .max(WORLD_SLUGS.length)
    .refine((list) => new Set(list).size === list.length, copy.forms.invalidChoice),
  priceUzs: priceSchema,
  compareAtUzs: priceSchema.nullable(),
  sizes: z
    .array(required(20))
    .min(1, copy.forms.required)
    .max(20)
    .refine((sizes) => new Set(sizes).size === sizes.length, "Har bir oʻlcham bir marta boʻlsin."),
  colors: z
    .array(colorInputSchema)
    .min(1, copy.forms.required)
    .max(20)
    .refine((list) => new Set(list.map((c) => c.slug)).size === list.length, "Har bir rang alohida slug bilan boʻlsin."),
  description: required(2000),
  fabric: required(300),
  fit: required(300),
  care: required(300),
  sizeChart: sizeChartSchema,
  isDemo: z.boolean(),
  published: z.boolean(),
});

const compareAtAbovePrice = (value: { priceUzs?: number; compareAtUzs?: number | null }) =>
  value.compareAtUzs == null || value.priceUzs === undefined || value.compareAtUzs > value.priceUzs;

const compareAtIssue = { error: copy.admin.errors.compareAtTooLow, path: ["compareAtUzs"] };

export const createProductSchema = productFields
  .extend({
    handle: handleSchema,
    compareAtUzs: productFields.shape.compareAtUzs.default(null),
    sizeChart: productFields.shape.sizeChart.default({ columns: [], rows: [] }),
    worlds: productFields.shape.worlds.default([]),
    /** A product added by the owner is real unless they say otherwise. */
    isDemo: productFields.shape.isDemo.default(false),
    /** New products stay hidden until the owner publishes them. */
    published: productFields.shape.published.default(false),
  })
  .refine(compareAtAbovePrice, compareAtIssue);
export type CreateProductInput = z.input<typeof createProductSchema>;

export const updateProductSchema = productFields
  .partial()
  .extend({ id: idSchema })
  .refine(compareAtAbovePrice, compareAtIssue);
export type UpdateProductInput = z.input<typeof updateProductSchema>;

export const setPublishedSchema = z.object({ id: idSchema, published: z.boolean() });
export const reorderProductsSchema = z.object({ ids: z.array(idSchema).min(1).max(500) });
export const setStockSchema = z.object({ variantId: idSchema, stock: z.number().int().min(0).max(100_000) });

/* Admin: media */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadMediaSchema = z.object({
  productId: idSchema,
  colorId: idSchema,
  /** Fractions of the image, from 0 to 1. */
  focalX: z.coerce.number().min(0).max(1).default(0.5),
  focalY: z.coerce.number().min(0).max(1).default(0.5),
  alt: required(300),
});

/** Generated media ids are manifest keys, so this cannot be a uuid. */
const mediaIdSchema = z.string().min(1).max(200);

export const hideMediaSchema = z.object({
  colorId: idSchema,
  mediaId: mediaIdSchema,
  hidden: z.boolean(),
});

export const reorderMediaSchema = z.object({
  productId: idSchema,
  colorId: idSchema,
  orderedIds: z.array(mediaIdSchema).min(1).max(100),
});

export const revertMediaSchema = z.object({ productId: idSchema, colorId: idSchema });

/* Admin: orders */

export const orderStatusSchema = z.enum(["pending", "confirmed", "packed", "shipped", "delivered", "canceled", "returned"]);
export const setOrderStatusSchema = z.object({ orderId: idSchema, status: orderStatusSchema });

/** Field errors keyed by dotted path, for `Field` error props. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
