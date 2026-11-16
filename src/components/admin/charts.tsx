import type { CSSProperties, ReactNode } from "react";

/*
 * Charts for the panel, in plain HTML and CSS: no chart library, nothing to load. One series
 * per chart in one hue (validated against the panel surface), so a title names it and no
 * legend box is needed. Every value is reachable without hovering: by its label, by focus, or
 * in the table under each chart.
 */

export type ColumnDatum = { key: string; label: string; value: number; display: string };

/**
 * Columns from one baseline, over time. Each column's slot is its hit target and tab stop; the
 * tooltip shows on hover and on keyboard focus. Columns are capped at 24 px, with a 2 px gap.
 */
export function ColumnChart({ data, label, table }: { data: ColumnDatum[]; label: string; table: { key: string; value: string } }) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const ticks = data.length > 14 ? Math.ceil(data.length / 7) : 1;
  return (
    <figure className="viz">
      <div className="viz-columns" role="list" aria-label={label}>
        {data.map((datum, i) => (
          <div key={datum.key} className="viz-col" role="listitem" tabIndex={0} aria-label={`${datum.label}: ${datum.display}`}>
            <span className="viz-col-bar" style={{ "--h": `${(datum.value / max) * 100}%` } as CSSProperties} data-zero={datum.value === 0} />
            <span className="viz-tip" aria-hidden="true">
              <strong>{datum.display}</strong>
              <span>{datum.label}</span>
            </span>
            {i % ticks === 0 ? (
              <span className="viz-tick" aria-hidden="true">
                {datum.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <TableView caption={label} head={[table.key, table.value]} rows={data.map((datum) => [datum.label, datum.display])} />
    </figure>
  );
}

export type BarDatum = { key: string; label: ReactNode; value: number; display: string; note?: string };

/** Horizontal bars for magnitude by category, longest first, the value printed beside each in text ink. */
export function BarList({ data, label }: { data: BarDatum[]; label: string }) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  return (
    <ul className="viz-bars" aria-label={label}>
      {data.map((datum) => (
        <li key={datum.key} className="viz-bar-row">
          <span className="viz-bar-label">{datum.label}</span>
          <span className="viz-bar-track" aria-hidden="true">
            <span className="viz-bar-fill" style={{ "--w": `${(datum.value / max) * 100}%` } as CSSProperties} data-zero={datum.value === 0} />
          </span>
          <span className="viz-bar-value tabular-nums">
            {datum.display}
            {datum.note ? <span className="viz-bar-note">{datum.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export type Segment = { key: string; label: string; value: number; tone: "good" | "warning" | "critical" };

/**
 * One whole split into parts: a tall segmented bar in the reserved status colours, each part
 * labelled with its share when it fits, and a legend naming the parts in order. Status colour
 * never carries meaning alone.
 */
export function SegmentedBar({ data, label }: { data: Segment[]; label: string }) {
  const total = data.reduce((sum, part) => sum + part.value, 0);
  const share = (value: number) => (total ? Math.round((value / total) * 100) : 0);
  const description = data.map((part) => `${part.label}: ${part.value} (${share(part.value)}%)`).join(", ");
  return (
    <figure className="viz">
      <div className="viz-segments" role="img" aria-label={`${label}. ${description}`}>
        {data
          .filter((part) => part.value > 0)
          .map((part) => (
            <span key={part.key} className="viz-segment" data-tone={part.tone} style={{ flexGrow: part.value }} title={`${part.label}: ${part.value} (${share(part.value)}%)`}>
              {share(part.value) >= 8 ? `${share(part.value)}%` : null}
            </span>
          ))}
      </div>
      <ul className="viz-legend">
        {data.map((part) => (
          <li key={part.key}>
            <i data-tone={part.tone} aria-hidden="true" />
            {part.label} <span className="tabular-nums text-muted">{part.value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** The chart's numbers as a table, folded away, for readers who want them exactly or cannot see the marks. */
export function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <details className="viz-table">
      <summary>Jadval koʻrinishi</summary>
      <table className="admin-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j > 0 ? "admin-num tabular-nums" : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
