"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { copy } from "@/content/copy";
import type { AdminRole } from "@/lib/admin-roles";
import { ADMIN_ROLES } from "@/lib/admin-roles";
import { deletePromotion, endCustomerSessions, renameCategory, savePromotion } from "@/server/actions/admin-ops";
import { updateOrderStatus } from "@/server/actions/admin";
import { changeOwnPassword, createAdminUser, removeAdminUser, setAdminRole, signOutOtherSessions } from "@/server/actions/admin-team";
import { ConfirmButton, useAdminAction } from "./client";

const admin = copy.admin;

/* Categories */

export function CategoryRename({ name }: { name: string }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  if (!open) {
    return (
      <button type="button" className="admin-chip" onClick={() => setOpen(true)}>
        {admin.categories.rename}
      </button>
    );
  }
  return (
    <form
      className="admin-inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => renameCategory({ from: name, to: value }), (data) => admin.categories.renamed(data.count), () => setOpen(false));
      }}
    >
      <label className="sr-only" htmlFor={`rename-${name}`}>
        {admin.categories.newName}
      </label>
      <input id={`rename-${name}`} className="admin-input" value={value} maxLength={60} onChange={(event) => setValue(event.target.value)} aria-invalid={fieldErrors.to ? true : undefined} autoFocus />
      <button type="submit" className="btn btn-secondary admin-btn-sm" disabled={pending}>
        {admin.common.save}
      </button>
      <button type="button" className="admin-link-muted" onClick={() => setOpen(false)}>
        {admin.common.cancel}
      </button>
      {fieldErrors.to ? <span className="field-error">{fieldErrors.to}</span> : null}
    </form>
  );
}

/* Orders */

type OrderStatus = keyof typeof copy.order.status;

/** Only the next steps the server allows; cancelling and returning confirm first, because they bring stock back. */
export function OrderStatusControl({ orderId, next }: { orderId: string; next: readonly OrderStatus[] }) {
  const { run, pending } = useAdminAction();
  const text = admin.orders.detail;
  if (next.length === 0) return <p className="text-muted">{text.noNext}</p>;
  const change = (status: OrderStatus) => run(() => updateOrderStatus({ orderId, status }), text.changed);
  return (
    <div className="admin-status-actions">
      {next.map((status) =>
        status === "canceled" || status === "returned" ? (
          <ConfirmButton key={status} label={copy.order.status[status]} message={status === "canceled" ? text.confirmCancel : text.confirmReturn} disabled={pending} onConfirm={() => change(status)} />
        ) : (
          <button key={status} type="button" className="btn btn-primary admin-btn-sm" disabled={pending} onClick={() => change(status)}>
            → {copy.order.status[status]}
          </button>
        ),
      )}
    </div>
  );
}

/* Customers */

export function EndSessionsButton({ customerId, disabled }: { customerId: string; disabled: boolean }) {
  const { run, pending } = useAdminAction();
  const text = admin.customers.detail;
  return (
    <ConfirmButton label={text.endSessions} message={text.endSessionsNote} disabled={disabled || pending} onConfirm={() => run(() => endCustomerSessions({ customerId }), (data) => text.ended(data.count))} />
  );
}

/* Promotions */

export type PromotionDraft = {
  id?: string;
  code: string;
  kind: "percent" | "fixed";
  value: string;
  minOrderUzs: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  active: boolean;
  note: string;
};

export const emptyPromotion: PromotionDraft = { code: "", kind: "percent", value: "10", minOrderUzs: "0", startsAt: "", endsAt: "", usageLimit: "", active: true, note: "" };

const digits = (value: string) => (value.trim() === "" ? Number.NaN : Number(value.replace(/[\s,]/g, "")));

export function PromotionForm({ initial, onDone }: { initial: PromotionDraft; onDone?: () => void }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [draft, setDraft] = useState(initial);
  const text = admin.promotions;
  const set = <K extends keyof PromotionDraft>(key: K, value: PromotionDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () =>
        savePromotion({
          id: draft.id,
          code: draft.code,
          kind: draft.kind,
          value: digits(draft.value),
          minOrderUzs: draft.minOrderUzs.trim() ? digits(draft.minOrderUzs) : 0,
          startsAt: draft.startsAt || undefined,
          endsAt: draft.endsAt || undefined,
          usageLimit: draft.usageLimit.trim() ? digits(draft.usageLimit) : null,
          active: draft.active,
          note: draft.note || undefined,
        }),
      text.saved,
      () => {
        if (!draft.id) setDraft(emptyPromotion);
        onDone?.();
      },
    );
  }

  return (
    <form className="admin-form admin-promo-form" onSubmit={submit} noValidate>
      <div className="admin-field-row">
        <Field label={text.fields.code} hint={text.fields.codeHint} className="admin-mono" maxLength={24} value={draft.code} error={fieldErrors.code} onChange={(event) => set("code", event.target.value.toUpperCase())} />
        <SelectField label={text.fields.kind} value={draft.kind} error={fieldErrors.kind} onChange={(event) => set("kind", event.target.value as PromotionDraft["kind"])}>
          <option value="percent">{text.fields.percent}</option>
          <option value="fixed">{text.fields.fixed}</option>
        </SelectField>
        <Field label={text.fields.value} hint={text.fields.valueHint} inputMode="numeric" value={draft.value} error={fieldErrors.value} onChange={(event) => set("value", event.target.value)} />
      </div>
      <div className="admin-field-row">
        <Field label={text.fields.minOrder} inputMode="numeric" value={draft.minOrderUzs} error={fieldErrors.minOrderUzs} onChange={(event) => set("minOrderUzs", event.target.value)} />
        <Field label={text.fields.usageLimit} hint={text.fields.usageLimitHint} inputMode="numeric" value={draft.usageLimit} error={fieldErrors.usageLimit} onChange={(event) => set("usageLimit", event.target.value)} />
      </div>
      <div className="admin-field-row">
        <Field label={text.fields.startsAt} type="datetime-local" value={draft.startsAt} error={fieldErrors.startsAt} onChange={(event) => set("startsAt", event.target.value)} />
        <Field label={text.fields.endsAt} type="datetime-local" value={draft.endsAt} error={fieldErrors.endsAt} onChange={(event) => set("endsAt", event.target.value)} />
      </div>
      <TextareaField label={text.fields.note} rows={2} maxLength={200} value={draft.note} error={fieldErrors.note} onChange={(event) => set("note", event.target.value)} />
      <label className="admin-check">
        <input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} />
        {text.fields.active}
      </label>
      <div className="admin-form-actions">
        <button type="submit" className="btn btn-primary admin-btn-sm" disabled={pending} aria-busy={pending || undefined}>
          {draft.id ? text.save : text.create}
        </button>
        {draft.id ? (
          <ConfirmButton label={admin.common.delete} message={text.deleteConfirm(draft.code)} disabled={pending} onConfirm={() => run(() => deletePromotion({ id: draft.id! }), text.deleted, onDone)} />
        ) : null}
      </div>
    </form>
  );
}

