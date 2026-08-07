import { defineModule } from "@/lib/module";
import { CHAT_PERMISSIONS } from "@/modules/chat/permissions";

/**
 * L'espace parents: the conversation between a school's families.
 *
 * Owns the channels and the messages. The web side of it is a moderation
 * screen and nothing else — nobody on staff is expected to hold a conversation
 * here, they are expected to be able to remove a message from one. Parents read
 * and write it from the phone, through `modules/portal/queries.ts`, which is
 * the only place a query takes a user id rather than an `AuthContext`.
 *
 * Whether it exists at all is the manager's: `SchoolSettings.parentChatEnabled`
 * and `parentClassChatEnabled`, edited under Configuration.
 */
export const chatModule = defineModule({
  id: "chat",
  schemaFolder: "chat",
  nav: [
    {
      href: "/chat",
      icon: "chat",
      section: "vieScolaire",
      labelKey: "chat",
      order: 70,
      schoolPermission: CHAT_PERMISSIONS.CHAT_VIEW,
    },
  ],
  permissions: [{ group: "chat", codes: Object.values(CHAT_PERMISSIONS) }],
});
