import type { Metadata } from "next";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/login-form";
import { SunrayMark } from "@/components/ui/marks";
import { copy } from "@/content/copy";
import { getSession } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.admin.login.metaTitle };

async function signedIn(): Promise<boolean> {
  try {
    return Boolean(await getSession());
  } catch (error) {
    unstable_rethrow(error);
    console.error("admin session check failed", error);
    return false;
  }
}

/** Staff sign-in. There is no sign-up anywhere: staff accounts come from the owner. */
export default async function AdminLoginPage() {
  if (await signedIn()) redirect("/admin");
  const text = copy.admin.login;
  return (
    <div className="admin-login" data-world="dark-mode" data-world-root="dark-mode">
      <section className="admin-login-panel glass-2" aria-labelledby="admin-login-title">
        <span className="admin-login-mark" aria-hidden="true">
          <SunrayMark />
        </span>
        <p className="kicker">{text.kicker}</p>
        <h1 id="admin-login-title" className="admin-title">
          {text.heading}
        </h1>
        <p className="admin-lead">{text.lead}</p>
        <AdminLoginForm
          copy={{
            email: text.email,
            password: text.password,
            showPassword: text.showPassword,
            hidePassword: text.hidePassword,
            submit: text.submit,
            signingIn: text.signingIn,
          }}
        />
        <p className="admin-login-note">{text.noSignup}</p>
        <Link href="/" className="admin-link-muted">
          ← {text.backToStore}
        </Link>
      </section>
    </div>
  );
}