export function PromotionEditToggle({ initial }: { initial: PromotionDraft }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="admin-promo-edit">
      <PromotionForm initial={initial} onDone={() => setOpen(false)} />
      <button type="button" className="admin-link-muted" onClick={() => setOpen(false)}>
        {admin.common.cancel}
      </button>
    </div>
  ) : (
    <button type="button" className="admin-chip" onClick={() => setOpen(true)}>
      {admin.shell.edit}
    </button>
  );
}

/* Team */

export function AddMemberForm() {
  const { run, pending, fieldErrors } = useAdminAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("editor");
  const [formKey, setFormKey] = useState(0);
  const text = admin.team;
  return (
    <form
      key={formKey}
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get("password") ?? "");
        run(() => createAdminUser({ email, role, password }), text.created, () => {
          setEmail("");
          setFormKey((key) => key + 1);
        });
      }}
      noValidate
    >
      <div className="admin-field-row">
        <Field label={text.email} type="email" autoComplete="off" value={email} error={fieldErrors.email} onChange={(event) => setEmail(event.target.value)} />
        <SelectField label={text.role} value={role} error={fieldErrors.role} onChange={(event) => setRole(event.target.value as AdminRole)}>
          {ADMIN_ROLES.map((value) => (
            <option key={value} value={value}>
              {admin.roles[value]}
            </option>
          ))}
        </SelectField>
      </div>
      <PasswordField label={text.password} name="password" hint={text.passwordHint} autoComplete="new-password" showLabel={admin.login.showPassword} hideLabel={admin.login.hidePassword} error={fieldErrors.password} />
      <div className="admin-form-actions">
        <button type="submit" className="btn btn-primary admin-btn-sm" disabled={pending}>
          {text.create}
        </button>
      </div>
    </form>
  );
}

export function MemberControls({ id, email, role }: { id: string; email: string; role: AdminRole }) {
  const { run, pending } = useAdminAction();
  const [value, setValue] = useState(role);
  const text = admin.team;
  return (
    <div className="admin-member-controls">
      <label className="sr-only" htmlFor={`role-${id}`}>
        {text.role}
      </label>
      <select id={`role-${id}`} className="admin-input" value={value} onChange={(event) => setValue(event.target.value as AdminRole)}>
        {ADMIN_ROLES.map((option) => (
          <option key={option} value={option}>
            {admin.roles[option]}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-secondary admin-btn-sm" disabled={pending || value === role} onClick={() => run(() => setAdminRole({ id, role: value }), text.roleChanged)}>
        {text.changeRole}
      </button>
      <ConfirmButton label={text.remove} message={text.removeConfirm(email)} disabled={pending} onConfirm={() => run(() => removeAdminUser({ id }), text.removed)} />
    </div>
  );
}

/* My account */

export function AccountSettings() {
  const router = useRouter();
  const { run, pending, fieldErrors } = useAdminAction();
  const [formKey, setFormKey] = useState(0);
  const text = admin.settings;
  return (
    <div className="admin-account-settings">
      <form
        key={formKey}
        className="admin-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const value = (key: string) => String(data.get(key) ?? "");
          run(() => changeOwnPassword({ current: value("current"), next: value("next"), confirm: value("confirm") }), text.passwordChanged, () => setFormKey((key) => key + 1));
        }}
      >
        <h3 className="admin-panel-title">{text.changePassword}</h3>
        <PasswordField label={text.currentPassword} name="current" autoComplete="current-password" showLabel={admin.login.showPassword} hideLabel={admin.login.hidePassword} error={fieldErrors.current} />
        <PasswordField label={text.newPassword} name="next" hint={text.newPasswordHint} autoComplete="new-password" showLabel={admin.login.showPassword} hideLabel={admin.login.hidePassword} error={fieldErrors.next} />
        <PasswordField label={text.confirmPassword} name="confirm" autoComplete="new-password" showLabel={admin.login.showPassword} hideLabel={admin.login.hidePassword} error={fieldErrors.confirm} />
        <div className="admin-form-actions">
          <button type="submit" className="btn btn-primary admin-btn-sm" disabled={pending}>
            {admin.common.save}
          </button>
        </div>
      </form>
      <div className="admin-form-actions">
        <button type="button" className="btn btn-secondary admin-btn-sm" disabled={pending} onClick={() => run(() => signOutOtherSessions(), (data) => text.signedOutOthers(data.count), () => router.refresh())}>
          {text.signOutOthers}
        </button>
      </div>
    </div>
  );
}
