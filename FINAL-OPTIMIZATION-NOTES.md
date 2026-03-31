# Final optimisation pass — mobile, performance, SEO

## Additional changes applied in this pass

### SEO
- Fixed duplicate indexed routes by setting the standalone `.html` duplicates of clean top-level pages to `noindex,follow` while keeping the clean canonical URLs indexed.
- Removed the last duplicate service detail titles/H1s by making each prestation detail page explicitly unique:
  - `Sorbonne de laboratoire — Essai de réception`
  - `Sorbonne de laboratoire — Essai de routine`
- Added `ProfessionalService` structured data to complement `Organization`, `WebSite` and `WebPage`.
- Added `og:image:width` and `og:image:height` on pages using local Open Graph images.
- Corrected a misleading homepage wording in the educational section title.

### Mobile UX
- Added `viewport-fit=cover` to all statically generated pages.
- Forced 16px input/textarea font size on small screens to prevent iOS zoom-on-focus.
- Added `touch-action: manipulation` on coarse pointers to reduce click delay and improve tap behavior.
- Improved mobile keyboard hints and autofill metadata on the contact form:
  - `autocomplete`
  - `inputmode`
  - `autocapitalize`
  - `enterkeyhint`

### Performance
- Generated responsive image variants for the main editorial, prestation, realization, article and logo assets.
- Injected static `width` / `height` on every HTML image to reduce layout shifts.
- Injected static `srcset` / `sizes` on non-logo images directly in prerendered HTML.
- Replaced the generic image preload with a page-relevant preload targeting the first eager/high-priority content image.
- Reduced unnecessary first-load DOM work by skipping client-side rerender of already prerendered default collection pages.

### Quality / consistency
- Added a reusable post-processing script for static HTML:
  - `scripts/postprocess-static-html.py`
- Kept the desktop visual identity intact while limiting changes to structural, SEO, mobile and performance improvements.

## Verification results after the final pass
- 0 indexed duplicate canonicals
- 0 indexed duplicate titles
- 0 indexed duplicate meta descriptions
- 0 HTML images missing `width` / `height`
- 0 non-logo HTML images missing `srcset`

## Files changed in this pass
- `scripts/app.js`
- `scripts/content.js`
- `scripts/prerender-static.js`
- `scripts/postprocess-static-html.py`
- `scripts/responsive-image-manifest.json`
- `styles/mobile-optimizations.css`
- all prerendered `*.html` pages
- generated responsive image files under `assets/images/**/_responsive/`
