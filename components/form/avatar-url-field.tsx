"use client";

import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { useI18n } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

/** Looks like a URL enough to be worth attempting as an <img src>. */
function isPreviewable(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Avatar URL input with a live preview beside it.
 *
 * The app stores a URL rather than an uploaded file — there is no object store
 * yet — so the preview is the only way to find out you pasted a dead link
 * before saving.
 */
export function AvatarUrlField({
  defaultValue,
  error,
  fallback,
  name = "avatarUrl",
}: {
  defaultValue: string;
  error?: string;
  /** Initials shown when there is no image, or it fails to load. */
  fallback: string;
  name?: string;
}) {
  const { t } = useI18n();
  const [value, setValue] = React.useState(defaultValue);
  const [broken, setBroken] = React.useState(false);

  const src = isPreviewable(value) && !broken ? value.trim() : null;

  return (
    <div className="flex items-end gap-3">
      <Avatar className="size-11 shrink-0 border">
        {src ? (
          <AvatarImage src={src} alt="" onError={() => setBroken(true)} />
        ) : null}
        <AvatarFallback className="text-xs">{fallback || "?"}</AvatarFallback>
      </Avatar>

      <FormField
        name={name}
        label={t.profile.avatarUrl}
        error={error}
        className="min-w-0 flex-1"
      >
        <Input
          {...controlProps(name, error)}
          type="url"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setBroken(false);
          }}
          dir="ltr"
          placeholder="https://…"
        />
      </FormField>
    </div>
  );
}
