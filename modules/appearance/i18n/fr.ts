/**
 * Appearance translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  appearance: {
    title: "Apparence",
    subtitle: "Ajustez l'interface à votre convenance. Enregistré dans votre profil.",
    language: "Langue",
    languageHint: "L'arabe bascule toute l'interface de droite à gauche.",
    themeMode: "Thème",
    enterFullscreen: "Plein écran",
    exitFullscreen: "Quitter le plein écran",
    accent: "Couleur d'accentuation",
    fontFamily: "Police",
    fontSize: "Taille du texte",
    radius: "Arrondi des angles",
    preview: "Aperçu",
    previewHeading: "Portez ce vieux whisky",
    previewBody: "Utilisez les réglages pour voir le rendu du tableau de bord. Les changements s'appliquent immédiatement et sont enregistrés dans votre profil.",
    previewButton: "Action principale",
    previewSecondary: "Secondaire",
    reset: "Réinitialiser",
    updated: "Apparence enregistrée.",
    modes: {
      light: "Clair",
      dark: "Sombre",
      system: "Système",
    },
    accents: {
      blue: "Bleu",
      emerald: "Émeraude",
      violet: "Violet",
      amber: "Ambre",
      rose: "Rose",
      teal: "Turquoise",
      neutral: "Neutre",
    },
    fonts: {
      geist: "Geist",
      inter: "Inter",
      system: "Système",
      mono: "Monospace",
    },
    sizes: {
      sm: "Petite",
      md: "Moyenne",
      lg: "Grande",
      xl: "Très grande",
    },
    radii: {
      none: "Carré",
      sm: "Petit",
      md: "Moyen",
      lg: "Grand",
      xl: "Très grand",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  appearance: "Apparence",
};

export default fr;
