from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote, unquote, urlparse
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / 'scripts' / 'responsive-image-manifest.json'
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
HTML_FILES = sorted(ROOT.rglob('*.html'))


CLASS_TO_SIZES = [
    ({'hero__media', 'page-hero__media', 'detail-hero__media'}, '100vw'),
    ({'home-news-feature__media'}, '(max-width: 720px) 100vw, 58vw'),
    ({'news-list-item__media'}, '(max-width: 720px) 100vw, 44vw'),
    ({'home-news-note__media'}, '(max-width: 720px) 100vw, 32vw'),
    ({'case-card__media', 'article-card__media', 'home-work-card__media', 'service-hub-card__media'}, '(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw'),
    ({'split-layout__visual', 'editorial-figure', 'home-definition__figure', 'gallery-grid__item', 'service-detail-minimal__media', 'service-accordion__figure', 'home-regulations__figure'}, '(max-width: 720px) 100vw, 50vw'),
]


def url_to_manifest_key(url: str | None) -> str | None:
    if not url:
        return None
    path = urlparse(url).path or url
    if not path:
        return None
    if path.startswith('data:'):
        return None
    path = unquote(path).lstrip('/')
    return path or None


def path_to_url(path: str) -> str:
    return '/' + '/'.join(quote(part, safe='') for part in path.split('/'))



def manifest_entry_for_url(url: str | None):
    key = url_to_manifest_key(url)
    if not key:
        return None
    return MANIFEST.get(key)



def responsive_srcset(entry: dict) -> str:
    return ', '.join(f"{path_to_url(variant['path'])} {variant['width']}w" for variant in entry['variants'])



def collect_classes(tag) -> set[str]:
    classes: set[str] = set()
    current = tag
    depth = 0
    while current is not None and depth < 6:
        for class_name in current.get('class', []):
            classes.add(class_name)
        current = current.parent if hasattr(current, 'parent') else None
        depth += 1
    return classes



def sizes_for_image(img) -> str | None:
    classes = collect_classes(img)
    # logos should not use responsive width heuristics
    if any('brand' in cls or 'logo' in cls for cls in classes):
        return None
    for class_group, sizes in CLASS_TO_SIZES:
        if classes & class_group:
            return sizes
    return '100vw'



def update_image(img) -> bool:
    changed = False
    src = img.get('src')
    entry = manifest_entry_for_url(src)
    if not entry:
        return False

    if not img.get('width'):
        img['width'] = str(entry['width'])
        changed = True
    if not img.get('height'):
        img['height'] = str(entry['height'])
        changed = True

    manifest_key = url_to_manifest_key(src) or ''
    is_logo = '/logo/' in f'/{manifest_key}'
    if not is_logo and not img.get('srcset'):
        img['srcset'] = responsive_srcset(entry)
        changed = True
    sizes = sizes_for_image(img)
    if sizes and img.get('srcset') and not img.get('sizes'):
        img['sizes'] = sizes
        changed = True
    return changed



def pick_preload_image(soup: BeautifulSoup):
    for img in soup.find_all('img'):
        src = img.get('src')
        key = url_to_manifest_key(src) or ''
        if '/logo/' in f'/{key}':
            continue
        loading = img.get('loading')
        fetchpriority = img.get('fetchpriority')
        if fetchpriority == 'high' or loading == 'eager':
            return img
    return None



def replace_preload_link(soup: BeautifulSoup) -> bool:
    changed = False
    head = soup.head
    if head is None:
        return False

    existing_preloads = list(head.find_all('link', rel='preload', attrs={'as': 'image'}))
    for preload in existing_preloads:
        preload.decompose()
        changed = True

    img = pick_preload_image(soup)
    if img is None:
        return changed

    if img.get('fetchpriority') != 'high':
        img['fetchpriority'] = 'high'
        changed = True

    preload = soup.new_tag('link')
    preload['rel'] = 'preload'
    preload['as'] = 'image'
    preload['href'] = img.get('src', '')
    if img.get('srcset'):
        preload['imagesrcset'] = img['srcset']
    if img.get('sizes'):
        preload['imagesizes'] = img['sizes']

    first_stylesheet = head.find('link', rel='stylesheet')
    if first_stylesheet:
        first_stylesheet.insert_before(preload)
    else:
        head.append(preload)
    return True



def ensure_og_image_dimensions(soup: BeautifulSoup) -> bool:
    changed = False
    og_image = soup.find('meta', attrs={'property': 'og:image'})
    if og_image is None:
        return False
    entry = manifest_entry_for_url(og_image.get('content'))
    if not entry:
        return False

    width_meta = soup.find('meta', attrs={'property': 'og:image:width'})
    height_meta = soup.find('meta', attrs={'property': 'og:image:height'})

    if width_meta is None:
        width_meta = soup.new_tag('meta')
        width_meta['property'] = 'og:image:width'
        og_image.insert_after(width_meta)
        changed = True
    if width_meta.get('content') != str(entry['width']):
        width_meta['content'] = str(entry['width'])
        changed = True

    if height_meta is None:
        height_meta = soup.new_tag('meta')
        height_meta['property'] = 'og:image:height'
        # place after width meta when width exists
        width_meta.insert_after(height_meta)
        changed = True
    if height_meta.get('content') != str(entry['height']):
        height_meta['content'] = str(entry['height'])
        changed = True

    return changed



def process_file(path: Path) -> bool:
    original = path.read_text(encoding='utf-8')
    soup = BeautifulSoup(original, 'html.parser')
    changed = False

    images = soup.find_all('img')
    for img in images:
        if update_image(img):
            changed = True

    if replace_preload_link(soup):
        changed = True

    if ensure_og_image_dimensions(soup):
        changed = True

    if not changed:
        return False

    html = str(soup)
    if original.lstrip().lower().startswith('<!doctype html>') and not html.lstrip().lower().startswith('<!doctype html>'):
        html = '<!doctype html>\n' + html
    path.write_text(html, encoding='utf-8')
    return True



def main() -> None:
    changed_files = 0
    for html_file in HTML_FILES:
        if process_file(html_file):
            changed_files += 1
    print(f'Processed {len(HTML_FILES)} HTML files; updated {changed_files}.')


if __name__ == '__main__':
    main()
