import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import type { CSSProperties } from "react";
import { RegisterForm } from "@/components/account/register-form";
import { VybeIdCard } from "@/components/account/vybe-id-card";
import { WorldPage } from "@/components/world/world-page";
import { copy } from "@/content/copy";
import { worldOr, worlds } from "@/content/worlds";
import { PASSWORD_MIN } from "@/lib/password-rules";
import { destinationAfterLogin, safeNextPath } from "@/lib/safe-redirect";
import { getCustomerSession } from "@/server/customer-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.account.register.metaTitle, robots: { index: false } };

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
 * Shopper registration, the sign-in page's sibling: the same composition, classes and VYBE ID
 * card, with the form for a new account. Opens in the world named in the URL, keeps a checked
 * `?next=` path for after, and sends a shopper who is already signed in straight on.
 */
export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const world = worldOr(first(params.world));
  const next = safeNextPath(first(params.next));
  if (await signedIn()) redirect(destinationAfterLogin(next, world));

  const text = copy.account.register;
  const current = worlds[world];

  return (
    <WorldPage world={world} className="page-login page-register grain">
      <div className="shell login-grid">
        <div className="login-head">
          <p className="kicker hero-in" style={step(0)}>
            {text.kicker}
          </p>
          <h1 id="register-title" className="t-display login-title hero-in" style={step(1)}>
            <span className="t-slant">{text.title}</span>
          </h1>
        </div>
        <div className="login-copy">
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
        </div>

        <div className="login-artifact hero-in" style={step(4)}>
          <VybeIdCard world={current} access={text.cardAccess} />
        </div>

        <section className="login-panel glass-2 hero-in" style={step(2)} aria-labelledby="register-form-title">
          <h2 id="register-form-title" className="t-micro">
            {text.formTitle}
          </h2>
          <RegisterForm
            next={next}
            world={world}
            copy={{
              name: text.name,
              namePlaceholder: text.namePlaceholder,
              email: text.email,
              emailPlaceholder: text.emailPlaceholder,
              password: text.password,
              passwordPlaceholder: text.passwordPlaceholder,
              passwordHint: text.passwordHint(PASSWORD_MIN),
              confirm: text.confirm,
              confirmPlaceholder: text.confirmPlaceholder,
              showPassword: text.showPassword,
              hidePassword: text.hidePassword,
              submit: text.submit,
              submitting: text.submitting,
              passwordShort: text.passwordShort(PASSWORD_MIN),
              passwordWeak: text.passwordWeak,
              mismatch: text.mismatch,
              haveAccount: text.haveAccount,
              login: text.login,
              required: copy.forms.required,
              invalidEmail: copy.forms.email,
              tooLong: copy.forms.tooLong,
            }}
          />
        </section>
      </div>
    </WorldPage>
  );
}
