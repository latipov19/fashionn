import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

type FieldBaseProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** Shown inline and linked to the control with aria-describedby. */
  error?: string | null;
  /** Lets a checkout error summary link straight to this control. */
  id?: string;
};

type Wiring = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 1.5 15 14H1L8 1.5Z" />
      <path d="M8 6v4M8 11.2v1.3" />
    </svg>
  );
}

/** Label, hint, control and error, wired together. Exported for fields with their own control, such as PasswordField. */
export function FieldShell({
  label,
  hint,
  error,
  id,
  control,
  describedBy,
}: FieldBaseProps & { control: (wiring: Wiring) => ReactNode; describedBy?: string }) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const described = [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label className="field-label" htmlFor={controlId}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {control({ id: controlId, "aria-invalid": error ? true : undefined, "aria-describedby": described })}
      {error && (
        <p id={errorId} className="field-error">
          <ErrorIcon />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function mergeClass(className?: string) {
  return className ? `field-input ${className}` : "field-input";
}

export type FieldProps = FieldBaseProps & Omit<ComponentProps<"input">, "id">;

/** Labelled input. Label above, hint, then error, all wired for assistive tech. */
export function Field({ label, hint, error, id, className, "aria-describedby": describedBy, ...input }: FieldProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      id={id}
      describedBy={describedBy}
      control={(wiring) => <input {...input} {...wiring} className={mergeClass(className)} />}
    />
  );
}

export type TextareaFieldProps = FieldBaseProps & Omit<ComponentProps<"textarea">, "id">;

export function TextareaField({ label, hint, error, id, className, "aria-describedby": describedBy, ...textarea }: TextareaFieldProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      id={id}
      describedBy={describedBy}
      control={(wiring) => <textarea {...textarea} {...wiring} className={mergeClass(className)} />}
    />
  );
}

export type SelectFieldProps = FieldBaseProps & Omit<ComponentProps<"select">, "id">;

export function SelectField({ label, hint, error, id, className, children, "aria-describedby": describedBy, ...select }: SelectFieldProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      id={id}
      describedBy={describedBy}
      control={(wiring) => (
        <select {...select} {...wiring} className={mergeClass(className)}>
          {children}
        </select>
      )}
    />
  );
}
