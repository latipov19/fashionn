import { eq, sql } from "drizzle-orm";
import { cloths as clothContent } from "../../content/cloths";
import { commerce } from "../../content/commerce";
import { pieces as pieceContent } from "../../content/pieces";
import { roomMeta } from "../../content/rooms";
import { separation } from "../../lib/colour";
import { usdToCents } from "../../lib/money";
import { hashPassword } from "../password";
import type { Db } from "./client";
import { adminUsers, cloths, colourways, pieces, variants } from "./schema";

export function makeSku(pieceSlug: string, colourwaySlug: string, size: string): string {
  return `${pieceSlug}-${colourwaySlug}-${size}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
}

/** Brief 9.6: the seed script enforces colourway-to-wall separation. */
function assertSeparation() {
  for (const piece of pieceContent) {
    for (const colourway of piece.colourways) {
      const result = separation(colourway.hex, roomMeta[piece.room].pigment);
      if (!result.passes) {
        throw new Error(
          `${piece.name} in ${colourway.name} is too close to its wall: ` +
            `delta E ${result.deltaE.toFixed(1)}, delta L ${result.deltaL.toFixed(1)}`,
        );
      }
    }
  }
}

/** Inserts the whole catalog in one transaction, so a failed seed leaves nothing behind. */
export async function seedCatalog(db: Db): Promise<void> {
  assertSeparation();
  await db.transaction(async (tx) => {
    await tx.insert(cloths).values(clothContent).onConflictDoNothing();

    for (const [index, piece] of pieceContent.entries()) {
      const { colourways: colours, priceUsd, ...fields } = piece;
      const [row] = await tx
        .insert(pieces)
        .values({ ...fields, priceCents: usdToCents(priceUsd), sortOrder: index })
        .returning({ id: pieces.id });
      if (!row) throw new Error(`Could not seed ${piece.slug}`);

      for (const [position, colour] of colours.entries()) {
        const [colourRow] = await tx
          .insert(colourways)
          .values({
            pieceId: row.id,
            slug: colour.id,
            name: colour.name,
            hex: colour.hex,
            lining: colour.lining,
            position,
          })
          .returning({ id: colourways.id });
        if (!colourRow) throw new Error(`Could not seed ${piece.slug}/${colour.id}`);

        await tx.insert(variants).values(
          piece.sizes.map((size) => ({
            pieceId: row.id,
            colourwayId: colourRow.id,
            size,
            stock: commerce.seedStockPerVariant,
            sku: makeSku(piece.slug, colour.id, size),
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

/** Runs on every boot. An empty `pieces` table seeds itself. */
export async function ensureSeeded(db: Db): Promise<void> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(pieces);
  if (!row || row.count === 0) await seedCatalog(db);
  await ensureAdminUser(db);
}
