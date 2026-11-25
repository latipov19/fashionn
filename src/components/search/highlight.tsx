import { Fragment } from "react";
import { matchRanges } from "@/lib/search";

/** `text` with the parts that match the query's words marked, whatever apostrophe the shopper typed. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = matchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;

  const parts = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, start)}</Fragment>);
    parts.push(
      <mark key={`m${start}`} className="search-mark">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}
