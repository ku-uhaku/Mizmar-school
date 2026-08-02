import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Recording a pièce is split from viewing one because the two are done by
 * different people: a teacher may need to know a dossier is incomplete before
 * handing out a certificat, and only the guichet says a document has been
 * received. The catalogue itself is edited under Configuration, which carries
 * its own permission.
 */
export const DOCUMENT_PERMISSIONS = definePermissions({
  DOCUMENT_VIEW: "document.view",
  DOCUMENT_MANAGE: "document.manage",
});
