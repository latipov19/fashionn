"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import type { FieldProps } from "./field";
import { FieldShell } from "./field";

type Props = Omit<FieldProps, "type"> & {
  showLabel: string;
  hideLabel: string;
} & Pick<ComponentProps<"input">, "autoComplete">;

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <path d="M4 4l16 16" />}
    </svg>
  );
}

/**
 * A password input with a show and hide button inside it. The button's name says what it will
 * do next, it names the input it controls, and it never submits the form.
 */
export function PasswordField({ label, hint, error, id, className, showLabel, hideLabel, "aria-describedby": describedBy, ...input }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      id={id}
      describedBy={describedBy}
      control={(wiring) => (
        <div className="password-control">
          <input
            {...input}
            {...wiring}
            type={visible ? "text" : "password"}
            className={className ? `field-input ${className}` : "field-input"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="password-toggle"
            aria-controls={wiring.id}
            aria-label={visible ? hideLabel : showLabel}
            title={visible ? hideLabel : showLabel}
            onClick={() => setVisible((value) => !value)}
          >
            <EyeIcon open={!visible} />
          </button>
        </div>
      )}
    />
  );
}
