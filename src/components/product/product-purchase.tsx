"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { commerce } from "@/content/commerce";
import { copy, stockLabel } from "@/content/copy";
import type { SizeChart } from "@/content/types";
import type { ShopImage } from "@/lib/shop";
import type { CartActionState } from "@/server/actions/cart";
import { addToCartAction } from "@/server/actions/cart";
import { Price } from "./product-tile";

export type PurchaseColor = {
  id: string;
  slug: string;
  name: string;
  hex: string;
  images: ShopImage[];
  /** The lead image is a generated sample, so the page says it is not a photo. */
  generated: boolean;
  variants: { id: string; size: string; stock: number }[];
};

export type PurchaseProduct = {
  name: string;
  priceUzs: number;
  compareAtUzs: number | null;
  isDemo: boolean;
  sizes: string[];
  sizeChart: SizeChart;
  lines: { name: string; href: string }[];
  colors: PurchaseColor[];
};

const text = copy.product;

const firstInStock = (color: PurchaseColor | undefined) => color?.variants.find((variant) => variant.stock > 0)?.size ?? null;

/**
 * The gallery and buy box of a product page. Choosing a colour swaps the images and keeps the
 * chosen size when that colour has it in stock; the colour is written to the address bar, so a
 * link opens on it. Adding to the cart runs the server action, which re-reads price and stock.
 */
