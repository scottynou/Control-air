# Control'Air V2

Refonte complète du site Control'Air avec une direction artistique premium, plus cinématique, plus institutionnelle et plus éditoriale, tout en conservant le fond métier utile du site d'origine.

## Ce qui a été refait

### Direction artistique
- Refonte visuelle totale : plus aucun rapport avec la maquette actuelle dans la forme.
- Univers plus haut de gamme : grands titres, hero immersif, alternance sombre / clair, cartes premium, compositions éditoriales, mise en scène des images et de la vidéo.
- Sensation “grand groupe / bureau d’expertise” plutôt que “site vitrine simple”.

### Architecture éditoriale
- Conservation du fond utile : prestations, réglementation, réalisations, actualités, contact, pages légales.
- Réécriture du rythme des sections : ouverture forte, preuves, process, expertise, réglementation, cas concrets, articles, conversion.
- Pages détail dédiées pour les réalisations et pour les articles.

### Fonctionnel
- Version FR / EN conservée.
- Filtres sur les réalisations et sur les actualités.
- Formulaire de contact conservé sans inventer de backend : il ouvre le client mail (`mailto:`), pour rester fidèle à la stack/fonctionnalité actuelle.
- Bandeau cookies.
- Pages légales intégrées dans le nouveau design.
- SEO de base : `robots.txt`, `sitemap.xml`, `vercel.json` pour les headers.

## Stack livrée
- **Static multipage**
- HTML
- CSS
- JavaScript vanilla

Aucune dépendance build n'est nécessaire pour lancer le site.

## Fichiers principaux

- `index.html` — accueil
- `prestations.html`
- `reglementation.html`
- `realisations.html`
- `realisation.html`
- `actualites.html`
- `article.html`
- `contact.html`
- `mentions-legales.html`
- `confidentialite.html`
- `cookies.html`

### Scripts
- `scripts/content.js` — contenu structuré du site (FR/EN, réalisations, articles, textes, légaux)
- `scripts/app.js` — rendu des pages, interactions, filtres, langue, formulaire

### Styles
- `styles/site.css` — design system complet de la V2

## Lancer le site en local

Depuis ce dossier :

```bash
python -m http.server 8000
```

Puis ouvrir :

```bash
http://localhost:8000
```

## Déploiement Vercel

### Option simple
- Importer ce dossier dans un projet Vercel
- Déployer tel quel comme site statique

### Option CLI
```bash
vercel
```

## Points importants

- Le site est pensé pour **remplacer complètement** la V1.
- Je n'ai **pas ajouté de fonctionnalités métier inexistantes** (pas de boutique, pas d'espace client, pas de backend fictif).
- Le contact reste volontairement simple et crédible vis-à-vis de l'existant.
- Les assets image/vidéo utilisés proviennent de l'existant, avec une mise en scène radicalement améliorée.

## Recommandations pour aller encore plus loin

### Priorité haute
1. Ajouter un vrai backend de formulaire (Resend / Formspree / API maison) pour supprimer le `mailto:`
2. Produire 8 à 15 visuels premium supplémentaires pour enrichir le storytelling
3. Passer à des URLs éditoriales propres pour les pages détail si souhaité côté Vercel / framework

### Priorité moyenne
1. Ajouter animation de transition entre pages
2. Ajouter Open Graph complet page par page
3. Ajouter un CMS léger pour les actualités / réalisations

### Priorité “niveau grande entreprise”
1. Tournage vidéo corporate court pour le hero
2. Shooting photo cohérent sur 2 ou 3 laboratoires / sites
3. Déclinaison d'une vraie charte de marque (typo, iconographie, ton éditorial, motion)

## Remarque de production
Cette V2 est volontairement conçue pour être **impactante immédiatement** avec un minimum de dépendances. Pour une étape V3 orientée SEO / performance / administration de contenu, le passage à **Next.js + CMS** serait la suite naturelle.
