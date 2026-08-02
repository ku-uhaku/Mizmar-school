/** Documents translations (ar). Checked against `en` — see lib/i18n/types.ts. */
const ar = {
  document: {
    dossier: "الملف",
    dossierSubtitle: "الوثائق التي تطلبها المدرسة، وما توفّر منها.",
    piece: "الوثيقة",
    required: "إجبارية",
    optional: "اختيارية",
    copies: "{count} نسخ",
    status: "الحالة",
    receivedOn: "تاريخ التوصل",
    reference: "المرجع",
    referenceHint: "رقم الوثيقة الخاص بها، إن وُجد.",
    notes: "ملاحظة",
    notesHint: "سبب الرفض، أو مسوّغ الإعفاء.",
    recordedBy: "سجّلها",
    record: "تسجيل",
    recorded: "تم تحديث الملف.",
    complete: "الملف مكتمل",
    missingCount: "{count} ناقصة",
    missingOptional: "{count} اختيارية في الانتظار",
    settledOf: "{settled} وثيقة إجبارية من {total}",
    noTypes:
      "لم تُحدَّد أي وثيقة. أضفها من الإعدادات ← المؤسسة.",
    emptyDossier: "لم يُسجَّل بعد أي شيء في هذا الملف.",
  },
  documentOptions: {
    statuses: {
      MISSING: "ناقصة",
      RECEIVED: "متوصَّل بها",
      REJECTED: "مرفوضة",
      EXEMPTED: "معفى منها",
    },
  },
} as const;

export const permissions = {
  groups: {
    document: "ملفات التلاميذ",
  },
  codes: {
    "document.view": "الاطلاع على ملف التلميذ",
    "document.manage": "تسجيل وثائق الملف",
  },
} as const;

export default ar;
