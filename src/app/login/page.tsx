import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import type { CSSProperties } from "react";
import { LoginForm } from "@/components/account/login-form";
import { SunrayMark } from "@/components/ui/marks";
import { WorldPage } from "@/components/world/world-page";
import { copy } from "@/content/copy";
import { worldOr, worlds } from "@/content/worlds";
import { destinationAfterLogin, safeNextPath } from "@/lib/safe-redirect";
import { getCustomerSession } from "@/server/customer-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.account.login.metaTitle, robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const step = (i: number) => ({ "--i": i }) as CSSProperties;

/** True when a shopper session is open. If the database is down the form still renders. */
async function signedIn(): Promise<boolean> {
  try {
    return Boolean(await getCustomerSession());
  } catch (error) {
    unstable_rethrow(error);
    console.error("customer session check failed", error);
    return false;
  }
}

/**
 * Shopper sign-in. Opens in the world named in the URL, keeps a checked `?next=` path, and sends
 * a shopper who is already signed in straight on. No 3D here: the page is about the form.
 */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const world = worldOr(first(params.world));
  const next = safeNextPath(first(params.next));
  if (await signedIn()) redirect(destinationAfterLogin(next, world));

  const text = copy.account.login;
  const current = worlds[world];

  return (
    <WorldPage world={world} className="page-login grain">
      <div className="login-mark" aria-hidden="true">
        <SunrayMark />
      </div>
      <div className="shell login-grid">
        <section className="login-intro" aria-labelledby="login-title">
          <p className="kicker hero-in" style={step(0)}>
            {text.kicker}
          </p>
          <h1 id="login-title" className="t-display login-title hero-in" style={step(1)}>
            <span className="t-slant">{text.title}</span>
          </h1>
          <p className="t-lead text-muted measure hero-in" style={step(2)}>
            {text.lead}
          </p>
          <p className="login-world hero-in" style={step(3)}>
            <span className="menu-swatch" style={{ "--swatch": current.theme.bg } as CSSProperties} aria-hidden="true" />
            <span className="t-micro">
              {current.index} · {current.name}
            </span>
            <span className="t-small text-muted">{text.worldNote}</span>
          </p>
        </section>

        <section className="login-panel glass-2 hero-in" style={step(2)} aria-labelledby="login-form-title">
          <h2 id="login-form-title" className="t-micro">
            {text.formTitle}
          </h2>
          <LoginForm
            next={next}
            world={world}
            copy={{
              email: text.email,
              password: text.password,
              showPassword: text.showPassword,
              hidePassword: text.hidePassword,
              submit: text.submit,
              submitting: text.submitting,
              forgot: text.forgot,
              forgotNote: text.forgotNote,
              noAccount: text.noAccount,
              register: text.register,
              soon: text.soon,
              required: copy.forms.required,
              invalidEmail: copy.forms.email,
            }}
          />
        </section>
      </div>
    </WorldPage>
  );
}
