"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useId, useState } from "react";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { copy } from "@/content/copy";
import type { Slot, WorldSlug } from "@/content/types";
import { SLOTS, WORLD_SLUGS } from "@/content/types";
import { worlds } from "@/content/worlds";
import { discountPercent, formatUzs } from "@/lib/money";
import { createProduct, updateProduct } from "@/server/actions/admin";
import { useAdminAction } from "./client";
import { icons } from "./icons";

const text = copy.admin.editor;

export type EditorColor = { slug: string; name: string; hex: string };
export type EditorValues = {
  name: string;
  handle: string;
  category: string;
  slot: Slot;
  priceUzs: string;
  compareAtUzs: string;
  description: string;
  fabric: string;
  fit: string;
  care: string;
  colors: EditorColor[];
  sizes: string;
  worlds: WorldSlug[];
  published: boolean;
  isDemo: boolean;
};

export const emptyEditorValues: EditorValues = {
  name: "",
  handle: "",
  category: "",
  slot: "top",
  priceUzs: "",
  compareAtUzs: "",
  description: "",
  fabric: "",
  fit: "",
  care: "",
  colors: [{ slug: "qora", name: "Qora", hex: "#17171A" }],
  sizes: "S, M, L, XL",
  worlds: [],
  published: false,
  isDemo: false,
};

/** Lower-case Latin, digits and single hyphens: the shape the server accepts for handles and colour slugs. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ'`’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const toPrice = (value: string): number | null => {
  const digits = value.replace(/[\s,.]/g, "");
  if (!digits) return null;
  const number = Number(digits);
  return Number.isFinite(number) ? number : Number.NaN;
};

function Section({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: string }) {
  return (
    <fieldset className="admin-section" id={id}>
      <legend className="admin-section-title">{title}</legend>
      {note ? <p className="admin-section-note">{note}</p> : null}
      <div className="admin-section-body">{children}</div>
    </fieldset>
  );
}

/**
 * Create or edit a product. Everything is sent in one call and written in one transaction; the
 * server validates every field again and answers with errors keyed to them. The handle is set
 * once, because links, SKUs and media are keyed by it.
 */
