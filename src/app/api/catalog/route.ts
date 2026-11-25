import { listShopItems } from "@/server/shop";

/*
 * The search overlay's index: every published product as a lean record, fetched once when the
 * overlay first opens and searched in the browser, so typing never waits for the network. Only
 * public catalogue fields are here; sales appear as a rank, never as counts.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listShopItems();
    return Response.json(
      { items },
      // Short, so a price or stock change in the admin reaches shoppers within a minute.
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    console.error("catalog index failed", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
