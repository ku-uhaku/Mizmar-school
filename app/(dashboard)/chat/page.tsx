import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ChatModeration } from "@/modules/chat/components/chat-moderation";
import { listChannels, listMessages } from "@/modules/chat/queries";

export const metadata: Metadata = { title: "Espace parents" };

/**
 * The staff side of the parents' space: read it, and take things out of it.
 *
 * Not a place to hold a conversation — nobody on staff posts here. The screen
 * exists so a school can answer "what is being said" and "take that down",
 * which is what makes the feature safe to switch on at all.
 */
export default async function ChatPage(props: PageProps<"/chat">) {
  const context = await requireAuth();
  const t = await getDictionary();
  const { channel } = await props.searchParams;

  if (!context.can(PERMISSIONS.CHAT_VIEW)) {
    return <ForbiddenState />;
  }

  const channels = await listChannels(context);
  const selectedId =
    typeof channel === "string" && channels.some((row) => row.id === channel)
      ? channel
      : (channels[0]?.id ?? null);

  const messages = selectedId
    ? ((await listMessages(context, selectedId)) ?? [])
    : [];

  return (
    <>
      <PageHeader title={t.chat.title} description={t.chat.subtitle} />

      <ChatModeration
        channels={channels}
        selectedId={selectedId}
        messages={messages}
        canModerate={context.can(PERMISSIONS.CHAT_MODERATE)}
        // Both switches off means the school has not opened the space at all,
        // which is a different empty screen from "nobody has posted".
        isEnabled={
          context.settings.parentChatEnabled ||
          context.settings.parentClassChatEnabled
        }
      />
    </>
  );
}
