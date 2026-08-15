/**
 * The school's catalogue de fournitures — the articles a liste may name.
 *
 * A starter set rather than an exhaustive one: what a Moroccan papeterie
 * actually stocks for a rentrée, enough that every category has something in it
 * and a teacher writing a list never has to reach for a free-text box. The
 * school edits it under Configuration → Logistique.
 *
 * Pure data, so the seed and the setup wizard write the same catalogue: a
 * school configured through the screens starts from what a seeded one has.
 */

export type SupplyArticleSeed = {
  code: string;
  name: string;
  nameAr: string;
  category: string;
  /** What a teacher usually asks for. Null for what is counted by eye. */
  defaultQuantity: number | null;
  notes?: string;
};

export const SUPPLY_ARTICLE_SEEDS: SupplyArticleSeed[] = [
  // ── Écriture ──────────────────────────────────────────────────────────────
  { code: "STYLO-BLEU", name: "Stylo à bille bleu", nameAr: "قلم جاف أزرق", category: "ECRITURE", defaultQuantity: 3 },
  { code: "STYLO-NOIR", name: "Stylo à bille noir", nameAr: "قلم جاف أسود", category: "ECRITURE", defaultQuantity: 2 },
  { code: "STYLO-ROUGE", name: "Stylo à bille rouge", nameAr: "قلم جاف أحمر", category: "ECRITURE", defaultQuantity: 2 },
  { code: "STYLO-VERT", name: "Stylo à bille vert", nameAr: "قلم جاف أخضر", category: "ECRITURE", defaultQuantity: 1 },
  { code: "CRAYON-HB", name: "Crayon à papier HB", nameAr: "قلم رصاص HB", category: "ECRITURE", defaultQuantity: 3 },
  { code: "CRAYONS-COUL", name: "Crayons de couleur", nameAr: "أقلام ملونة", category: "ECRITURE", defaultQuantity: null, notes: "Boîte de 12 au minimum" },
  { code: "FEUTRES", name: "Feutres de coloriage", nameAr: "أقلام تلوين لبادية", category: "ECRITURE", defaultQuantity: null, notes: "Boîte de 12" },
  { code: "GOMME", name: "Gomme blanche", nameAr: "ممحاة بيضاء", category: "ECRITURE", defaultQuantity: 2 },
  { code: "TAILLE-CRAYON", name: "Taille-crayon avec réservoir", nameAr: "مبراة بخزان", category: "ECRITURE", defaultQuantity: 1 },
  { code: "SURLIGNEUR", name: "Surligneur", nameAr: "قلم تظليل", category: "ECRITURE", defaultQuantity: 2 },
  { code: "STYLO-PLUME", name: "Stylo plume", nameAr: "قلم حبر", category: "ECRITURE", defaultQuantity: 1 },
  { code: "CARTOUCHES", name: "Cartouches d'encre", nameAr: "خراطيش حبر", category: "ECRITURE", defaultQuantity: 1, notes: "Boîte" },

  // ── Cahiers ───────────────────────────────────────────────────────────────
  { code: "CAHIER-96-GC", name: "Cahier 96 pages, grands carreaux", nameAr: "دفتر 96 صفحة، مربعات كبيرة", category: "CAHIERS", defaultQuantity: 4, notes: "Format 24×32" },
  { code: "CAHIER-96-PC", name: "Cahier 96 pages, petits carreaux", nameAr: "دفتر 96 صفحة، مربعات صغيرة", category: "CAHIERS", defaultQuantity: 2, notes: "Format 24×32" },
  { code: "CAHIER-48", name: "Cahier 48 pages", nameAr: "دفتر 48 صفحة", category: "CAHIERS", defaultQuantity: 3, notes: "Format 17×22" },
  { code: "CAHIER-200", name: "Cahier 200 pages", nameAr: "دفتر 200 صفحة", category: "CAHIERS", defaultQuantity: 1, notes: "Format 24×32" },
  { code: "CAHIER-TP", name: "Cahier de travaux pratiques", nameAr: "دفتر الأشغال التطبيقية", category: "CAHIERS", defaultQuantity: 1, notes: "Une page blanche, une page ligne" },
  { code: "CAHIER-MUSIQUE", name: "Cahier de musique", nameAr: "دفتر الموسيقى", category: "CAHIERS", defaultQuantity: 1 },
  { code: "BLOC-NOTES", name: "Bloc-notes", nameAr: "دفتر ملاحظات", category: "CAHIERS", defaultQuantity: 1 },
  { code: "FEUILLES-DOUBLES", name: "Copies doubles perforées", nameAr: "أوراق مزدوجة مثقوبة", category: "CAHIERS", defaultQuantity: 1, notes: "Paquet de 100" },
  { code: "PAPIER-MILLI", name: "Papier millimétré", nameAr: "ورق مليمتري", category: "CAHIERS", defaultQuantity: 1, notes: "Pochette" },

  // ── Couvertures ───────────────────────────────────────────────────────────
  { code: "PROTEGE-2432", name: "Protège-cahier 24×32", nameAr: "غلاف دفتر 24×32", category: "COUVERTURES", defaultQuantity: 6, notes: "Couleurs variées" },
  { code: "PROTEGE-1722", name: "Protège-cahier 17×22", nameAr: "غلاف دفتر 17×22", category: "COUVERTURES", defaultQuantity: 3 },
  { code: "COUVRE-LIVRE", name: "Couvre-livre transparent", nameAr: "غلاف كتاب شفاف", category: "COUVERTURES", defaultQuantity: null, notes: "Un par manuel" },
  { code: "ROULEAU-PLASTIQUE", name: "Rouleau de plastique adhésif", nameAr: "لفافة بلاستيك لاصق", category: "COUVERTURES", defaultQuantity: 1 },
  { code: "ETIQUETTES", name: "Étiquettes autocollantes", nameAr: "ملصقات", category: "COUVERTURES", defaultQuantity: 1, notes: "Planche" },

  // ── Classement ────────────────────────────────────────────────────────────
  { code: "CLASSEUR-A4", name: "Classeur A4 à levier", nameAr: "مصنف A4", category: "CLASSEMENT", defaultQuantity: 1 },
  { code: "INTERCALAIRES", name: "Intercalaires", nameAr: "فواصل", category: "CLASSEMENT", defaultQuantity: 1, notes: "Jeu de 6" },
  { code: "POCHETTES", name: "Pochettes perforées", nameAr: "جيوب شفافة مثقوبة", category: "CLASSEMENT", defaultQuantity: 1, notes: "Paquet de 50" },
  { code: "CHEMISE-RABATS", name: "Chemise à rabats", nameAr: "ملف بأجنحة", category: "CLASSEMENT", defaultQuantity: 2 },
  { code: "PORTE-VUES", name: "Porte-vues 40 vues", nameAr: "ملف عرض 40 صفحة", category: "CLASSEMENT", defaultQuantity: 1 },

  // ── Géométrie ─────────────────────────────────────────────────────────────
  { code: "REGLE-30", name: "Règle graduée 30 cm", nameAr: "مسطرة 30 سم", category: "GEOMETRIE", defaultQuantity: 1 },
  { code: "EQUERRE", name: "Équerre", nameAr: "مثلث قائم", category: "GEOMETRIE", defaultQuantity: 1 },
  { code: "RAPPORTEUR", name: "Rapporteur", nameAr: "منقلة", category: "GEOMETRIE", defaultQuantity: 1 },
  { code: "COMPAS", name: "Compas", nameAr: "بركار", category: "GEOMETRIE", defaultQuantity: 1 },
  { code: "CALCULATRICE", name: "Calculatrice scientifique", nameAr: "آلة حاسبة علمية", category: "GEOMETRIE", defaultQuantity: 1, notes: "À partir du collège" },

  // ── Arts plastiques ───────────────────────────────────────────────────────
  { code: "GOUACHE", name: "Boîte de gouache", nameAr: "علبة ألوان مائية", category: "ARTS", defaultQuantity: 1 },
  { code: "PINCEAUX", name: "Pinceaux", nameAr: "فرشاة رسم", category: "ARTS", defaultQuantity: null, notes: "Trois tailles" },
  { code: "PATE-MODELER", name: "Pâte à modeler", nameAr: "معجون التشكيل", category: "ARTS", defaultQuantity: 1 },
  { code: "CISEAUX", name: "Ciseaux à bouts ronds", nameAr: "مقص بأطراف مدورة", category: "ARTS", defaultQuantity: 1 },
  { code: "COLLE-BATON", name: "Bâton de colle", nameAr: "لاصق", category: "ARTS", defaultQuantity: 2 },
  { code: "PAPIER-DESSIN", name: "Papier à dessin", nameAr: "ورق الرسم", category: "ARTS", defaultQuantity: 1, notes: "Pochette Canson" },
  { code: "ARDOISE", name: "Ardoise blanche et feutre", nameAr: "لوح أبيض وقلم", category: "ARTS", defaultQuantity: 1 },

  // ── Cartable et trousse ───────────────────────────────────────────────────
  { code: "CARTABLE", name: "Cartable", nameAr: "محفظة", category: "CARTABLE", defaultQuantity: 1 },
  { code: "TROUSSE", name: "Trousse", nameAr: "مقلمة", category: "CARTABLE", defaultQuantity: 1 },
  { code: "BOITE-GOUTER", name: "Boîte à goûter", nameAr: "علبة الوجبة", category: "CARTABLE", defaultQuantity: 1 },
  { code: "GOURDE", name: "Gourde", nameAr: "قنينة ماء", category: "CARTABLE", defaultQuantity: 1 },

  // ── Sport ─────────────────────────────────────────────────────────────────
  { code: "TENUE-SPORT", name: "Tenue de sport", nameAr: "بذلة رياضية", category: "SPORT", defaultQuantity: 1, notes: "Aux couleurs de l'école" },
  { code: "CHAUSSURES-SPORT", name: "Chaussures de sport", nameAr: "حذاء رياضي", category: "SPORT", defaultQuantity: 1 },
  { code: "SERVIETTE", name: "Petite serviette", nameAr: "منشفة صغيرة", category: "SPORT", defaultQuantity: 1 },

  // ── Hygiène ───────────────────────────────────────────────────────────────
  { code: "MOUCHOIRS", name: "Boîte de mouchoirs", nameAr: "علبة مناديل", category: "HYGIENE", defaultQuantity: 2 },
  { code: "GEL-HYDRO", name: "Gel hydroalcoolique", nameAr: "معقم اليدين", category: "HYGIENE", defaultQuantity: 1 },
  { code: "BLOUSE", name: "Blouse", nameAr: "مئزر", category: "HYGIENE", defaultQuantity: 1, notes: "Primaire" },
];
