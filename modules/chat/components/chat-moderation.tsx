"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MessagesSquareIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shell/empty-state";
import { SectionHeading } from "@/components/shell/section-heading";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteMessageAction,
  setChannelArchivedAction,
} from "@/modules/chat/actions";
import type { ChatChannelRow, ChatMessageRow } from "@/modules/chat/queries";

/**
 * Reading the parents' space, and taking things out of it.
 *
 * ── Removed messages stay on this screen ────────────────────────────────────
 * They are struck through rather than hidden. A moderator's next question after
 * "was this dealt with?" is "what did it say", and a screen that hides its own
 * moderation cannot answer either — the same reasoning as the caisse's ledger,
 * where a cancelled movement stays visible with its correcting entry beneath.
 */
export function ChatModeration({
  channels,
  selectedId,
  messages,
  canModerate,
  isEnabled,
}: {
  channels: ChatChannelRow[];
  selectedId: string | null;
  messages: ChatMessageRow[];
  canModerate: boolean;
  isEnabled: boolean;
}) {
  const { t, locale } = useI18n();
  const [pending, startTransition] = React.useTransition();

  function run(action: () => Promise<{ status: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") toast.success(result.message ?? "");
      else toast.error(result.message ?? t.errors.unexpected);
    });
  }

  if (!isEnabled) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<MessagesSquareIcon className="size-5" />}
            title={t.chat.disabled}
            description={t.chat.disabledHint}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/configuration/billing/school-settings">
                  {t.configuration.title}
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<MessagesSquareIcon className="size-5" />}
            title={t.chat.noChannels}
            description={t.chat.noChannelsHint}
          />
        </CardContent>
      </Card>
    );
  }

  const selected = channels.find((channel) => channel.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <section className="grid gap-3">
        <SectionHeading label={t.chat.channels} />
        <div className="grid gap-2">
          {channels.map((channel) => (
            <Link
              key={channel.id}
              href={`/chat?channel=${channel.id}`}
              className="group"
            >
              <Card
                className={cn(
                  "gap-0 py-3 transition-colors",
                  channel.id === selectedId
                    ? "border-section/60 bg-section/10"
                    : "hover:border-section/40",
                )}
              >
                <CardContent className="px-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {channel.className
                        ? interpolate(t.chat.classChannel, {
                            name: channel.className,
                          })
                        : t.chat.generalChannel}
                    </span>
                    {channel.isArchived ? (
                      <Badge variant="outline">{t.chat.archived}</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {interpolate(t.chat.messageCount, {
                      count: channel.messageCount,
                    })}
                    {channel.lastMessageAt
                      ? ` · ${formatDate(channel.lastMessageAt, locale)}`
                      : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <SectionHeading
          label={t.chat.messages}
          description={selected?.isArchived ? t.chat.archivedHint : undefined}
          action={
            canModerate && selected ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setChannelArchivedAction(selected.id, !selected.isArchived),
                  )
                }
              >
                {selected.isArchived ? (
                  <ArchiveRestoreIcon />
                ) : (
                  <ArchiveIcon />
                )}
                {selected.isArchived ? t.chat.reopen : t.chat.archive}
              </Button>
            ) : null
          }
        />

        {messages.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<MessagesSquareIcon className="size-5" />}
                title={t.chat.noMessages}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-0 py-0">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "px-4 py-3",
                  index > 0 && "border-t",
                  message.deletedAt && "bg-muted/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{message.authorName}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(message.createdAt, locale)}
                    </p>
                  </div>

                  {message.deletedAt ? (
                    <Badge variant="outline">
                      {message.deletedByName
                        ? interpolate(t.chat.deletedBy, {
                            name: message.deletedByName,
                          })
                        : t.chat.deletedLabel}
                    </Badge>
                  ) : canModerate ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t.chat.deleteMessage}
                      disabled={pending}
                      onClick={() => run(() => deleteMessageAction(message.id))}
                    >
                      <Trash2Icon />
                    </Button>
                  ) : null}
                </div>

                <p
                  className={cn(
                    "mt-1 text-sm whitespace-pre-wrap",
                    message.deletedAt && "text-muted-foreground line-through",
                  )}
                >
                  {message.body}
                </p>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
