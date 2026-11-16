/** Every input crosses the server boundary through one of these schemas. */
import { z } from "zod";
import { commerce, regionIds } from "@/content/commerce";
import { copy } from "@/content/copy";
import { SLOTS, WORLD_SLUGS } from "@/content/types";
import type { StockReason } from "./admin-constants";
import { MAX_UPLOAD_BYTES, STOCK_REASONS } from "./admin-constants";
import { ADMIN_ROLES } from "./admin-roles";
import { isRepeatedCharacter, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "./password-rules";

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

const registerText = copy.account.register;

const newPasswordSchema = z
  .string({ error: copy.forms.required })
  .min(1, copy.forms.required)
  .min(PASSWORD_MIN, registerText.passwordShort(PASSWORD_MIN))
  .max(PASSWORD_MAX, copy.forms.tooLong)
  .refine((password) => !isRepeatedCharacter(password), registerText.passwordWeak);

/**
 * Registration. Only these four fields are read, so nothing else a client sends (a role, an id,
 * a hash) can reach the database. The confirmation is compared here and then dropped: it is
 * never stored.
 */
export const registerSchema = z
  .object({
    name: required(NAME_MAX)
      .transform((name) => name.replace(/\s+/g, " "))
      .refine((name) => !/[\u0000-\u001f\u007f]/.test(name), registerText.nameInvalid),
    email: emailSchema,
    password: newPasswordSchema,
    confirm: z.string({ error: copy.forms.required }).min(1, copy.forms.required),
  })
  .superRefine((value, context) => {
    if (value.password.toLowerCase() === value.email) context.addIssue({ code: "custom", path: ["password"], message: registerText.passwordWeak });
    if (value.confirm !== value.password) context.addIssue({ code: "custom", path: ["confirm"], message: registerText.mismatch });
  })
  .transform(({ name, email, password }) => ({ name, email, password }));

/** What the form sends: the four fields, confirmation included. */
export type RegisterFields = z.input<typeof registerSchema>;

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

export { MAX_UPLOAD_BYTES };

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

/* Admin: control center */

const adminText = copy.admin;

/** Products touched by one bulk action. Kept small so one click never rewrites the whole catalogue. */
export const bulkProductsSchema = z.object({
  ids: z.array(idSchema).min(1, adminText.products.bulk.none).max(100),
  op: z.enum(["publish", "unpublish", "archive"]),
});

export const productIdSchema = z.object({ id: idSchema });
export const deleteProductSchema = z.object({ id: idSchema, confirm: z.string().max(80) });

export { STOCK_REASONS };
export type { StockReason };

export const adjustStockSchema = z.object({
  variantId: idSchema,
  stock: z.number({ error: copy.forms.required }).int().min(0).max(100_000),
  reason: z.enum(STOCK_REASONS, { error: copy.forms.invalidChoice }),
  note: optional(200),
});

export const renameCategorySchema = z
  .object({ from: required(60), to: required(60).transform((name) => name.replace(/\s+/g, " ")) })
  .refine((value) => value.from !== value.to, { error: adminText.errors.sameCategory, path: ["to"] });

export const customerIdSchema = z.object({ customerId: idSchema });

const dateInput = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((value, context) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: "custom", message: copy.forms.invalidChoice });
      return z.NEVER;
    }
    return date;
  });

/** Promo codes. The discount is stored here and, once checkout exists, computed from this row only. */
export const promotionSchema = z
  .object({
    id: idSchema.optional(),
    code: z
      .string({ error: copy.forms.required })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{3,24}$/, adminText.promotions.fields.codeHint),
    kind: z.enum(["percent", "fixed"], { error: copy.forms.invalidChoice }),
    value: z.number({ error: copy.forms.required }).int().min(1).max(100_000_000),
    minOrderUzs: z.number().int().min(0).max(100_000_000).default(0),
    startsAt: dateInput,
    endsAt: dateInput,
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().default(null),
    active: z.boolean().default(true),
    note: optional(200),
  })
  .superRefine((value, context) => {
    if (value.kind === "percent" && value.value > 90) context.addIssue({ code: "custom", path: ["value"], message: adminText.promotions.fields.valueHint });
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) context.addIssue({ code: "custom", path: ["endsAt"], message: copy.forms.invalidChoice });
  });
export type PromotionInput = z.input<typeof promotionSchema>;

export const promotionIdSchema = z.object({ id: idSchema });

/** Staff passwords are longer than shoppers': they open the whole store. */
export const STAFF_PASSWORD_MIN = 12;
const staffPassword = z
  .string({ error: copy.forms.required })
  .min(STAFF_PASSWORD_MIN, adminText.settings.passwordShort)
  .max(256, copy.forms.tooLong);

export const createAdminUserSchema = z.object({
  email: emailSchema,
  role: z.enum(ADMIN_ROLES, { error: copy.forms.invalidChoice }),
  password: staffPassword,
});
export const setAdminRoleSchema = z.object({ id: idSchema, role: z.enum(ADMIN_ROLES, { error: copy.forms.invalidChoice }) });
export const adminUserIdSchema = z.object({ id: idSchema });

export const changePasswordSchema = z
  .object({ current: z.string().min(1, copy.forms.required).max(512), next: staffPassword, confirm: z.string().min(1, copy.forms.required) })
  .refine((value) => value.next === value.confirm, { error: adminText.settings.mismatch, path: ["confirm"] });

/** Field errors keyed by dotted path, for `Field` error props. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