export function ProductEditor({ mode, productId, initial, categories }: { mode: "create" | "edit"; productId?: string; initial: EditorValues; categories: string[] }) {
  const router = useRouter();
  const { run, pending, fieldErrors } = useAdminAction();
  const [values, setValues] = useState(initial);
  const [handleEdited, setHandleEdited] = useState(mode === "edit");
  const categoryList = useId();

  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const error = (key: string) => fieldErrors[key];

  const price = toPrice(values.priceUzs);
  const compareAt = toPrice(values.compareAtUzs);
  const off = price !== null && compareAt !== null && !Number.isNaN(price) && !Number.isNaN(compareAt) ? discountPercent(price, compareAt) : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: values.name,
      category: values.category,
      slot: values.slot,
      priceUzs: price ?? Number.NaN,
      compareAtUzs: compareAt,
      description: values.description,
      fabric: values.fabric,
      fit: values.fit,
      care: values.care,
      colors: values.colors.map((color) => ({ ...color, slug: color.slug || slugify(color.name) })),
      sizes: values.sizes
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean),
      worlds: values.worlds,
      published: values.published,
      isDemo: values.isDemo,
    };
    if (mode === "create") {
      run(
        () => createProduct({ ...payload, handle: values.handle }),
        text.created,
        (data) => router.push(`/admin/products/${data.id}`),
      );
    } else if (productId) {
      run(() => updateProduct({ id: productId, ...payload }), copy.admin.common.saved);
    }
  }

  return (
    <form className="admin-editor" onSubmit={submit} noValidate>
      <Section id="identity" title={text.sections.identity}>
        <Field
          label={text.fields.name}
          name="name"
          required
          maxLength={120}
          value={values.name}
          error={error("name")}
          onChange={(event) => {
            set("name", event.target.value);
            if (!handleEdited) set("handle", slugify(event.target.value));
          }}
        />
        <Field
          label={text.fields.handle}
          name="handle"
          hint={text.fields.handleHint}
          required
          maxLength={80}
          readOnly={mode === "edit"}
          className="admin-mono"
          value={values.handle}
          error={error("handle")}
          onChange={(event) => {
            setHandleEdited(true);
            set("handle", event.target.value.toLowerCase());
          }}
        />
        <div className="admin-field-row">
          <Field label={text.fields.category} name="category" hint={text.fields.categoryHint} required maxLength={60} list={categoryList} value={values.category} error={error("category")} onChange={(event) => set("category", event.target.value)} />
          <datalist id={categoryList}>
            {categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <SelectField label={text.fields.slot} name="slot" value={values.slot} error={error("slot")} onChange={(event) => set("slot", event.target.value as Slot)}>
            {SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {text.slots[slot]}
              </option>
            ))}
          </SelectField>
        </div>
      </Section>

      <Section id="pricing" title={text.sections.pricing} note={text.fields.currency}>
        <div className="admin-field-row">
          <Field label={text.fields.price} name="priceUzs" inputMode="numeric" required value={values.priceUzs} error={error("priceUzs")} onChange={(event) => set("priceUzs", event.target.value)} hint={price && !Number.isNaN(price) ? formatUzs(price) : undefined} />
          <Field
            label={text.fields.compareAt}
            name="compareAtUzs"
            inputMode="numeric"
            hint={off ? text.fields.discount(off) : text.fields.compareAtHint}
            value={values.compareAtUzs}
            error={error("compareAtUzs")}
            onChange={(event) => set("compareAtUzs", event.target.value)}
          />
        </div>
      </Section>

      <Section id="details" title={text.sections.details}>
        <TextareaField label={text.fields.description} name="description" required maxLength={2000} rows={5} value={values.description} error={error("description")} onChange={(event) => set("description", event.target.value)} />
        <Field label={text.fields.fabric} name="fabric" required maxLength={300} value={values.fabric} error={error("fabric")} onChange={(event) => set("fabric", event.target.value)} />
        <div className="admin-field-row">
          <Field label={text.fields.fit} name="fit" required maxLength={300} value={values.fit} error={error("fit")} onChange={(event) => set("fit", event.target.value)} />
          <Field label={text.fields.care} name="care" required maxLength={300} value={values.care} error={error("care")} onChange={(event) => set("care", event.target.value)} />
        </div>
      </Section>

      <Section id="variants" title={text.sections.variants} note={text.fields.colorsHint}>
        <div className="admin-colors" role="group" aria-label={text.fields.colors}>
          {values.colors.map((color, index) => (
            <div key={index} className="admin-color-row">
              <span className="admin-swatch" style={{ background: /^#[0-9a-f]{6}$/i.test(color.hex) ? color.hex : "transparent" }} aria-hidden="true" />
              <Field
                label={text.fields.colorName}
                value={color.name}
                maxLength={60}
                error={error(`colors.${index}.name`)}
                onChange={(event) => {
                  const name = event.target.value;
                  set(
                    "colors",
                    values.colors.map((item, i) => (i === index ? { ...item, name, slug: initial.colors.some((c) => c.slug === item.slug) && mode === "edit" ? item.slug : slugify(name) } : item)),
                  );
                }}
              />
              <Field label={text.fields.colorSlug} value={color.slug} maxLength={80} className="admin-mono" error={error(`colors.${index}.slug`)} onChange={(event) => set("colors", values.colors.map((item, i) => (i === index ? { ...item, slug: event.target.value.toLowerCase() } : item)))} />
              <Field label={text.fields.colorHex} value={color.hex} maxLength={7} className="admin-mono" error={error(`colors.${index}.hex`)} onChange={(event) => set("colors", values.colors.map((item, i) => (i === index ? { ...item, hex: event.target.value } : item)))} />
              <button type="button" className="admin-icon-button" aria-label={`${text.fields.removeColor}: ${color.name}`} disabled={values.colors.length <= 1} onClick={() => set("colors", values.colors.filter((_, i) => i !== index))}>
                {icons.close}
              </button>
            </div>
          ))}
          {error("colors") ? <p className="field-error">{error("colors")}</p> : null}
          <button type="button" className="btn btn-text" onClick={() => set("colors", [...values.colors, { slug: "", name: "", hex: "#808080" }])}>
            {icons.plus} {text.fields.addColor}
          </button>
        </div>
        <Field label={text.fields.sizes} name="sizes" hint={text.fields.sizesHint} required value={values.sizes} error={error("sizes")} onChange={(event) => set("sizes", event.target.value)} />
      </Section>

      <Section id="worlds" title={text.sections.worlds} note={text.fields.worldsHint}>
        <div className="admin-checks">
          {WORLD_SLUGS.map((slug) => (
            <label key={slug} className="admin-check">
              <input
                type="checkbox"
                checked={values.worlds.includes(slug)}
                onChange={(event) => set("worlds", event.target.checked ? [...values.worlds, slug] : values.worlds.filter((world) => world !== slug))}
              />
              <span className="admin-world-dot" style={{ background: worlds[slug].theme.bg }} aria-hidden="true" />
              {worlds[slug].name}
            </label>
          ))}
        </div>
        {error("worlds") ? <p className="field-error">{error("worlds")}</p> : null}
      </Section>

      <Section id="publication" title={text.sections.publication}>
        <div className="admin-checks">
          <label className="admin-check">
            <input type="checkbox" checked={values.published} onChange={(event) => set("published", event.target.checked)} />
            {text.fields.published}
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={values.isDemo} onChange={(event) => set("isDemo", event.target.checked)} />
            {text.fields.isDemo}
          </label>
        </div>
      </Section>

      <div className="admin-editor-bar">
        <button type="submit" className="btn btn-primary" aria-busy={pending || undefined} disabled={pending}>
          {pending ? (mode === "create" ? text.creating : copy.admin.common.saving) : mode === "create" ? text.create : text.save}
        </button>
      </div>
    </form>
  );
}
