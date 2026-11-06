"use server";

import { copy } from "@/content/copy";
import { subscribe } from "../newsletter";
import { newsletterLimiter } from "../rate-limit";
import { getClientIp } from "../request";

export type NewsletterState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; email: string };

/** Form field: `email`. */
export async function subscribeAction(_previous: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const entry = formData.get("email");
  const email = typeof entry === "string" ? entry : "";

  if (!newsletterLimiter.check(await getClientIp()).allowed) {
    return { status: "error", message: copy.newsletter.tooMany, email };
  }
  try {
    const result = await subscribe({ email });
    return result.ok
      ? { status: "success", message: copy.footer.success }
      : { status: "error", message: result.message, email };
  } catch (error) {
    console.error("subscribeAction failed", error);
    return { status: "error", message: copy.newsletter.failed, email };
  }
}
