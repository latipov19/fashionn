/** Every input crosses the server boundary through one of these schemas. */
import { z } from "zod";
import { commerce } from "@/content/commerce";
import { copy } from "@/content/copy";
import {
  COLLAR_STYLES,
  FRAME_CLASSES,
  HANG_MODES,
  HOURS,
  ROOMS,
  SEAM_PATHS,
  TEMPLATES,
} from "@/content/types";

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

export const addressSchema = z.object({
  fullName: required(120),
  line1: required(200),
  line2: optional(200),
  city: required(120),
  region: required(120),
  postalCode: required(20),
  country: required(80),
});

export const checkoutSchema = z.object({
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^$|^[0-9+()\-.\s]{5,30}$/, copy.forms.phone)
    .optional()
    .transform((value) => (value ? value : null)),
  address: addressSchema,
  shippingMethod: z.enum(commerce.shippingMethods.map((method) => method.id) as [string, ...string[]], {
    error: copy.forms.invalidChoice,
  }),
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

export const SORTS = ["peg", "name", "price-asc", "price-desc"] as const;
export type Sort = (typeof SORTS)[number];

const filterValue = z.string().trim().min(1).max(60).optional().catch(undefined);

export const catalogFiltersSchema = z.object({
  room: z.enum(ROOMS).optional().catch(undefined),
  type: filterValue,
  size: filterValue,
  colour: filterValue,
  sort: z.enum(SORTS).default("peg").catch("peg"),
});
export type CatalogFilters = z.input<typeof catalogFiltersSchema>;
export type ParsedCatalogFilters = z.output<typeof catalogFiltersSchema>;

/* Admin: pieces */

const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Enter a colour like #DAD2C2.");

export const cutSchema = z.object({
  template: z.enum(TEMPLATES),
  lengthCm: z.number().positive().max(400),
  bodyWidthCm: z.number().positive().max(400),
  spanCm: z.number().positive().max(400),
  sleeveDepthCm: z.number().min(0).max(200),
  neckWidthCm: z.number().min(0).max(100),
  neckDropCm: z.number().min(0).max(100),
});

export const detailSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("seam"), path: z.enum(SEAM_PATHS) }),
  z.object({ kind: z.literal("hem"), cm: z.number().positive().max(50) }),
  z.object({ kind: z.literal("placket"), widthCm: z.number().positive().max(50), lengthCm: z.number().positive().max(400).optional() }),
  z.object({ kind: z.literal("collar"), style: z.enum(COLLAR_STYLES) }),
  z.object({ kind: z.literal("button"), count: z.number().int().positive().max(50), diaMm: z.number().positive().max(100), hex: hexSchema }),
  z.object({
    kind: z.literal("pocket"),
    style: z.enum(["patch", "welt"]),
    xCm: z.number().min(0).max(200),
    yCm: z.number().min(0).max(400),
    wCm: z.number().positive().max(100),
    hCm: z.number().positive().max(100),
  }),
  z.object({ kind: z.literal("waistband"), heightCm: z.number().positive().max(30) }),
  z.object({ kind: z.literal("fly") }),
  z.object({ kind: z.literal("tie"), lengthCm: z.number().positive().max(400) }),
  z.object({ kind: z.literal("fringe"), cm: z.number().positive().max(50) }),
]);

const slugSchema = z
  .string()
  .trim()
  .min(1, copy.forms.required)
  .max(80, copy.forms.tooLong)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens.");

export const colourwayInputSchema = z.object({
  /** Keep the slug of an existing colourway to update it. A new slug adds one. */
  slug: slugSchema,
  name: required(60),
  hex: hexSchema,
  lining: hexSchema,
});

const pieceFields = z.object({
  peg: required(20),
  name: required(120),
  category: required(60),
  room: z.enum(ROOMS, { error: copy.forms.invalidChoice }),
  hour: z.enum(HOURS, { error: copy.forms.invalidChoice }),
  frameClass: z.enum(FRAME_CLASSES, { error: copy.forms.invalidChoice }),
  hang: z.enum(HANG_MODES, { error: copy.forms.invalidChoice }),
  priceCents: z.number({ error: copy.forms.required }).int().min(0).max(100_000_000),
  sizes: z
    .array(required(20))
    .min(1, copy.forms.required)
    .max(20)
    .refine((sizes) => new Set(sizes).size === sizes.length, "Each size can appear once."),
  colourways: z
    .array(colourwayInputSchema)
    .min(1, copy.forms.required)
    .max(20)
    .refine((list) => new Set(list.map((c) => c.slug)).size === list.length, "Each colourway needs its own slug."),
  clothId: required(80),
  description: required(2000),
  cut: cutSchema,
  gatherPct: z.number().min(0).max(30),
  seed: z.number().int().min(0).max(2_147_483_647),
  details: z.array(detailSchema).max(40),
  published: z.boolean(),
});

export const createPieceSchema = pieceFields.extend({
  slug: slugSchema,
  gatherPct: pieceFields.shape.gatherPct.default(5),
  seed: pieceFields.shape.seed.optional(),
  details: pieceFields.shape.details.default([]),
  /** New pieces stay hidden until the owner publishes them. */
  published: pieceFields.shape.published.default(false),
});
export type CreatePieceInput = z.input<typeof createPieceSchema>;

export const updatePieceSchema = pieceFields.partial().extend({ id: idSchema });
export type UpdatePieceInput = z.input<typeof updatePieceSchema>;

export const setPublishedSchema = z.object({ id: idSchema, published: z.boolean() });
export const reorderPiecesSchema = z.object({ ids: z.array(idSchema).min(1).max(500) });
export const setStockSchema = z.object({ variantId: idSchema, stock: z.number().int().min(0).max(100_000) });

/* Admin: media */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadMediaSchema = z.object({
  pieceId: idSchema,
  colourwayId: idSchema,
  /** Fractions of the image, from 0 to 1. */
  focalX: z.coerce.number().min(0).max(1).default(0.5),
  focalY: z.coerce.number().min(0).max(1).default(0.5),
  alt: required(300),
  hour: z.enum(HOURS).optional().catch(undefined),
});

/** Generated media ids are manifest keys, so this cannot be a uuid. */
const mediaIdSchema = z.string().min(1).max(200);

export const hideMediaSchema = z.object({
  colourwayId: idSchema,
  mediaId: mediaIdSchema,
  hidden: z.boolean(),
});

export const reorderMediaSchema = z.object({
  pieceId: idSchema,
  colourwayId: idSchema,
  orderedIds: z.array(mediaIdSchema).min(1).max(100),
});

export const revertMediaSchema = z.object({ pieceId: idSchema, colourwayId: idSchema });

/* Admin: orders */

export const orderStatusSchema = z.enum(["placed", "packed", "shipped", "delivered", "cancelled"]);
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
