"use client";

import type { FormEvent } from "react";
import { useActionState, useId, useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import type { CustomerLoginField, CustomerLoginState } from "@/lib/customer-login-state";
import { initialCustomerLoginState } from "@/lib/customer-login-state";
import { customerLoginAction } from "@/server/actions/customer-auth";

export type LoginFormCopy = {
  email: string;
  password: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
  submitting: string;
  forgot: string;
  forgotNote: string;
  noAccount: string;
  register: string;
  soon: string;
  required: string;
  invalidEmail: string;
};

type Errors = Partial<Record<CustomerLoginField, string>>;

/** A quick shape check for instant feedback. The server's schema has the final word. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The shopper sign-in form. Fields are checked as the shopper leaves them and again on submit,
 * so most mistakes never reach the server; the server checks everything again regardless.
 */
export function LoginForm({ copy, next, world }: { copy: LoginFormCopy; next: string | null; world: string }) {
  const [state, formAction] = useActionState(customerLoginAction, initialCustomerLoginState);
  const [email, setEmail] = useState(state.email);
  const [errors, setErrors] = useState<Errors>(state.fieldErrors);
  const [seen, setSeen] = useState<CustomerLoginState>(state);
  const [forgotOpen, setForgotOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const forgotId = useId();

  // A new answer from the server replaces what the shopper last saw.
  if (seen !== state) {
    setSeen(state);
    setErrors(state.fieldErrors);
    setEmail(state.email);
  }

  function check(field: CustomerLoginField, value: string): string | undefined {
    if (field === "email") {
      const trimmed = value.trim();
      if (!trimmed) return copy.required;
      if (!EMAIL.test(trimmed)) return copy.invalidEmail;
      return undefined;
    }
    return value ? undefined : copy.required;
  }

  /** Leaving a filled field checks it; typing into a field that shows an error re-checks it. */
  function revalidate(field: CustomerLoginField, value: string, onlyIfShown: boolean) {
    if (onlyIfShown && !errors[field]) return;
    if (!onlyIfShown && !value) return;
    setErrors((current) => ({ ...current, [field]: check(field, value) }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const found: Errors = {
      email: check("email", String(data.get("email") ?? "")),
      password: check("password", String(data.get("password") ?? "")),
    };
    if (!found.email && !found.password) return;
    event.preventDefault();
    setErrors(found);
    const first = found.email ? "email" : "password";
    form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
  }

  return (
    <form ref={form} className="login-form" action={formAction} onSubmit={submit} noValidate>
      {state.message ? (
        <p className="login-alert" role="alert">
          {state.message}
        </p>
      ) : null}

      <Field
        label={copy.email}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        error={errors.email}
        onChange={(event) => {
          setEmail(event.target.value);
          revalidate("email", event.target.value, true);
        }}
        onBlur={(event) => revalidate("email", event.target.value, false)}
      />

      <div className="grid gap-2">
        <PasswordField
          label={copy.password}
          name="password"
          autoComplete="current-password"
          required
          showLabel={copy.showPassword}
          hideLabel={copy.hidePassword}
          error={errors.password}
          onChange={(event) => revalidate("password", event.target.value, true)}
          onBlur={(event) => revalidate("password", event.target.value, false)}
        />
        <button type="button" className="login-forgot" aria-expanded={forgotOpen} aria-controls={forgotId} onClick={() => setForgotOpen((open) => !open)}>
          {copy.forgot}
        </button>
        <p id={forgotId} className="login-note" hidden={!forgotOpen}>
          {copy.forgotNote}
        </p>
      </div>

      {next ? <input type="hidden" name="next" value={next} /> : null}
      <input type="hidden" name="world" value={world} />

      <SubmitButton variant="primary" fullWidth pendingLabel={copy.submitting}>
        {copy.submit} <span className="arrow" aria-hidden="true">→</span>
      </SubmitButton>

      <p className="login-register">
        <span className="text-muted">{copy.noAccount}</span>
        <span className="login-register-name">{copy.register}</span>
        <span className="soon-tag">{copy.soon}</span>
      </p>
    </form>
  );
}
