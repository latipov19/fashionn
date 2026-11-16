"use client";

import { copy } from "@/content/copy";

/** A failed read says so plainly and offers a retry. No stack trace or server detail reaches the page. */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const text = copy.admin.error;
  return (
    <div className="admin-empty">
      <h1 className="admin-empty-title">{text.title}</h1>
      <p className="admin-empty-body">{text.body}</p>
      <button type="button" className="btn btn-secondary admin-btn-sm" onClick={reset}>
        {text.retry}
      </button>
    </div>
  );
}
