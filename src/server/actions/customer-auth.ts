"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { copy } from "@/content/copy";
import { worldOr } from "@/content/worlds";
import type { CustomerLoginField, CustomerLoginState } from "@/lib/customer-login-state";
import type { CustomerRegisterField, CustomerRegisterState } from "@/lib/customer-register-state";
import { destinationAfterLogin, safeNextPath } from "@/lib/safe-redirect";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation";
import { loginCustomer, registerCustomer } from "../customer-auth";
import { getClientIp } from "../request";

const text = copy.account.login;
const registerText = copy.account.register;

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

const REGISTER_FIELDS: CustomerRegisterField[] = ["name", "email", "password", "confirm"];

/**
 * Form fields: `name`, `email`, `password`, `confirm`, and hidden `next` and `world`. Anything
 * else in the form is ignored. On success the shopper is signed in and redirected like after a
 * sign-in; on failure the name and email come back as typed, never a password.
 */
export async function customerRegisterAction(_previous: CustomerRegisterState, formData: FormData): Promise<CustomerRegisterState> {
  const input = {
    name: value(formData, "name"),
    email: value(formData, "email").trim(),
    password: value(formData, "password"),
    confirm: value(formData, "confirm"),
  };
  const world = worldOr(value(formData, "world"));
  const next = safeNextPath(value(formData, "next"));
  const kept = { name: input.name.trim(), email: input.email };

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    // The object-level checks only run once every field is valid. Say the passwords differ
    // anyway, so the shopper hears every problem at once.
    if (!errors.confirm && input.confirm && input.confirm !== input.password) errors.confirm = registerText.mismatch;
    const picked: Partial<Record<CustomerRegisterField, string>> = {};
    for (const field of REGISTER_FIELDS) if (errors[field]) picked[field] = errors[field];
    if (picked.email && !input.email) picked.email = copy.forms.required;
    return { message: null, fieldErrors: picked, ...kept };
  }

  try {
    const result = await registerCustomer(input, await getClientIp());
    if (!result.ok) {
      const message = result.code === "taken" ? registerText.taken : result.code === "rate_limited" ? registerText.tooMany : registerText.unavailable;
      return { message, fieldErrors: {}, ...kept };
    }
  } catch (error) {
    unstable_rethrow(error);
    // Only the error is logged, never the form data. The password is hashed in memory and only
    // its hash reaches a query.
    console.error("customerRegisterAction failed", error);
    return { message: registerText.unavailable, fieldErrors: {}, ...kept };
  }

  redirect(destinationAfterLogin(next, world));
}
