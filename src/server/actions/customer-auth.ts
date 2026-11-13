"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { copy } from "@/content/copy";
import { worldOr } from "@/content/worlds";
import type { CustomerLoginField, CustomerLoginState } from "@/lib/customer-login-state";
import { destinationAfterLogin, safeNextPath } from "@/lib/safe-redirect";
import { fieldErrors, loginSchema } from "@/lib/validation";
import { loginCustomer } from "../customer-auth";
import { getClientIp } from "../request";

const text = copy.account.login;

function value(formData: FormData, key: string): string {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

/**
 * Form fields: `email`, `password`, and hidden `next` and `world`. Every one is checked here
 * again, whatever the browser did: `next` must be a same-site path and `world` a known world.
 * On success this redirects; on failure it returns the email as typed and never the password.
 */
export async function customerLoginAction(_previous: CustomerLoginState, formData: FormData): Promise<CustomerLoginState> {
  const email = value(formData, "email").trim();
  const world = worldOr(value(formData, "world"));
  const next = safeNextPath(value(formData, "next"));

  const parsed = loginSchema.safeParse({ email, password: value(formData, "password") });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    const picked: Partial<Record<CustomerLoginField, string>> = {};
    if (errors.email) picked.email = email ? errors.email : copy.forms.required;
    if (errors.password) picked.password = errors.password;
    return { message: null, fieldErrors: picked, email };
  }

  try {
    const result = await loginCustomer(parsed.data, await getClientIp());
    if (!result.ok) return { message: result.code === "rate_limited" ? text.tooMany : text.failed, fieldErrors: {}, email };
  } catch (error) {
    unstable_rethrow(error);
    // Only the error is logged, never the form data. The password is compared in memory and
    // never reaches a query, so no database error can carry it either.
    console.error("customerLoginAction failed", error);
    return { message: text.unavailable, fieldErrors: {}, email };
  }

  redirect(destinationAfterLogin(next, world));
}
