"use client";

import { useId } from "react";
import { setLiteMode, useLiteMode } from "@/lib/use-motion";

type Props = { label: string; hint: string; on: string; off: string };

/** Light mode: 3D and nonessential motion stop. Stored per browser. */
export function LiteToggle({ label, hint, on, off }: Props) {
  const lite = useLiteMode();
  const hintId = useId();

  return (
    <div className="grid gap-1">
      <button type="button" className="lite-toggle" aria-pressed={lite} aria-describedby={hintId} onClick={() => setLiteMode(!lite)}>
        <span className="track" aria-hidden="true" />
        <span>
          {label}: {lite ? on : off}
        </span>
      </button>
      <p id={hintId} className="t-small text-muted">
        {hint}
      </p>
    </div>
  );
}
