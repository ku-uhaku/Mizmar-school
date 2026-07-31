"use client";

import * as React from "react";
import { ImageUpIcon, LinkIcon, Trash2Icon } from "lucide-react";

import { useI18n } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCEPTED_IMAGE_TYPES,
  checkImageValue,
  formatImageSize,
  imageByteLength,
  IMAGE_MAX_EDGE,
  MAX_IMAGE_BYTES,
  type ImageKind,
} from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * Resizes a chosen file and encodes it, entirely in the browser.
 *
 * ── Why the resize happens here ──────────────────────────────────────────────
 * A phone photograph is four megabytes. Uploading that and shrinking it on the
 * server would mean carrying four megabytes over the wire to keep twenty
 * kilobytes, and the server would need an image library to do it. Doing it on a
 * canvas before the value is ever put in the form means the request is already
 * small, no dependency is needed, and the cap in lib/images.ts is a guard
 * against a crafted request rather than something a user ever meets.
 *
 * WebP with a JPEG fallback: every browser that can run this app encodes WebP,
 * but `toDataURL` silently returns a PNG for an unknown type, and a PNG
 * photograph is far larger than the cap allows — so the result is checked
 * rather than assumed.
 *
 * SVG is passed through untouched. It is already small, and rasterising a
 * vector crest to 512 pixels would throw away exactly what it is for.
 */
async function encodeImage(file: File, kind: ImageKind): Promise<string> {
  if (file.type === "image/svg+xml") {
    return readAsDataUrl(file);
  }

  const source = await readAsDataUrl(file);
  const image = await loadImage(source);

  const maxEdge = IMAGE_MAX_EDGE[kind];
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0, width, height);

  // Step the quality down until it fits. Two attempts are almost always enough
  // at these dimensions; the loop is what makes "almost" unnecessary to trust.
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const encoded = canvas.toDataURL("image/webp", quality);
    if (
      encoded.startsWith("data:image/webp") &&
      imageByteLength(encoded) <= MAX_IMAGE_BYTES
    ) {
      return encoded;
    }
  }

  return canvas.toDataURL("image/jpeg", 0.7);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode failed"));
    image.src = src;
  });
}

/**
 * The one control for every logo and every avatar in the app.
 *
 * Two ways in, because both are real: schools that already host their crest
 * paste a link, and everybody else has a file on their desk. The stored value
 * is a string either way, so nothing downstream has to care which was used.
 *
 * The value travels in a hidden input rather than being read off the visible
 * one — the visible field shows a link, and a chosen file has no link to show.
 */
export function ImageField({
  name,
  label,
  hint,
  kind = "avatar",
  defaultValue,
  error,
  fallback,
}: {
  name: string;
  label: string;
  hint?: string;
  /** `avatar` previews as a circle and resizes smaller; `logo` as a rectangle. */
  kind?: ImageKind;
  defaultValue: string;
  error?: string;
  /** Initials shown when there is no image, or it fails to load. */
  fallback: string;
}) {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [value, setValue] = React.useState(defaultValue);
  const [broken, setBroken] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const isData = value.startsWith("data:");
  const usable = checkImageValue(value) === null && value.trim() !== "";
  const src = usable && !broken ? value.trim() : null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLocalError(null);

    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setLocalError(t.validation.notAnImage);
      return;
    }

    setBusy(true);
    try {
      const encoded = await encodeImage(file, kind);
      // An SVG is passed through unresized, so it is the one path that can
      // still arrive over the cap.
      if (imageByteLength(encoded) > MAX_IMAGE_BYTES) {
        setLocalError(
          t.validation.imageTooLarge.replace(
            "{max}",
            formatImageSize(MAX_IMAGE_BYTES),
          ),
        );
        return;
      }
      setValue(encoded);
      setBroken(false);
    } catch {
      setLocalError(t.errors.unexpected);
    } finally {
      setBusy(false);
    }
  }

  const shown = localError ?? error;

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${name}-url`}>{label}</Label>

      <div className="flex items-start gap-3">
        {/* A crest is not a face: a logo keeps its own shape, an avatar is round. */}
        {kind === "avatar" ? (
          <Avatar className="size-16 shrink-0 border">
            {src ? (
              <AvatarImage src={src} alt="" onError={() => setBroken(true)} />
            ) : null}
            <AvatarFallback className="text-sm">
              {fallback || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                className="size-full object-contain"
                onError={() => setBroken(true)}
              />
            ) : (
              <ImageUpIcon className="text-muted-foreground size-5" />
            )}
          </div>
        )}

        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <ImageUpIcon />
              {busy ? t.common.loading : t.common.chooseImage}
            </Button>

            {value !== "" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setValue("");
                  setBroken(false);
                  setLocalError(null);
                }}
              >
                <Trash2Icon />
                {t.common.removeImage}
              </Button>
            ) : null}
          </div>

          {/*
            The link field shows a URL and is disabled once a file has been
            chosen — a data URI is thousands of characters and putting it in a
            text box would be unreadable and untypable.
          */}
          <div className="relative">
            <LinkIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              id={`${name}-url`}
              type="url"
              value={isData ? "" : value}
              disabled={isData}
              onChange={(event) => {
                setValue(event.target.value);
                setBroken(false);
                setLocalError(null);
              }}
              placeholder={isData ? t.common.imageChosen : "https://…"}
              dir="ltr"
              className="ps-8"
              aria-invalid={shown ? true : undefined}
            />
          </div>

          <p className="text-muted-foreground text-xs">
            {isData
              ? `${t.common.imageChosen} · ${formatImageSize(imageByteLength(value))}`
              : (hint ?? t.common.imageHint)}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          // Cleared so choosing the same file twice still fires a change.
          event.target.value = "";
        }}
      />

      {/* The value the form actually submits. */}
      <input type="hidden" name={name} value={value} />

      {shown ? (
        <p
          role="alert"
          className={cn("text-destructive text-xs font-medium")}
        >
          {shown}
        </p>
      ) : null}
    </div>
  );
}
