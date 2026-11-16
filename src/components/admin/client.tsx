"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useId, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { copy } from "@/content/copy";
import type { ActionResult } from "@/lib/action-result";

const text = copy.admin;

/**
 * Runs a server action from a click: one at a time, a toast for the outcome, and a refresh so
 * the server-rendered page shows the new state. The server decides; nothing is optimistic.
 */
export function useAdminAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function run<T>(action: () => Promise<ActionResult<T>>, success?: string | ((data: T) => string), after?: (data: T) => void) {
    if (pending) return;
    start(async () => {
      const result = await action();
      if (result.ok) {
        setFieldErrors({});
        if (success) toast.show(typeof success === "function" ? success(result.data) : success);
        after?.(result.data);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.show(result.message);
      }
    });
  }

  return { run, pending, fieldErrors, setFieldErrors };
}

/**
 * A button that asks first, in a modal dialog with the reason spelled out. Focus moves into the
 * dialog, Escape cancels, and the destructive choice is never the default button.
 */
export function ConfirmButton({
  label,
  message,
  confirmLabel,
  onConfirm,
  tone = "danger",
  disabled,
  children,
  className,
}: {
  label: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  tone?: "danger" | "neutral";
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button type="button" className={className ?? (tone === "danger" ? "admin-btn-danger" : "btn btn-secondary admin-btn-sm")} onClick={() => dialog.current?.showModal()} aria-disabled={disabled || undefined} disabled={disabled}>
        {children ?? label}
      </button>
      <dialog ref={dialog} className="admin-dialog glass-3" aria-labelledby={titleId}>
        <h2 id={titleId} className="admin-dialog-title">
          {label}
        </h2>
        <div className="admin-dialog-body">{message}</div>
        <div className="admin-dialog-actions">
          <button type="button" className="btn btn-secondary admin-btn-sm" autoFocus onClick={() => dialog.current?.close()}>
            {text.common.cancel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "admin-btn-danger" : "btn btn-primary admin-btn-sm"}
            onClick={() => {
              dialog.current?.close();
              onConfirm();
            }}
          >
            {confirmLabel ?? text.common.confirm}
          </button>
        </div>
      </dialog>
    </>
  );
}
