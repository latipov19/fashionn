import { Placard } from "@/components/ui/placard";
import { Wordmark } from "@/components/ui/marks";
import { copy } from "@/content/copy";
import { formatCents } from "@/lib/money";
import { listPieces } from "@/server/catalog";

export const dynamic = "force-dynamic";

/** Stands in until the home engineer builds The Wall. Reading the catalog boots the database. */
export default async function HomePage() {
  const pieces = await listPieces();

  return (
    <section className="section shell" data-ground="bone">
      <Wordmark className="mb-8" />
      <h1 className="t-display-xl">{copy.home.wall.h1}</h1>
      <p className="t-lead measure mt-4">{copy.home.wall.lead}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pieces.map((piece) => (
          <li key={piece.id}>
            <Placard peg={piece.peg} name={piece.name} nameAs="h2" clothLine={piece.cloth.label} price={formatCents(piece.priceCents)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
