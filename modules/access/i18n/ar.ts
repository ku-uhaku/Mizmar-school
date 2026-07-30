/**
 * Roles, permissions and memberships translations (ar).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/ar.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const ar = {
  role: {
    title: "الأدوار والصلاحيات",
    subtitle: "حدّد ما يُسمح لكل نوع من المستخدمين بفعله.",
    newRole: "دور جديد",
    editRole: "تعديل الدور",
    createRole: "إنشاء الدور",
    name: "الاسم",
    description: "الوصف",
    scope: "النطاق",
    scopeHint: "أدوار المؤسسة تُطبَّق في كل مكان؛ أدوار المدرسة تُطبَّق حيث تُسنَد فقط.",
    permissions: "الصلاحيات",
    permissionsDescription: "حدّد كل ما يُسمح لهذا الدور بفعله.",
    permissionsSelected: "{count} من {total} ممنوحة",
    systemRole: "دور نظامي",
    systemRoleHint: "دور مدمج — يمكن تعديل صلاحياته، لكن لا يمكن إعادة تسميته أو حذفه.",
    usedBy: "مُسنَد إلى",
    usedByCount: "{count} مستخدمين",
    created: "تم إنشاء الدور.",
    updated: "تم تحديث الدور.",
    deleted: "تم حذف الدور.",
    deleteTitle: "حذف هذا الدور؟",
    deleteBody: "سيتم حذف «{name}».",
    nameTaken: "يوجد دور بهذا الاسم بالفعل.",
    inUse: "هذا الدور مُسنَد إلى {count} مستخدمين. أعد تعيينهم أولاً.",
    cannotDeleteSystem: "لا يمكن حذف الأدوار النظامية.",
    noRoles: "لا توجد أدوار بعد.",
    selectAll: "تحديد الكل",
    clearAll: "إلغاء تحديد الكل",
    scopes: {
      ORG: "المؤسسة",
      SCHOOL: "المدرسة",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  roles: "الأدوار والصلاحيات",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    role: "الأدوار",
  },
  codes: {
    "role.view": "عرض الأدوار",
    "role.create": "إنشاء الأدوار",
    "role.update": "تعديل الأدوار",
    "role.delete": "حذف الأدوار",
  },
};

export default ar;
