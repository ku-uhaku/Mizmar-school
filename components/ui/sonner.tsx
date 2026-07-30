"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Swapped off next-themes: this app resolves light/dark through the cookie-backed
// AppearanceProvider so there is a single source of truth for theme state.
import { useAppearance } from "@/modules/appearance/components/appearance-provider"
import { useI18n } from "@/components/providers/i18n-provider"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedMode } = useAppearance()
  const { dir } = useI18n()
  const theme = resolvedMode

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      dir={dir}
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
