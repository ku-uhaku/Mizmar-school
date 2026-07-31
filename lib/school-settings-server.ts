import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { settingsOf, type SchoolSettingsValues } from "@/lib/school-settings";

/**
 * One school's settings, read straight from the database.
 *
 * `AuthContext.settings` already carries the settings of the school the user is
 * *working in*, and screens should use that. This is for the service layer,
 * which is handed a `schoolId` and must not assume it is the current one — an
 * org administrator editing a pupil while another school is selected in the
 * header would otherwise allocate a matricule in the wrong format.
 *
 * React-cached, so a write touching three settings-dependent helpers still
 * reads the row once.
 */
export const loadSchoolSettings = cache(
  async (schoolId: string): Promise<SchoolSettingsValues> =>
    settingsOf(await db.schoolSettings.findUnique({ where: { schoolId } })),
);
