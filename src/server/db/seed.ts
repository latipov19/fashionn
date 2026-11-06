import { eq, sql } from "drizzle-orm";
import { demoCatalog, demoStock } from "../../content/catalog.demo";
import { hashPassword } from "../password";
import type { Db } from "./client";
import { adminUsers, productColors, products, productWorlds, variants } from "./schema";

export function makeSku(productHandle: string, colorSlug: string, size: string): string {
  return `${productHandle}-${colorSlug}-${size}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
}

/** Inserts the whole demo catalog in one transaction, so a failed seed leaves nothing behind. */
export async function seedCatalog(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    const worldPositions = new Map<string, number>();

    for (const [index, product] of demoCatalog.entries()) {
      const { colors, worlds, silhouette: _silhouette, ...fields } = product;
      const [row] = await tx
        .insert(products)
        .values({ ...fields, isDemo: true, sortOrder: index })
        .returning({ id: products.id });
      if (!row) throw new Error(`Could not seed ${product.handle}`);

      for (const world of worlds) {
        const position = worldPositions.get(world) ?? 0;
        worldPositions.set(world, position + 1);
        await tx.insert(productWorlds).values({ productId: row.id, world, position });
      }

      for (const [position, color] of colors.entries()) {
        const [colorRow] = await tx
          .insert(productColors)
          .values({ productId: row.id, slug: color.slug, name: color.name, hex: color.hex, position })
          .returning({ id: productColors.id });
        if (!colorRow) throw new Error(`Could not seed ${product.handle}/${color.slug}`);

        await tx.insert(variants).values(
          product.sizes.map((size) => ({
            productId: row.id,
            colorId: colorRow.id,
            size,
            stock: demoStock(product.handle, color.slug, size),
            sku: makeSku(product.handle, color.slug, size),
          })),
        );
      }
    }
  });
}

/** Creates the first admin from the environment. An existing account is left alone. */
export async function ensureAdminUser(db: Db): Promise<boolean> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return false;

  const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (existing) return false;

  const passwordHash = await hashPassword(password);
  await db.insert(adminUsers).values({ email, passwordHash }).onConflictDoNothing();
  return true;
}

/** Runs on every boot. An empty `products` table seeds itself. */
export async function ensureSeeded(db: Db): Promise<void> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(products);
  if (!row || row.count === 0) await seedCatalog(db);
  await ensureAdminUser(db);
}
