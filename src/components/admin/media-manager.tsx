"use client";

import type { FormEvent } from "react";
import { useId, useRef, useState } from "react";
import { copy } from "@/content/copy";
import type { MediaRecord } from "@/content/types";
import { MAX_UPLOAD_BYTES } from "@/lib/admin-constants";
import { hideMedia, reorderMedia, revertToGenerated, uploadMedia } from "@/server/actions/admin";
import { ConfirmButton, useAdminAction } from "./client";
import { Badge } from "./ui";

const text = copy.admin.media;
const errors = copy.admin.errors;

export type MediaColor = { id: string; name: string; hex: string; media: MediaRecord[] };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/tiff";

/**
 * One colour's images: upload (the server re-encodes, crops to 4:5 and names the files), hide,
 * show, move, and go back to the generated set. The file type is checked here only for speed;
 * the server decodes the bytes and refuses anything that is not a real image.
 */
function ColorMedia({ productId, color }: { productId: string; color: MediaColor }) {
  const { run, pending, fieldErrors, setFieldErrors } = useAdminAction();
  const [focal, setFocal] = useState({ x: 50, y: 50 });
  const form = useRef<HTMLFormElement>(null);
  const fileId = useId();
  const altId = useId();
  const ids = color.media.map((item) => item.id);

  function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    const order = [...ids];
    [order[index], order[target]] = [order[target]!, order[index]!];
    run(() => reorderMedia({ productId, colorId: color.id, orderedIds: order }));
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) return setFieldErrors({ file: errors.fileRequired });
    if (file.size > MAX_UPLOAD_BYTES) return setFieldErrors({ file: errors.fileTooLarge });
    data.set("productId", productId);
    data.set("colorId", color.id);
    data.set("focalX", String(focal.x / 100));
    data.set("focalY", String(focal.y / 100));
    run(() => uploadMedia(data), text.uploaded, () => form.current?.reset());
  }

  return (
    <div className="admin-media-color">
      <h3 className="admin-media-color-title">
        <span className="admin-swatch admin-swatch-sm" style={{ background: color.hex }} aria-hidden="true" />
        {color.name}
      </h3>
      {color.media.length ? (
        <ol className="admin-media-grid">
          {color.media.map((item, index) => (
            <li key={item.id} className="admin-media-item" data-hidden={item.hidden}>
              <span className="admin-media-thumb" style={{ backgroundImage: `url(${item.blur})` }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline */}
                <img src={item.srcSet[0]?.url ?? item.url} alt={item.alt} width={120} height={150} loading="lazy" decoding="async" />
              </span>
              <span className="admin-media-tags">
                <Badge tone={item.source === "upload" ? "info" : "muted"}>{item.source === "upload" ? text.upload_source : text.generated}</Badge>
                {item.hidden ? <Badge tone="warn">{text.hidden}</Badge> : null}
              </span>
              <span className="admin-media-actions">
                <button type="button" className="admin-chip" disabled={pending || index === 0} onClick={() => move(index, -1)} aria-label={`${text.moveUp}: ${item.alt}`}>
                  ←
                </button>
                <button type="button" className="admin-chip" disabled={pending || index === ids.length - 1} onClick={() => move(index, 1)} aria-label={`${text.moveDown}: ${item.alt}`}>
                  →
                </button>
                <button type="button" className="admin-chip" disabled={pending} onClick={() => run(() => hideMedia({ colorId: color.id, mediaId: item.id, hidden: !item.hidden }))}>
                  {item.hidden ? text.show : text.hide}
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted">{text.noMedia}</p>
      )}

      <form ref={form} className="admin-upload" onSubmit={upload} noValidate>
        <div className="field">
          <label className="field-label" htmlFor={fileId}>
            {text.file}
          </label>
          <p className="field-hint">{text.fileHint}</p>
          <input id={fileId} className="admin-file" type="file" name="file" accept={ACCEPT} aria-invalid={fieldErrors.file ? true : undefined} />
          {fieldErrors.file ? <p className="field-error">{fieldErrors.file}</p> : null}
        </div>
        <div className="field">
          <label className="field-label" htmlFor={altId}>
            {text.alt}
          </label>
          <p className="field-hint">{text.altHint}</p>
          <input id={altId} className="field-input" name="alt" maxLength={300} required defaultValue={`${color.name}`} aria-invalid={fieldErrors.alt ? true : undefined} />
          {fieldErrors.alt ? <p className="field-error">{fieldErrors.alt}</p> : null}
        </div>
        <fieldset className="admin-focal">
          <legend className="field-label">{text.focal}</legend>
          <label>
            X <input type="range" min={0} max={100} value={focal.x} onChange={(event) => setFocal((value) => ({ ...value, x: Number(event.target.value) }))} />
          </label>
          <label>
            Y <input type="range" min={0} max={100} value={focal.y} onChange={(event) => setFocal((value) => ({ ...value, y: Number(event.target.value) }))} />
          </label>
        </fieldset>
        <div className="admin-upload-actions">
          <button type="submit" className="btn btn-primary admin-btn-sm" disabled={pending} aria-busy={pending || undefined}>
            {pending ? text.uploading : text.upload}
          </button>
          {color.media.some((item) => item.source === "upload" && !item.hidden) ? (
            <ConfirmButton label={text.revert} message={text.revertConfirm} tone="neutral" disabled={pending} onConfirm={() => run(() => revertToGenerated({ productId, colorId: color.id }))} />
          ) : null}
        </div>
      </form>
    </div>
  );
}

export function MediaManager({ productId, colors }: { productId: string; colors: MediaColor[] }) {
  return (
    <div className="admin-media">
      {colors.map((color) => (
        <ColorMedia key={color.id} productId={productId} color={color} />
      ))}
    </div>
  );
}
