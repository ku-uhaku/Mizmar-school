"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { handleRequest } from "@/modules/requests/service";
import { handleSchema } from "@/modules/requests/validation";

/**
 * Actions for the requests module — the office's side only.
 *
 * A family never reaches this file. They file and withdraw requests from the
 * phone, through `app/api/mobile/v1/family/requests/**`, which scopes on the
 * household instead of on a permission; a parent holds neither a membership nor
 * a permission, so `authorizeSchool` would refuse every one of them.
 *
 * The school comes from the working context and the request id is re-derived
 * against it inside the service, so a crafted id reaches no other school's desk.
 */
export async function handleRequestAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();
    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.REQUEST_HANDLE);

    const parsed = handleSchema(t).safeParse({
      status: field(formData, "status"),
      readyAt: field(formData, "readyAt"),
      officeNote: field(formData, "officeNote"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const result = await handleRequest(
      field(formData, "requestId"),
      schoolId,
      {
        status: parsed.data.status,
        readyAt: parsed.data.readyAt,
        officeNote: parsed.data.officeNote,
        handledById: context.user.id,
      },
    );

    if (!result.ok) {
      if (result.reason === "date-required") {
        return failure(t.request.dateRequired, { readyAt: t.request.dateRequired });
      }
      if (result.reason === "reason-required") {
        return failure(t.request.noteRequired, {
          officeNote: t.request.noteRequired,
        });
      }
      // A move the workflow does not allow means somebody else moved the row
      // first — the screen only ever offers legal ones.
      if (result.reason === "bad-move") return failure(t.request.staleMove);
      return failure(t.errors.notFound);
    }

    refresh();
    return success(t.request.handled);
  });
}
