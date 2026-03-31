const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const contentSrc = fs.readFileSync(path.join(projectRoot, 'scripts', 'content.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(projectRoot, 'scripts', 'app.js'), 'utf8');
const patchedAppSrc = appSrc.replace(
  '  document.addEventListener("DOMContentLoaded", render);',
  '  window.__CONTROL_AIR_PRERENDER__ = { renderHeader, renderMain, renderFooter, renderCookieBanner, serviceCatalogEntries, state };'
);

if (patchedAppSrc === appSrc) {
  throw new Error('Unable to patch app.js for prerender exports.');
}

class ClassList {
  constructor() {
    this._set = new Set();
  }

  add(...tokens) {
    tokens.filter(Boolean).forEach((token) => this._set.add(String(token)));
  }

  remove(...tokens) {
    tokens.filter(Boolean).forEach((token) => this._set.delete(String(token)));
  }

  toggle(token, force) {
    const value = String(token);
    if (typeof force === 'boolean') {
      if (force) {
        this._set.add(value);
        return true;
      }
      this._set.delete(value);
      return false;
    }

    if (this._set.has(value)) {
      this._set.delete(value);
      return false;
    }

    this._set.add(value);
    return true;
  }

  contains(token) {
    return this._set.has(String(token));
  }

  toString() {
    return [...this._set].join(' ');
  }
}

class GenericNode {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.ownerDocument = ownerDocument;
    this.attributes = {};
    this.innerHTML = '';
    this.textContent = '';
    this.hidden = false;
    this.dataset = {};
    this.classList = new ClassList();
    this._parent = null;
  }

  get id() {
    return this.attributes.id || '';
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get type() {
    return this.attributes.type || '';
  }

  set type(value) {
    this.setAttribute('type', value);
  }

  setAttribute(name, value) {
    const attrName = String(name);
    const attrValue = String(value ?? '');
    this.attributes[attrName] = attrValue;

    if (attrName === 'id' && this.ownerDocument) {
      this.ownerDocument._registerId(attrValue, this);
    }

    if (attrName === 'class') {
      this.classList = new ClassList();
      attrValue
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token) => this.classList.add(token));
    }

    if (attrName.startsWith('data-')) {
      const dataKey = attrName
        .slice(5)
        .split('-')
        .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
        .join('');
      this.dataset[dataKey] = attrValue;
    }
  }

  getAttribute(name) {
    return this.attributes[String(name)];
  }

  appendChild(node) {
    if (!node) {
      return node;
    }

    node._parent = this;

    if (!this.children) {
      this.children = [];
    }

    this.children.push(node);
    return node;
  }

  removeChild(node) {
    if (!this.children) {
      return node;
    }

    const index = this.children.indexOf(node);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    return node;
  }

  remove() {
    if (this._parent && typeof this._parent.removeChild === 'function') {
      this._parent.removeChild(this);
    }

    const id = this.getAttribute('id');
    if (id && this.ownerDocument) {
      this.ownerDocument._unregisterId(id, this);
    }
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

class HeadManager extends GenericNode {
  constructor(ownerDocument) {
    super('head', ownerDocument);
    this.children = [];
  }

  appendChild(node) {
    super.appendChild(node);
    const id = node.getAttribute?.('id');
    if (id) {
      this.ownerDocument._registerId(id, node);
    }
    return node;
  }

  removeChild(node) {
    super.removeChild(node);
    const id = node.getAttribute?.('id');
    if (id) {
      this.ownerDocument._unregisterId(id, node);
    }
    return node;
  }

  querySelector(selector) {
    if (!selector) {
      return null;
    }

    if (selector.startsWith('#')) {
      return this.ownerDocument.getElementById(selector.slice(1));
    }

    const match = selector.match(/^([a-z0-9_-]+)(?:\[([a-zA-Z0-9:_-]+)=\"([^\"]*)\"\])?$/i);
    if (!match) {
      return null;
    }

    const [, tagName, attrName, attrValue] = match;
    return this.children.find((node) => {
      if (node.tagName !== String(tagName).toLowerCase()) {
        return false;
      }

      if (!attrName) {
        return true;
      }

      return String(node.getAttribute(attrName) || '') === String(attrValue || '');
    }) || null;
  }

  querySelectorAll(selector) {
    const first = this.querySelector(selector);
    return first ? [first] : [];
  }
}

class SimpleDocument {
  constructor(bodyPage) {
    this._ids = new Map();
    this.title = '';
    this.documentElement = new GenericNode('html', this);
    this.documentElement.lang = 'fr';
    this.documentElement.dataset = {};
    this.documentElement.classList = new ClassList();
    this.body = new GenericNode('body', this);
    this.body.dataset.page = bodyPage;
    this.body.classList = new ClassList();
    this.head = new HeadManager(this);
    this._bodyNodes = {
      'site-header': new GenericNode('div', this),
      main: new GenericNode('main', this),
      'site-footer': new GenericNode('div', this),
      'cookie-banner': new GenericNode('div', this)
    };

    Object.entries(this._bodyNodes).forEach(([id, node]) => {
      node.setAttribute('id', id);
      if (id === 'main') {
        node.tagName = 'main';
      }
    });
  }

  _registerId(id, node) {
    this._ids.set(String(id), node);
  }

  _unregisterId(id, node) {
    const key = String(id);
    if (this._ids.get(key) === node) {
      this._ids.delete(key);
    }
  }

  getElementById(id) {
    return this._ids.get(String(id)) || null;
  }

  createElement(tagName) {
    return new GenericNode(tagName, this);
  }

  querySelector(selector) {
    if (selector === 'main' || selector === '#main') {
      return this._bodyNodes.main;
    }

    if (selector.startsWith('#')) {
      return this.getElementById(selector.slice(1));
    }

    return null;
  }

  querySelectorAll() {
    return [];
  }

  addEventListener() {}
  removeEventListener() {}
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    }
  };
}

function createSandbox({ bodyPage, pathname, search = '', hash = '' }) {
  const document = new SimpleDocument(bodyPage);
  const localStorage = createLocalStorage();
  const location = {
    protocol: 'https:',
    hostname: 'www.control-air.fr',
    pathname,
    search,
    hash,
    replace(next) {
      this.pathname = String(next || '');
    }
  };

  const windowObj = {
    document,
    location,
    history: {
      replaceState(_state, _title, url) {
        if (!url) {
          return;
        }

        const parsed = new URL(String(url), 'https://www.control-air.fr');
        location.pathname = parsed.pathname;
        location.search = parsed.search;
        location.hash = parsed.hash;
      }
    },
    localStorage,
    navigator: {
      connection: { saveData: false },
      deviceMemory: 8,
      hardwareConcurrency: 8
    },
    matchMedia() {
      return {
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {}
      };
    },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(callback) {
      if (typeof callback === 'function') {
        callback(16);
      }
      return 1;
    },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console,
    URL,
    URLSearchParams,
    Intl,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI
  };

  const sandbox = {
    window: windowObj,
    document,
    localStorage,
    navigator: windowObj.navigator,
    location,
    history: windowObj.history,
    console,
    URL,
    URLSearchParams,
    Intl,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };

  vm.createContext(sandbox);
  vm.runInContext(contentSrc, sandbox, { filename: 'content.js' });
  vm.runInContext(patchedAppSrc, sandbox, { filename: 'app.js' });

  if (!windowObj.__CONTROL_AIR_PRERENDER__) {
    throw new Error('Prerender helpers were not exported.');
  }

  return sandbox;
}

function absolutizeMarkup(html) {
  return String(html || '').replace(/(src|href)=(["'])(?!https?:|mailto:|tel:|\/|#|data:|javascript:)([^"']+)\2/g, (_match, attr, quote, value) => {
    const normalized = `/${String(value).replace(/^\.\/+/, '').replace(/^\/+/, '')}`;
    return `${attr}=${quote}${normalized}${quote}`;
  });
}

function collectHead(document) {
  const result = {
    title: document.title || '',
    metas: [],
    links: [],
    structuredData: ''
  };

  for (const node of document.head.children) {
    if (node.tagName === 'meta') {
      result.metas.push({ ...node.attributes });
      continue;
    }

    if (node.tagName === 'link') {
      result.links.push({ ...node.attributes });
      continue;
    }

    if (node.tagName === 'script' && String(node.getAttribute('id') || '') === 'structured-data') {
      result.structuredData = String(node.textContent || '');
    }
  }

  return result;
}

function renderPage({ bodyPage, pathname, search = '', hash = '' }) {
  const sandbox = createSandbox({ bodyPage, pathname, search, hash });
  const { window, document } = sandbox;
  const ssr = window.__CONTROL_AIR_PRERENDER__;
  document.documentElement.lang = ssr.state.lang === 'en' ? 'en' : 'fr';
  ssr.renderHeader();
  ssr.renderMain();
  ssr.renderFooter();
  ssr.renderCookieBanner();

  return {
    htmlLang: document.documentElement.lang,
    performanceMode: document.documentElement.dataset.performanceMode || '',
    header: absolutizeMarkup(document.getElementById('site-header')?.innerHTML || ''),
    main: absolutizeMarkup(document.getElementById('main')?.innerHTML || ''),
    footer: absolutizeMarkup(document.getElementById('site-footer')?.innerHTML || ''),
    cookie: absolutizeMarkup(document.getElementById('cookie-banner')?.innerHTML || ''),
    cookieHidden: Boolean(document.getElementById('cookie-banner')?.hidden),
    head: collectHead(document)
  };
}

function renderMetaTag(meta) {
  const attrs = Object.entries(meta)
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, '&quot;')}"`)
    .join(' ');
  return `  <meta ${attrs} />`;
}

function renderLinkTag(link) {
  const attrs = Object.entries(link)
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, '&quot;')}"`)
    .join(' ');
  return `  <link ${attrs} />`;
}

