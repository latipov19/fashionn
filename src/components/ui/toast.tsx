"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { copy } from "@/content/copy";

type Toast = { id: number; message: string };
type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);
const LIFETIME_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message }]);
      timers.current.set(id, setTimeout(() => dismiss(id), LIFETIME_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region stays mounted so screen readers announce what is added to it. */}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" data-ground="raised">
            <span>{toast.message}</span>
            <button type="button" className="toast-dismiss" onClick={() => dismiss(toast.id)}>
              {copy.forms.dismiss}
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