export function ProductPurchase({ product, initialColor, children }: { product: PurchaseProduct; initialColor: string; children?: ReactNode }) {
  const toast = useToast();
  const sizeGuide = useRef<HTMLDialogElement>(null);
  const ids = useId();
  const [colorSlug, setColorSlug] = useState(initialColor);
  const color = product.colors.find((entry) => entry.slug === colorSlug) ?? product.colors[0];
  const [size, setSize] = useState<string | null>(() => (product.sizes.length === 1 ? firstInStock(color) : null));
  const [image, setImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const variant = color?.variants.find((entry) => entry.size === size) ?? null;
  const stock = variant?.stock ?? 0;
  const maxQuantity = Math.max(1, Math.min(stock, commerce.maxLineQuantity));
  const soldOut = !color || color.variants.every((entry) => entry.stock <= 0);
  const images = color?.images ?? [];
  const shown = images[Math.min(image, images.length - 1)] ?? null;

  const [, formAction, pending] = useActionState(async (previous: CartActionState, formData: FormData) => {
    const result = await addToCartAction(previous, formData);
    if (result.status === "error") toast.show(result.message);
    else if (result.status !== "idle") toast.show(result.message ?? copy.micro.added);
    return result;
  }, { status: "idle" } as CartActionState);

  const chooseColor = (next: PurchaseColor) => {
    // The chosen colour in the address bar, keeping everything else (such as the world).
    const params = new URLSearchParams(window.location.search);
    params.set("color", next.slug);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    setColorSlug(next.slug);
    setImage(0);
    const keep = next.variants.find((entry) => entry.size === size && entry.stock > 0);
    if (!keep) setSize(product.sizes.length === 1 ? firstInStock(next) : null);
    setQuantity(1);
  };

  const chooseSize = (next: string) => {
    setSize(next);
    setQuantity(1);
  };

  return (
    <div className="product-layout">
      <section className="product-gallery" aria-label={text.gallery}>
        <div className="product-stage" style={shown ? { backgroundImage: `url(${shown.blur})` } : undefined}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline
            <img key={shown.src} src={shown.src} srcSet={shown.srcSet} sizes="(max-width: 900px) 100vw, 55vw" width={shown.width} height={shown.height} alt={shown.alt} decoding="async" fetchPriority="high" />
          ) : null}
          {product.isDemo ? <span className="demo-tag product-stage-tag">{copy.demoTag}</span> : null}
        </div>
        {images.length > 1 ? (
          <ul className="product-thumbs">
            {images.map((entry, index) => (
              <li key={entry.src}>
                <button type="button" className="product-thumb" aria-pressed={index === image} aria-label={text.imageOf(index + 1, images.length)} onClick={() => setImage(index)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline */}
                  <img src={entry.src} srcSet={entry.srcSet} sizes="96px" width={entry.width} height={entry.height} alt="" loading="lazy" decoding="async" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {color?.generated ? <p className="t-small text-muted product-note">{text.demoImage}</p> : null}
      </section>

      <section className="product-buy" aria-labelledby={`${ids}-title`}>
        {product.lines.length ? (
          <p className="kicker">
            {product.lines.map((line, index) => (
              <span key={line.href}>
                {index ? " · " : null}
                <Link href={line.href} className="product-line-link">
                  {line.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
        <h1 id={`${ids}-title`} className="t-title product-title">
          {product.name}
        </h1>
        <Price priceUzs={product.priceUzs} compareAtUzs={product.compareAtUzs} />

        <form action={formAction} className="product-form">
          {product.colors.length ? (
            <fieldset className="product-field">
              <legend className="product-legend">{text.colorChosen(color?.name ?? "")}</legend>
              <div className="product-colors">
                {product.colors.map((entry) => (
                  <label key={entry.slug} className="color-choice" title={entry.name}>
                    <input type="radio" name={`${ids}-color`} className="sr-only" checked={entry.slug === color?.slug} onChange={() => chooseColor(entry)} />
                    <span className="color-dot" style={{ backgroundColor: entry.hex }} aria-hidden="true" />
                    <span className="sr-only">{entry.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="product-field">
            <div className="product-legend-row">
              <legend className="product-legend">{size ? text.sizeChosen(size) : text.chooseSize}</legend>
              <button type="button" className="search-text-btn" onClick={() => sizeGuide.current?.showModal()}>
                {text.sizeGuide}
              </button>
            </div>
            <div className="product-sizes">
              {product.sizes.map((label) => {
                const entry = color?.variants.find((candidate) => candidate.size === label);
                const out = !entry || entry.stock <= 0;
                return (
                  <label key={label} className="size-choice" data-out={out ? "true" : undefined}>
                    <input type="radio" name={`${ids}-size`} className="sr-only" checked={size === label} disabled={out} onChange={() => chooseSize(label)} />
                    <span>{label}</span>
                    {out ? <span className="sr-only">, {text.sizeSoldOut}</span> : null}
                  </label>
                );
              })}
            </div>
            <p className="product-stock t-small" aria-live="polite">
              {soldOut ? copy.micro.soldOut : variant ? stockLabel(stock) : null}
            </p>
          </fieldset>

          <div className="product-actions">
            <div className="qty" role="group" aria-label={text.quantity}>
              <button type="button" className="qty-btn" aria-label={text.decrease} disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                −
              </button>
              <output className="qty-value" aria-live="polite">
                {quantity}
              </output>
              <button type="button" className="qty-btn" aria-label={text.increase} disabled={!variant || quantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}>
                +
              </button>
            </div>
            <input type="hidden" name="variantId" value={variant?.id ?? ""} />
            <input type="hidden" name="quantity" value={quantity} />
            <Button type="submit" variant="primary" fullWidth loading={pending} disabled={!variant || stock <= 0}>
              {soldOut ? copy.micro.soldOut : !variant ? copy.micro.sizePrompt : pending ? copy.micro.adding : copy.micro.addToCart}
            </Button>
          </div>
          <p className="t-small text-muted">{text.paymentNote}</p>
        </form>

        {children}
      </section>

      <dialog
        ref={sizeGuide}
        className="size-guide"
        aria-labelledby={`${ids}-guide`}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="size-guide-panel">
          <div className="shop-drawer-head">
            <h2 id={`${ids}-guide`} className="t-micro">
              {text.sizeGuide}
            </h2>
            <button type="button" className="search-clear" aria-label={text.closeDialog} onClick={() => sizeGuide.current?.close()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="size-guide-body">
            <table className="size-table">
              <thead>
                <tr>
                  {product.sizeChart.columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {product.sizeChart.rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) =>
                      index === 0 ? (
                        <th key={index} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={index}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-small text-muted">{text.sizeGuideNote}</p>
          </div>
        </div>
      </dialog>
    </div>
  );
}