function buildHtmlDocument({ bodyPage, pageData, includeHomeArrival = false, robots = null, canonical = null, extraHead = '' }) {
  const headMeta = pageData.head;
  const metas = [...headMeta.metas];
  const links = [...headMeta.links];

  if (robots) {
    const existingRobots = metas.find((item) => item.name === 'robots');
    if (existingRobots) {
      existingRobots.content = robots;
    } else {
      metas.push({ name: 'robots', content: robots });
    }
  }

  if (canonical) {
    const existingCanonical = links.find((item) => item.rel === 'canonical');
    if (existingCanonical) {
      existingCanonical.href = canonical;
    } else {
      links.push({ rel: 'canonical', href: canonical });
    }
  }

  const performanceAttr = pageData.performanceMode ? ` data-performance-mode="${pageData.performanceMode}"` : '';
  const cookieHiddenAttr = pageData.cookieHidden ? ' hidden' : '';

  return [
    '<!doctype html>',
    `<html lang="${pageData.htmlLang}"${performanceAttr}>`,
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    `  <title>${pageData.head.title}</title>`,
    '  <meta name="format-detection" content="telephone=no" />',
    '  <meta name="theme-color" content="#013f8c" />',
    '  <meta name="color-scheme" content="dark light" />',
    '  <meta name="referrer" content="strict-origin-when-cross-origin" />',
    ...metas.map(renderMetaTag),
    '  <link rel="icon" type="image/png" href="/assets/images/logo/control-air-mark.png" />',
    '  <link rel="preload" as="image" href="/assets/images/logo/control-air-mark.png" />',
    ...links.map(renderLinkTag),
    '  <link rel="stylesheet" href="/styles/site.css" />',
    includeHomeArrival ? '  <link rel="stylesheet" href="/styles/home-arrival.css" />' : null,
    '  <link rel="stylesheet" href="/styles/mobile-optimizations.css" />',
    pageData.head.structuredData ? `  <script id="structured-data" type="application/ld+json">${pageData.head.structuredData}</script>` : null,
    extraHead || null,
    '  <script defer src="/scripts/content.js"></script>',
    '  <script defer src="/scripts/app.js"></script>',
    '</head>',
    `<body data-page="${bodyPage}" data-prerendered="true">`,
    '  <a class="skip-link" href="#main" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;">Aller au contenu</a>',
    `  <div id="site-header">${pageData.header}</div>`,
    `  <main id="main">${pageData.main}</main>`,
    `  <div id="site-footer">${pageData.footer}</div>`,
    `  <div id="cookie-banner"${cookieHiddenAttr}>${pageData.cookie}</div>`,
    '</body>',
    '</html>'
  ].filter(Boolean).join('\n');
}

