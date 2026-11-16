"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { loginAction } from "@/server/actions/auth";

type Copy = { email: string; password: string; showPassword: string; hidePassword: string; submit: string; signingIn: string };

/** The existing staff sign-in action: rate limited per address and per account, same answer for any failure. */
export function AdminLoginForm({ copy }: { copy: Copy }) {
  const [state, formAction] = useActionState(loginAction, { message: null });
  return (
    <form className="admin-form" action={formAction}>
      {state.message ? (
        <p className="admin-alert" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field label={copy.email} name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      <PasswordField label={copy.password} name="password" autoComplete="current-password" required showLabel={copy.showPassword} hideLabel={copy.hidePassword} />
      <SubmitButton variant="primary" fullWidth pendingLabel={copy.signingIn}>
        {copy.submit} <span className="arrow" aria-hidden="true">→</span>
      </SubmitButton>
    </form>
  );
}
