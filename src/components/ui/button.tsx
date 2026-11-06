"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type ButtonVariant = "primary" | "secondary" | "text";

type StyleProps = {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

function classes({ variant = "primary", fullWidth }: StyleProps, extra?: string) {
  return ["btn", `btn-${variant}`, fullWidth && "btn-full", extra].filter(Boolean).join(" ");
}

export type ButtonProps = Omit<ComponentProps<"button">, "disabled"> &
  StyleProps & {
    /** The label stays and a 1 px line draws along the base. */
    loading?: boolean;
    /** Uses aria-disabled so the control stays focusable and can explain itself. */
    disabled?: boolean;
  };

export function Button({ variant, fullWidth, loading, disabled, className, onClick, type = "button", children, ...rest }: ButtonProps) {
  const inert = Boolean(loading || disabled);

  function guard(event: MouseEvent<HTMLButtonElement>) {
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      className={classes({ variant, fullWidth }, className)}
      aria-busy={loading || undefined}
      aria-disabled={disabled || undefined}
      onClick={guard}
    >
      {children}
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** A link that looks like a button, for navigation such as `Checkout`. */
export function ButtonLink({ variant, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link {...rest} className={classes({ variant, fullWidth }, className)} />;
}

export type SubmitButtonProps = Omit<ButtonProps, "type" | "loading"> & {
  /** Shown while the form action runs, for example `Placing order`. */
  pendingLabel?: ReactNode;
};

/** A submit button that follows the state of its parent form action. */
export function SubmitButton({ children, pendingLabel, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button {...rest} type="submit" loading={pending}>
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