function writeFile(relativePath, content) {
  const targetPath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function buildFallbackShell({ bodyPage, title, description, canonical }) {
  return [
    '<!doctype html>',
    '<html lang="fr">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    `  <title>${title}</title>`,
    `  <meta name="description" content="${description}" />`,
    '  <meta name="robots" content="noindex,follow" />',
    '  <meta name="format-detection" content="telephone=no" />',
    '  <meta name="theme-color" content="#013f8c" />',
    '  <meta name="color-scheme" content="dark light" />',
    '  <meta name="referrer" content="strict-origin-when-cross-origin" />',
    `  <link rel="canonical" href="${canonical}" />`,
    '  <link rel="icon" type="image/png" href="/assets/images/logo/control-air-mark.png" />',
    '  <link rel="preload" as="image" href="/assets/images/logo/control-air-mark.png" />',
    '  <link rel="stylesheet" href="/styles/site.css" />',
    '  <link rel="stylesheet" href="/styles/mobile-optimizations.css" />',
    '  <script defer src="/scripts/content.js"></script>',
    '  <script defer src="/scripts/app.js"></script>',
    '</head>',
    `<body data-page="${bodyPage}">`,
    '  <a class="skip-link" href="#main" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;">Aller au contenu</a>',
    '  <div id="site-header"></div>',
    '  <main id="main"></main>',
    '  <div id="site-footer"></div>',
    '  <div id="cookie-banner" hidden></div>',
    '</body>',
    '</html>'
  ].join('\n');
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemap({ serviceEntries, works, articles }) {
  const today = '2026-03-31';
  const entries = [
    { loc: 'https://www.control-air.fr/', priority: '1.0', changefreq: 'monthly' },
    { loc: 'https://www.control-air.fr/prestations', priority: '0.9', changefreq: 'monthly' },
    { loc: 'https://www.control-air.fr/reglementation', priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://www.control-air.fr/realisations', priority: '0.9', changefreq: 'monthly' },
    { loc: 'https://www.control-air.fr/actualites', priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://www.control-air.fr/contact', priority: '0.9', changefreq: 'monthly' },
    { loc: 'https://www.control-air.fr/mentions-legales', priority: '0.4', changefreq: 'yearly' },
    { loc: 'https://www.control-air.fr/confidentialite', priority: '0.4', changefreq: 'yearly' },
    { loc: 'https://www.control-air.fr/cookies', priority: '0.4', changefreq: 'yearly' },
    ...serviceEntries.map((item) => ({ loc: `https://www.control-air.fr/prestations/${encodeURIComponent(item.slug)}`, priority: item.catalogType === 'core' ? '0.8' : '0.7', changefreq: 'monthly' })),
    ...works.map((item) => ({ loc: `https://www.control-air.fr/realisations/${encodeURIComponent(item.slug)}`, priority: '0.7', changefreq: 'monthly' })),
    ...articles.map((item) => ({ loc: `https://www.control-air.fr/actualites/${encodeURIComponent(item.slug)}`, priority: '0.6', changefreq: 'monthly' }))
  ];

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  entries.forEach((entry) => {
    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(entry.loc)}</loc>`);
    lines.push(`    <lastmod>${today}</lastmod>`);
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    lines.push(`    <priority>${entry.priority}</priority>`);
    lines.push('  </url>');
  });
  lines.push('</urlset>');
  return lines.join('\n');
}

function main() {
  const rootPages = [
    { output: 'index.html', bodyPage: 'home', pathname: '/', includeHomeArrival: true },
    { output: 'prestations.html', bodyPage: 'services', pathname: '/prestations' },
    { output: 'realisations.html', bodyPage: 'works', pathname: '/realisations' },
    { output: 'actualites.html', bodyPage: 'news', pathname: '/actualites' },
    { output: 'contact.html', bodyPage: 'contact', pathname: '/contact' },
    { output: 'mentions-legales.html', bodyPage: 'mentions-legales', pathname: '/mentions-legales' },
    { output: 'confidentialite.html', bodyPage: 'confidentialite', pathname: '/confidentialite' },
    { output: 'cookies.html', bodyPage: 'cookies', pathname: '/cookies' },
    { output: 'reglementation.html', bodyPage: 'regulations', pathname: '/reglementation' }
  ];

  const cleanUrlIndexCopies = {
    'prestations.html': path.join('prestations', 'index.html'),
    'realisations.html': path.join('realisations', 'index.html'),
    'actualites.html': path.join('actualites', 'index.html'),
    'contact.html': path.join('contact', 'index.html'),
    'mentions-legales.html': path.join('mentions-legales', 'index.html'),
    'confidentialite.html': path.join('confidentialite', 'index.html'),
    'cookies.html': path.join('cookies', 'index.html'),
    'reglementation.html': path.join('reglementation', 'index.html')
  };

  rootPages.forEach((page) => {
    const pageData = renderPage(page);
    const html = buildHtmlDocument({ bodyPage: page.bodyPage, pageData, includeHomeArrival: page.includeHomeArrival });
    writeFile(page.output, html);

    const cleanUrlCopy = cleanUrlIndexCopies[page.output];
    if (cleanUrlCopy) {
      writeFile(cleanUrlCopy, html);
    }
  });

  const listingSandbox = createSandbox({ bodyPage: 'services', pathname: '/prestations' });
  const listingSsr = listingSandbox.window.__CONTROL_AIR_PRERENDER__;
  const serviceEntries = listingSsr.serviceCatalogEntries();
  const content = listingSandbox.window.ControlAirContent;

  serviceEntries.forEach((item) => {
    const pathname = `/prestations/${encodeURIComponent(item.slug)}`;
    const pageData = renderPage({ bodyPage: 'service-detail', pathname });
    const html = buildHtmlDocument({ bodyPage: 'service-detail', pageData });
    writeFile(path.join('prestations', item.slug, 'index.html'), html);
  });

  (content.works || []).forEach((item) => {
    const pathname = `/realisations/${encodeURIComponent(item.slug)}`;
    const pageData = renderPage({ bodyPage: 'realisation', pathname });
    const html = buildHtmlDocument({ bodyPage: 'realisation', pageData });
    writeFile(path.join('realisations', item.slug, 'index.html'), html);
  });

  (content.articles || []).forEach((item) => {
    const pathname = `/actualites/${encodeURIComponent(item.slug)}`;
    const pageData = renderPage({ bodyPage: 'article', pathname });
    const html = buildHtmlDocument({ bodyPage: 'article', pageData });
    writeFile(path.join('actualites', item.slug, 'index.html'), html);
  });

  writeFile(
    'prestation.html',
    buildFallbackShell({
      bodyPage: 'service-detail',
      title: 'Prestation - Control\'Air',
      description: 'Page technique de prévisualisation pour une prestation Control\'Air.',
      canonical: 'https://www.control-air.fr/prestations'
    })
  );

  writeFile(
    'realisation.html',
    buildFallbackShell({
      bodyPage: 'realisation',
      title: 'Réalisation - Control\'Air',
      description: 'Page technique de prévisualisation pour une réalisation Control\'Air.',
      canonical: 'https://www.control-air.fr/realisations'
    })
  );

  writeFile(
    'article.html',
    buildFallbackShell({
      bodyPage: 'article',
      title: 'Article - Control\'Air',
      description: 'Page technique de prévisualisation pour un article Control\'Air.',
      canonical: 'https://www.control-air.fr/actualites'
    })
  );

  writeFile(
    'vercel.json',
    JSON.stringify(
      {
        cleanUrls: true,
        headers: [
          {
            source: '/(.*)',
            headers: [
              { key: 'X-Content-Type-Options', value: 'nosniff' },
              { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
              { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
              { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
            ]
          },
          {
            source: '/assets/(.*)',
            headers: [
              { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }
            ]
          },
          {
            source: '/styles/(.*)',
            headers: [
              { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }
            ]
          },
          {
            source: '/scripts/(.*)',
            headers: [
              { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }
            ]
          }
        ]
      },
      null,
      2
    ) + '\n'
  );

  writeFile('sitemap.xml', buildSitemap({ serviceEntries, works: content.works || [], articles: content.articles || [] }));
}

main();
