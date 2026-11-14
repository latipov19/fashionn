"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import type { WorldSlug } from "@/content/types";
import type { CustomerRegisterField, CustomerRegisterState } from "@/lib/customer-register-state";
import { initialCustomerRegisterState } from "@/lib/customer-register-state";
import { accountPagePath } from "@/lib/safe-redirect";
import { isRepeatedCharacter, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password-rules";
import { customerRegisterAction } from "@/server/actions/customer-auth";

export type RegisterFormCopy = {
  name: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  passwordHint: string;
  confirm: string;
  confirmPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  submit: string;
  submitting: string;
  passwordShort: string;
  passwordWeak: string;
  mismatch: string;
  haveAccount: string;
  login: string;
  required: string;
  invalidEmail: string;
  tooLong: string;
};

type Errors = Partial<Record<CustomerRegisterField, string>>;
type Values = Record<CustomerRegisterField, string>;

const FIELDS: CustomerRegisterField[] = ["name", "email", "password", "confirm"];
/** A quick shape check for instant feedback. The server's schema has the final word. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The shopper registration form, the sign-in form's sibling. Fields are checked as the shopper
 * leaves them and again on submit, so most mistakes never reach the server; the server checks
 * everything again regardless. Name and email survive a failed attempt; passwords never do.
 */
export function RegisterForm({ copy, next, world }: { copy: RegisterFormCopy; next: string | null; world: WorldSlug }) {
  const [state, formAction] = useActionState(customerRegisterAction, initialCustomerRegisterState);
  const [name, setName] = useState(state.name);
  const [email, setEmail] = useState(state.email);
  const [errors, setErrors] = useState<Errors>(state.fieldErrors);
  const [seen, setSeen] = useState<CustomerRegisterState>(state);
  const form = useRef<HTMLFormElement>(null);

  // A new answer from the server replaces what the shopper last saw.
  if (seen !== state) {
    setSeen(state);
    setErrors(state.fieldErrors);
    setName(state.name);
    setEmail(state.email);
  }

  function read(): Values {
    const data = new FormData(form.current ?? undefined);
    return Object.fromEntries(FIELDS.map((field) => [field, String(data.get(field) ?? "")])) as Values;
  }

  function check(field: CustomerRegisterField, values: Values): string | undefined {
    const value = values[field];
    switch (field) {
      case "name": {
        const trimmed = value.trim();
        if (!trimmed) return copy.required;
        return trimmed.length > NAME_MAX ? copy.tooLong : undefined;
      }
      case "email": {
        const trimmed = value.trim();
        if (!trimmed) return copy.required;
        return EMAIL.test(trimmed) ? undefined : copy.invalidEmail;
      }
      case "password":
        if (!value) return copy.required;
        if (value.length < PASSWORD_MIN) return copy.passwordShort;
        if (value.length > PASSWORD_MAX) return copy.tooLong;
        if (isRepeatedCharacter(value) || value.toLowerCase() === values.email.trim().toLowerCase()) return copy.passwordWeak;
        return undefined;
      case "confirm":
        if (!value) return copy.required;
        return value === values.password ? undefined : copy.mismatch;
    }
  }

  /**
   * Leaving a filled field checks it; typing into a field that shows an error re-checks it. A
   * change to the password also re-checks a confirmation already marked, which may now match.
   */
  function revalidate(field: CustomerRegisterField, onlyIfShown: boolean) {
    const values = read();
    setErrors((current) => {
      const updated = { ...current };
      if (onlyIfShown ? current[field] : values[field]) updated[field] = check(field, values);
      if (field === "password" && current.confirm && values.confirm) updated.confirm = check("confirm", values);
      return updated;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    const values = read();
    const found: Errors = {};
    for (const field of FIELDS) found[field] = check(field, values);
    const first = FIELDS.find((field) => found[field]);
    if (!first) return;
    event.preventDefault();
    setErrors(found);
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
        label={copy.name}
        name="name"
        type="text"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={NAME_MAX}
        placeholder={copy.namePlaceholder}
        required
        value={name}
        error={errors.name}
        onChange={(event) => {
          setName(event.target.value);
          revalidate("name", true);
        }}
        onBlur={() => revalidate("name", false)}
      />

      <Field
        label={copy.email}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={copy.emailPlaceholder}
        required
        value={email}
        error={errors.email}
        onChange={(event) => {
          setEmail(event.target.value);
          revalidate("email", true);
        }}
        onBlur={() => revalidate("email", false)}
      />

      <PasswordField
        label={copy.password}
        name="password"
        autoComplete="new-password"
        placeholder={copy.passwordPlaceholder}
        hint={copy.passwordHint}
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        required
        showLabel={copy.showPassword}
        hideLabel={copy.hidePassword}
        error={errors.password}
        onChange={() => revalidate("password", true)}
        onBlur={() => revalidate("password", false)}
      />

      <PasswordField
        label={copy.confirm}
        name="confirm"
        autoComplete="new-password"
        placeholder={copy.confirmPlaceholder}
        maxLength={PASSWORD_MAX}
        required
        showLabel={copy.showPassword}
        hideLabel={copy.hidePassword}
        error={errors.confirm}
        onChange={() => revalidate("confirm", true)}
        onBlur={() => revalidate("confirm", false)}
      />

      {next ? <input type="hidden" name="next" value={next} /> : null}
      <input type="hidden" name="world" value={world} />

      <SubmitButton variant="primary" fullWidth pendingLabel={copy.submitting}>
        {copy.submit} <span className="arrow" aria-hidden="true">→</span>
      </SubmitButton>

      <p className="login-register">
        <span className="text-muted">{copy.haveAccount}</span>
        <Link href={accountPagePath("/login", world, next)} className="login-register-link">
          {copy.login}
        </Link>
      </p>
    </form>
  );
}
