"use server";

import { redirect } from "next/navigation";
import { copy } from "@/content/copy";
import { LOGIN_PATH, login, logout } from "../auth";
import { getClientIp } from "../request";

export type LoginState = { message: string | null };

/** Form fields: `email`, `password`. Redirects to /admin on success. */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const result = await login(
    { email: typeof email === "string" ? email : "", password: typeof password === "string" ? password : "" },
    await getClientIp(),
  );
  if (!result.ok) {
    return { message: result.code === "rate_limited" ? copy.admin.login.tooMany : copy.admin.login.failed };
  }
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect(LOGIN_PATH);
}
