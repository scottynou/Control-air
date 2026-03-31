# Control'Air V2.1 — grand patch

## Direction
Base plus digeste, plus éditoriale, moins chargée, avec une landing plus cinématique et une meilleure hiérarchie visuelle.

## Changements principaux
- Hero d'accueil refait en grand visuel cinéma avec overlay sombre et contenu resserré.
- Header fixe conservé en permanence, avec lien **Accueil** et progression de scroll intégrée.
- Réduction de l'effet « pastilles partout » : rayons réduits, boutons et badges moins ronds.
- Réduction du nombre de blocs lourds sur la home pour laisser une base plus propre à enrichir ensuite.
- Suppression des textes superposés sur les cartes Réalisations / Actualités : le texte repasse sous les images pour une meilleure lisibilité.
- Réduction de la brutalité des transitions de couleurs entre sections.
- Compression verticale générale pour limiter l'effet page interminable sur desktop et mobile.
- Ajout d'un léger lissage de scroll sur desktop (désactivé sur mobile et si réduction des animations demandée).

## Images
- Les visuels **prestations** d'origine sont conservés sur les parties liées aux prestations.
- Les visuels **hors prestations** (accueil, réalisations, actualités, pages institutionnelles) ont été remplacés par des visuels éditoriaux externes dans `assets/images/editorial/`.

## Fichiers clés modifiés
- `scripts/app.js`
- `scripts/content.js`
- `styles/site.css`
- `assets/images/editorial/*`

---

# Control'Air V2.2 — passe mobile & performance

## Objectif
Conserver le rendu desktop, alléger fortement le comportement sur téléphone et réduire les coûts de chargement sur mobile.

## Changements principaux
- Chargement de **Lenis** retiré du HTML initial puis chargé **uniquement à la demande** sur desktop large quand les conditions matérielles le permettent.
- Hydratation initiale allégée : les pages pré-rendues en français ne sont plus rerendues entièrement au chargement, ce qui réduit le travail JS au premier affichage.
- Détection de performance plus agressive sur appareils tactiles / petits écrans afin de basculer plus tôt vers un mode `balanced` ou `light`.
- Désactivation de plusieurs effets coûteux sur mobile : overlays fixes de fond, blur/backdrop lourds, transitions inutiles, rail animé du process, marquee en animation continue.
- Nouvelle feuille `styles/mobile-optimizations.css` ajoutée après les styles principaux pour ajuster uniquement l'expérience téléphone.
- Cartes et CTA resserrés sur petits écrans, meilleure lisibilité et zones tactiles renforcées.
- Images lourdes recompressées en place et vidéo compressée avec `faststart` pour limiter le poids réseau sur mobile.
- Attributs `width` / `height` injectés sur les images HTML afin de limiter les décalages visuels au chargement.
- Headers Vercel enrichis avec des règles de cache pour `assets`, `styles` et `scripts`.

## Gains concrets appliqués
- Taille du dossier ramenée d'environ **10.36 Mo** à **7.04 Mo**.
- Vidéo principale réduite d'environ **993 Ko** à **209 Ko**.
- Plusieurs visuels prestations / réalisations réduits de **~500 Ko** à **~134 Ko** ou moins.

## Fichiers clés modifiés
- `scripts/app.js`
- `scripts/prerender-static.js`
- `styles/mobile-optimizations.css`
- `PATCH-NOTES.md`
- `assets/images/**/*`
- `assets/video/**/*`
- toutes les pages HTML régénérées
- `vercel.json`
