"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { copy } from "@/content/copy";
import { archiveProduct, deleteProduct, restoreProduct } from "@/server/actions/admin";
import { ConfirmButton, useAdminAction } from "./client";

const text = copy.admin.editor;

/**
 * Archive or restore, and delete for a product that was never ordered. Delete asks for the handle
 * typed out in a dialog; the server checks it again and refuses if any order line points here.
 */
export function DangerZone({ productId, handle, archived, orderLines }: { productId: string; handle: string; archived: boolean; orderLines: number }) {
  const router = useRouter();
  const { run, pending } = useAdminAction();
  const [typed, setTyped] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const inputId = useId();
  const titleId = useId();

  return (
    <div className="admin-danger">
      <div className="admin-danger-row">
        <p>{text.archiveNote}</p>
        {archived ? (
          <button type="button" className="btn btn-secondary admin-btn-sm" disabled={pending} onClick={() => run(() => restoreProduct({ id: productId }), text.restored)}>
            {text.restore}
          </button>
        ) : (
          <ConfirmButton label={text.archive} message={text.archiveNote} confirmLabel={text.archive} disabled={pending} onConfirm={() => run(() => archiveProduct({ id: productId }), text.archived)} />
        )}
      </div>
      <div className="admin-danger-row">
        <p>{orderLines > 0 ? copy.admin.errors.hasOrders : text.deleteNote}</p>
        <button type="button" className="admin-btn-danger" disabled={pending || orderLines > 0} onClick={() => dialog.current?.showModal()}>
          {text.delete}
        </button>
        <dialog ref={dialog} className="admin-dialog glass-3" aria-labelledby={titleId}>
          <h2 id={titleId} className="admin-dialog-title">
            {text.delete}
          </h2>
          <div className="admin-dialog-body">
            <p>{text.deleteNote}</p>
            <label className="field" htmlFor={inputId}>
              <span className="field-label">{text.deleteConfirmLabel(handle)}</span>
              <input id={inputId} className="field-input admin-mono" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} />
            </label>
          </div>
          <div className="admin-dialog-actions">
            <button type="button" className="btn btn-secondary admin-btn-sm" autoFocus onClick={() => dialog.current?.close()}>
              {copy.admin.common.cancel}
            </button>
            <button
              type="button"
              className="admin-btn-danger"
              disabled={typed.trim() !== handle || pending}
              onClick={() => {
                dialog.current?.close();
                run(() => deleteProduct({ id: productId, confirm: typed }), text.deleted, () => router.push("/admin/products"));
              }}
            >
              {text.delete}
            </button>
          </div>
        </dialog>
      </div>
    </div>
  );
}
