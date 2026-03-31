
(() => {
  const content = window.ControlAirContent || {};
  const state = {
    lang: localStorage.getItem("controlAirLang") === "en" ? "en" : "fr",
    worksFilters: {
      equipment: "all",
      intervention: "all"
    },
    newsFilter: "all",
    hasCompletedInitialRender: false,
    contactDraft: null
  };

  const legacyRoutes = {
    home: "index.html",
    services: "prestations.html",
    regulations: "reglementation.html",
    works: "realisations.html",
    news: "actualites.html",
    contact: "contact.html",
    legalMentions: "mentions-legales.html",
    legalPrivacy: "confidentialite.html",
    legalCookies: "cookies.html"
  };

  const prettyRoutes = {
    home: "/",
    services: "/prestations",
    regulations: "/reglementation",
    works: "/realisations",
    news: "/actualites",
    contact: "/contact",
    legalMentions: "/mentions-legales",
    legalPrivacy: "/confidentialite",
    legalCookies: "/cookies"
  };

  const sectionAnchors = {
    services: "prestations",
    regulations: "reglementation"
  };

  const siteSettings = {
    canonicalOrigin: String(content.company?.website || "https://www.control-air.fr").replace(/\/$/, ""),
    defaultSocialImage: content.company?.shareImage || "assets/images/logo/visu-control-air.ce3d7314.png"
  };

  const performanceModeRank = {
    full: 0,
    balanced: 1,
    light: 2
  };

  const performanceState = {
    reducedMotion: false,
    mode: "full",
    reason: "default",
    renderReady: false,
    headerProgress: "",
    runtimeProbeSources: new Set(),
    interactionProbeBound: false,
    processStorySections: [],
    processStoryEntries: new WeakMap(),
    processStoryVisibilityObserver: null,
    processStoryResizeObserver: null,
    marqueeObserver: null,
    mediaObserver: null
  };

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const lenisScriptSrc = "https://unpkg.com/lenis@latest/dist/lenis.min.js";
  let lenisScriptPromise = null;

  function currentViewportWidth() {
    const width = Math.max(
      Number(window.innerWidth || 0),
      Number(document.documentElement?.clientWidth || 0)
    );
    return width || 1280;
  }

  function isCoarsePointerDevice() {
    return Boolean(coarsePointerQuery.matches);
  }

  function canUseSmoothScrollOnCurrentDevice() {
    return canUseEnhancedMotion() && !isCoarsePointerDevice() && currentViewportWidth() > 980;
  }

  function ensureLenisScript() {
    if (typeof window.Lenis === "function") {
      return Promise.resolve(true);
    }

    if (lenisScriptPromise) {
      return lenisScriptPromise;
    }

    lenisScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = lenisScriptSrc;
      script.async = true;
      script.onload = () => resolve(typeof window.Lenis === "function");
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

    return lenisScriptPromise;
  }

  function normalizePerformanceMode(mode) {
    return Object.prototype.hasOwnProperty.call(performanceModeRank, mode) ? mode : "full";
  }

  function maxPerformanceMode(first, second) {
    const left = normalizePerformanceMode(first);
    const right = normalizePerformanceMode(second);
    return performanceModeRank[right] > performanceModeRank[left] ? right : left;
  }

  function detectInitialPerformanceMode() {
    if (performanceState.reducedMotion) {
      return "light";
    }

    let mode = "full";
    const saveData = Boolean(navigator.connection?.saveData);
    const memory = Number(navigator.deviceMemory || 0);
    const cores = Number(navigator.hardwareConcurrency || 0);
    const viewportWidth = currentViewportWidth();
    const coarsePointer = isCoarsePointerDevice();

    if (saveData) {
      mode = "light";
    }

    if (memory) {
      mode = memory <= 2 ? "light" : memory <= 4 ? maxPerformanceMode(mode, "balanced") : mode;
    }

    if (cores) {
      mode = cores <= 2 ? "light" : cores <= 4 ? maxPerformanceMode(mode, "balanced") : mode;
    }

    if (coarsePointer || viewportWidth <= 980) {
      mode = maxPerformanceMode(mode, viewportWidth <= 720 ? "light" : "balanced");
    }

    if (coarsePointer && viewportWidth <= 720) {
      mode = "light";
    }

    return mode;
  }

  function setPerformanceMode(nextMode, reason = "adaptive", options = {}) {
    const allowUpgrade = options.allowUpgrade === true;
    const normalized = performanceState.reducedMotion ? "light" : normalizePerformanceMode(nextMode);
    const resolved = allowUpgrade ? normalized : maxPerformanceMode(performanceState.mode, normalized);

    if (resolved === performanceState.mode && reason === performanceState.reason) {
      return;
    }

    performanceState.mode = resolved;
    performanceState.reason = reason;
    document.documentElement.dataset.performanceMode = resolved;
    document.documentElement.classList.toggle("reduced-motion", performanceState.reducedMotion);

    syncPerformanceModeAfterChange();
  }

  function bindMotionPreferenceObserver() {
    const applyPreference = (matches) => {
      performanceState.reducedMotion = matches;
      const nextMode = matches ? "light" : detectInitialPerformanceMode();
      setPerformanceMode(nextMode, matches ? "prefers-reduced-motion" : "motion-preference-reset", { allowUpgrade: true });
    };

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", (event) => {
        applyPreference(Boolean(event.matches));
      });
      return;
    }

    if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener((event) => {
        applyPreference(Boolean(event.matches));
      });
    }
  }

  function canUseEnhancedMotion() {
    return !performanceState.reducedMotion && performanceState.mode === "full";
  }

  function startRuntimePerformanceProbe(source = "load") {
    if (performanceState.reducedMotion || performanceState.runtimeProbeSources.has(source)) {
      return;
    }

    performanceState.runtimeProbeSources.add(source);

    let frames = 0;
    let longFrames = 0;
    let totalDelta = 0;
    let lastTimestamp = 0;
    const sampleSize = source === "interaction" ? 48 : 72;

    const measure = (timestamp) => {
      if (lastTimestamp) {
        const delta = timestamp - lastTimestamp;
        totalDelta += delta;
        if (delta > 24) {
          longFrames += 1;
        }
      }

      lastTimestamp = timestamp;
      frames += 1;

      if (frames < sampleSize) {
        window.requestAnimationFrame(measure);
        return;
      }

      const averageDelta = totalDelta / Math.max(1, sampleSize - 1);
      let suggestedMode = null;

      if (averageDelta > 22 || longFrames >= Math.max(7, Math.floor(sampleSize * 0.18))) {
        suggestedMode = "light";
      } else if (averageDelta > 18.5 || longFrames >= Math.max(3, Math.floor(sampleSize * 0.1))) {
        suggestedMode = "balanced";
      }

      if (suggestedMode) {
        setPerformanceMode(suggestedMode, `runtime-${source}`);
      }
    };

    window.requestAnimationFrame(measure);
  }

  function observeFirstUserInputForPerformance() {
    if (performanceState.interactionProbeBound) {
      return;
    }

    performanceState.interactionProbeBound = true;
    const options = { passive: true, once: true };
    const trigger = () => startRuntimePerformanceProbe("interaction");

    window.addEventListener("wheel", trigger, options);
    window.addEventListener("touchstart", trigger, options);
    window.addEventListener("pointerdown", trigger, options);
    window.addEventListener("keydown", trigger, options);
  }

  performanceState.reducedMotion = reducedMotionQuery.matches;
  performanceState.mode = detectInitialPerformanceMode();
  performanceState.reason = "initial";
  document.documentElement.dataset.performanceMode = performanceState.mode;
  document.documentElement.classList.toggle("reduced-motion", performanceState.reducedMotion);
  bindMotionPreferenceObserver();

  function isLocalPreview() {
    const hostname = String(window.location.hostname || "").toLowerCase();
    return window.location.protocol === "file:" || hostname === "" || hostname === "localhost" || hostname === "127.0.0.1";
  }

  function routePath(key) {
    const map = isLocalPreview() ? legacyRoutes : prettyRoutes;
    return map[key] || legacyRoutes.home;
  }

  function sectionHref(key) {
    const anchor = sectionAnchors[key];
    if (!anchor) {
      return routePath("home");
    }

    const homePath = routePath("home");
    return `${homePath}#${anchor}`;
  }

  const routes = new Proxy(
    {},
    {
      get(_, key) {
        return routePath(String(key));
      }
    }
  );

  const serviceSlugs = {
    "sorbonne-reception": "essai-reception-sorbonne-laboratoire",
    "sorbonne-routine": "essai-routine-sorbonne-laboratoire",
    "recirculation-routine": "controle-sorbonne-recirculation-routine",
    "hotte-controle": "controle-periodique-hotte-chimie",
    "bras-controle": "controle-periodique-bras-orientable-aspirant",
    "armoire-controle": "controle-periodique-armoire-ventilee",
    "maintenance-preventive": "maintenance-preventive-sorbonnes-laboratoire",
    "audit-aeraulique": "audit-aeraulique-ventilation",
    "prelevement-polluants": "prelevement-polluants-organiques"
  };

  const pageTitles = {
    home: {
      fr: "Control'Air - Contrôle réglementaire des sorbonnes et équipements ventilés",
      en: "Control'Air  -  Regulatory inspection of fume hoods and ventilated equipment"
    },
    services: {
      fr: "Nos prestations - Control'Air",
      en: "Our services - Control'Air"
    },
    serviceDetail: {
      fr: "Prestation - Control'Air",
      en: "Service  -  Control'Air"
    },
    regulations: {
      fr: "Réglementation - Control'Air",
      en: "Regulations  -  Control'Air"
    },
    works: {
      fr: "Réalisations - Control'Air",
      en: "Projects  -  Control'Air"
    },
    work: {
      fr: "Réalisation - Control'Air",
      en: "Project  -  Control'Air"
    },
    news: {
      fr: "Nos actualités - Control'Air",
      en: "Latest news - Control'Air"
    },
    article: {
      fr: "Article - Control'Air",
      en: "Article - Control'Air"
    },
    contact: {
      fr: "Contact et devis - Control'Air",
      en: "Contact and quote  -  Control'Air"
    },
    legal: {
      fr: "Mentions, confidentialité et cookies - Control'Air",
      en: "Legal, privacy and cookies  -  Control'Air"
    }
  };

  function lang() {
    return state.lang === "en" ? "en" : "fr";
  }

  function rootText(path, root) {
    return path.split(".").reduce((value, key) => {
      if (value && typeof value === "object" && key in value) {
        return value[key];
      }

      return "";
    }, root);
  }

  function tr(path) {
    const currentLang = lang();
    const fromUi = rootText(path, content.ui?.[currentLang]);
    if (fromUi) {
      return fromUi;
    }

    const fromExtra = rootText(path, content.extraUi?.[currentLang]);
    if (fromExtra) {
      return fromExtra;
    }

    return "";
  }

  function localize(value, forcedLang) {
    const activeLang = forcedLang || lang();

    if (value == null) {
      return "";
    }

    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => localize(item, activeLang));
    }

    if (typeof value === "object") {
      if (activeLang in value || "fr" in value || "en" in value) {
        return value[activeLang] || value.fr || value.en || "";
      }

      if ("value" in value) {
        return value[activeLang] || value.fr || value.en || value.value || "";
      }
    }

    return String(value);
  }

  function stableFilterValue(value) {
    if (value == null) {
      return "";
    }

    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => stableFilterValue(item)).join("|");
    }

    if (typeof value === "object") {
      if ("fr" in value || "en" in value) {
        return `fr:${String(value.fr || "")}|en:${String(value.en || "")}`;
      }

      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }

    return String(value);
  }

  function asset(path) {
    const rawPath = String(path || "");
    if (!rawPath) {
      return "";
    }

    if (/^(?:[a-z]+:)?\/\//i.test(rawPath) || /^(data:|blob:|mailto:|tel:|#)/i.test(rawPath)) {
      return rawPath;
    }

    const normalizedPath = rawPath
      .replace(/\\/g, "/")
      .replace(/^\.\/+/, "")
      .replace(/^\/+/, "");

    if (window.location.protocol === "file:") {
      return encodeURI(normalizedPath);
    }

    return `/${encodeURI(normalizedPath)}`;
  }


  const responsiveImageManifest = {"assets/images/editorial/cleanroom-wide.jpg":{"width":2200,"height":1467,"variants":[{"width":360,"path":"assets/images/editorial/_responsive/cleanroom-wide-360w.jpg"},{"width":640,"path":"assets/images/editorial/_responsive/cleanroom-wide-640w.jpg"},{"width":1200,"path":"assets/images/editorial/_responsive/cleanroom-wide-1200w.jpg"},{"width":2000,"path":"assets/images/editorial/_responsive/cleanroom-wide-2000w.jpg"},{"width":2200,"path":"assets/images/editorial/cleanroom-wide.jpg"}]},"assets/images/editorial/industrial-rooftop.jpg":{"width":2200,"height":1467,"variants":[{"width":360,"path":"assets/images/editorial/_responsive/industrial-rooftop-360w.jpg"},{"width":640,"path":"assets/images/editorial/_responsive/industrial-rooftop-640w.jpg"},{"width":1200,"path":"assets/images/editorial/_responsive/industrial-rooftop-1200w.jpg"},{"width":2000,"path":"assets/images/editorial/_responsive/industrial-rooftop-2000w.jpg"},{"width":2200,"path":"assets/images/editorial/industrial-rooftop.jpg"}]},"assets/images/editorial/lab-bench.jpg":{"width":2200,"height":1467,"variants":[{"width":360,"path":"assets/images/editorial/_responsive/lab-bench-360w.jpg"},{"width":640,"path":"assets/images/editorial/_responsive/lab-bench-640w.jpg"},{"width":1200,"path":"assets/images/editorial/_responsive/lab-bench-1200w.jpg"},{"width":2000,"path":"assets/images/editorial/_responsive/lab-bench-2000w.jpg"},{"width":2200,"path":"assets/images/editorial/lab-bench.jpg"}]},"assets/images/editorial/lab-hall.jpg":{"width":1467,"height":2200,"variants":[{"width":360,"path":"assets/images/editorial/_responsive/lab-hall-360w.jpg"},{"width":640,"path":"assets/images/editorial/_responsive/lab-hall-640w.jpg"},{"width":960,"path":"assets/images/editorial/_responsive/lab-hall-960w.jpg"},{"width":1200,"path":"assets/images/editorial/_responsive/lab-hall-1200w.jpg"},{"width":1467,"path":"assets/images/editorial/lab-hall.jpg"}]},"assets/images/editorial/machine-room.jpg":{"width":2200,"height":1651,"variants":[{"width":360,"path":"assets/images/editorial/_responsive/machine-room-360w.jpg"},{"width":640,"path":"assets/images/editorial/_responsive/machine-room-640w.jpg"},{"width":1200,"path":"assets/images/editorial/_responsive/machine-room-1200w.jpg"},{"width":2000,"path":"assets/images/editorial/_responsive/machine-room-2000w.jpg"},{"width":2200,"path":"assets/images/editorial/machine-room.jpg"}]},"assets/images/editorial/pipes-room.jpg":{"width":2200,"height":1650,"variants":[{"width":360,"path":"assets/images/editorial/_responsive/pipes-room-360w.jpg"},{"width":640,"path":"assets/images/editorial/_responsive/pipes-room-640w.jpg"},{"width":1200,"path":"assets/images/editorial/_responsive/pipes-room-1200w.jpg"},{"width":2000,"path":"assets/images/editorial/_responsive/pipes-room-2000w.jpg"},{"width":2200,"path":"assets/images/editorial/pipes-room.jpg"}]},"assets/images/editorial/technician-machine.jpg":{"width":2200,"height":1467,"variants":[{"width":360,"path":"assets/images/editorial/_responsive/technician-machine-360w.jpg"},{"width":640,"path":"assets/images/editorial/_responsive/technician-machine-640w.jpg"},{"width":1200,"path":"assets/images/editorial/_responsive/technician-machine-1200w.jpg"},{"width":2000,"path":"assets/images/editorial/_responsive/technician-machine-2000w.jpg"},{"width":2200,"path":"assets/images/editorial/technician-machine.jpg"}]},"assets/images/editorial/glassware.jpg":{"width":2200,"height":1467,"variants":[{"width":360,"path":"assets/images/editorial/_responsive/glassware-360w.jpg"},{"width":640,"path":"assets/images/editorial/_responsive/glassware-640w.jpg"},{"width":1200,"path":"assets/images/editorial/_responsive/glassware-1200w.jpg"},{"width":2000,"path":"assets/images/editorial/_responsive/glassware-2000w.jpg"},{"width":2200,"path":"assets/images/editorial/glassware.jpg"}]},"assets/images/logo/control-air-mark.png":{"width":128,"height":128,"variants":[{"width":128,"path":"assets/images/logo/control-air-mark.png"}]},"assets/images/logo/visu-control-air.ce3d7314.png":{"width":500,"height":365,"variants":[{"width":360,"path":"assets/images/logo/_responsive/visu-control-air.ce3d7314-360w.png"},{"width":480,"path":"assets/images/logo/_responsive/visu-control-air.ce3d7314-480w.png"},{"width":500,"path":"assets/images/logo/visu-control-air.ce3d7314.png"}]},"assets/images/logo/grand logo.png":{"width":1240,"height":569,"variants":[{"width":360,"path":"assets/images/logo/_responsive/grand logo-360w.png"},{"width":640,"path":"assets/images/logo/_responsive/grand logo-640w.png"},{"width":960,"path":"assets/images/logo/_responsive/grand logo-960w.png"},{"width":1200,"path":"assets/images/logo/_responsive/grand logo-1200w.png"},{"width":1240,"path":"assets/images/logo/grand logo.png"}]},"assets/images/realisations/atelier-technique.jpg":{"width":1400,"height":933,"variants":[{"width":360,"path":"assets/images/realisations/_responsive/atelier-technique-360w.jpg"},{"width":640,"path":"assets/images/realisations/_responsive/atelier-technique-640w.jpg"},{"width":960,"path":"assets/images/realisations/_responsive/atelier-technique-960w.jpg"},{"width":1200,"path":"assets/images/realisations/_responsive/atelier-technique-1200w.jpg"},{"width":1400,"path":"assets/images/realisations/atelier-technique.jpg"}]},"assets/images/realisations/entrepot-moderne.jpg":{"width":1400,"height":1050,"variants":[{"width":360,"path":"assets/images/realisations/_responsive/entrepot-moderne-360w.jpg"},{"width":640,"path":"assets/images/realisations/_responsive/entrepot-moderne-640w.jpg"},{"width":960,"path":"assets/images/realisations/_responsive/entrepot-moderne-960w.jpg"},{"width":1200,"path":"assets/images/realisations/_responsive/entrepot-moderne-1200w.jpg"},{"width":1400,"path":"assets/images/realisations/entrepot-moderne.jpg"}]},"assets/images/realisations/essai-reception-confinement.jpg":{"width":898,"height":476,"variants":[{"width":360,"path":"assets/images/realisations/_responsive/essai-reception-confinement-360w.jpg"},{"width":480,"path":"assets/images/realisations/_responsive/essai-reception-confinement-480w.jpg"},{"width":640,"path":"assets/images/realisations/_responsive/essai-reception-confinement-640w.jpg"},{"width":768,"path":"assets/images/realisations/_responsive/essai-reception-confinement-768w.jpg"},{"width":898,"path":"assets/images/realisations/essai-reception-confinement.jpg"}]},"assets/images/realisations/facade-industrielle.jpg":{"width":1400,"height":2100,"variants":[{"width":360,"path":"assets/images/realisations/_responsive/facade-industrielle-360w.jpg"},{"width":640,"path":"assets/images/realisations/_responsive/facade-industrielle-640w.jpg"},{"width":960,"path":"assets/images/realisations/_responsive/facade-industrielle-960w.jpg"},{"width":1200,"path":"assets/images/realisations/_responsive/facade-industrielle-1200w.jpg"},{"width":1400,"path":"assets/images/realisations/facade-industrielle.jpg"}]},"assets/images/realisations/installation-industrielle.jpg":{"width":1400,"height":933,"variants":[{"width":360,"path":"assets/images/realisations/_responsive/installation-industrielle-360w.jpg"},{"width":640,"path":"assets/images/realisations/_responsive/installation-industrielle-640w.jpg"},{"width":960,"path":"assets/images/realisations/_responsive/installation-industrielle-960w.jpg"},{"width":1200,"path":"assets/images/realisations/_responsive/installation-industrielle-1200w.jpg"},{"width":1400,"path":"assets/images/realisations/installation-industrielle.jpg"}]},"assets/images/realisations/site-industriel-moderne.jpg":{"width":1400,"height":933,"variants":[{"width":360,"path":"assets/images/realisations/_responsive/site-industriel-moderne-360w.jpg"},{"width":640,"path":"assets/images/realisations/_responsive/site-industriel-moderne-640w.jpg"},{"width":960,"path":"assets/images/realisations/_responsive/site-industriel-moderne-960w.jpg"},{"width":1200,"path":"assets/images/realisations/_responsive/site-industriel-moderne-1200w.jpg"},{"width":1400,"path":"assets/images/realisations/site-industriel-moderne.jpg"}]},"assets/images/realisations/controle-sorbonne-mesure.jpg":{"width":1500,"height":1000,"variants":[{"width":360,"path":"assets/images/realisations/_responsive/controle-sorbonne-mesure-360w.jpg"},{"width":640,"path":"assets/images/realisations/_responsive/controle-sorbonne-mesure-640w.jpg"},{"width":960,"path":"assets/images/realisations/_responsive/controle-sorbonne-mesure-960w.jpg"},{"width":1200,"path":"assets/images/realisations/_responsive/controle-sorbonne-mesure-1200w.jpg"},{"width":1500,"path":"assets/images/realisations/controle-sorbonne-mesure.jpg"}]},"assets/images/realisations/controle-technique-laboratoire.jpg":{"width":1500,"height":1000,"variants":[{"width":360,"path":"assets/images/realisations/_responsive/controle-technique-laboratoire-360w.jpg"},{"width":640,"path":"assets/images/realisations/_responsive/controle-technique-laboratoire-640w.jpg"},{"width":960,"path":"assets/images/realisations/_responsive/controle-technique-laboratoire-960w.jpg"},{"width":1200,"path":"assets/images/realisations/_responsive/controle-technique-laboratoire-1200w.jpg"},{"width":1500,"path":"assets/images/realisations/controle-technique-laboratoire.jpg"}]},"assets/images/actualites/eprouvettes-laboratoire.jpg":{"width":1400,"height":2158,"variants":[{"width":360,"path":"assets/images/actualites/_responsive/eprouvettes-laboratoire-360w.jpg"},{"width":640,"path":"assets/images/actualites/_responsive/eprouvettes-laboratoire-640w.jpg"},{"width":960,"path":"assets/images/actualites/_responsive/eprouvettes-laboratoire-960w.jpg"},{"width":1200,"path":"assets/images/actualites/_responsive/eprouvettes-laboratoire-1200w.jpg"},{"width":1400,"path":"assets/images/actualites/eprouvettes-laboratoire.jpg"}]},"assets/images/actualites/essai-reception-technique.jpg":{"width":898,"height":476,"variants":[{"width":360,"path":"assets/images/actualites/_responsive/essai-reception-technique-360w.jpg"},{"width":480,"path":"assets/images/actualites/_responsive/essai-reception-technique-480w.jpg"},{"width":640,"path":"assets/images/actualites/_responsive/essai-reception-technique-640w.jpg"},{"width":768,"path":"assets/images/actualites/_responsive/essai-reception-technique-768w.jpg"},{"width":898,"path":"assets/images/actualites/essai-reception-technique.jpg"}]},"assets/images/actualites/intervention-site-technique.jpg":{"width":1400,"height":933,"variants":[{"width":360,"path":"assets/images/actualites/_responsive/intervention-site-technique-360w.jpg"},{"width":640,"path":"assets/images/actualites/_responsive/intervention-site-technique-640w.jpg"},{"width":960,"path":"assets/images/actualites/_responsive/intervention-site-technique-960w.jpg"},{"width":1200,"path":"assets/images/actualites/_responsive/intervention-site-technique-1200w.jpg"},{"width":1400,"path":"assets/images/actualites/intervention-site-technique.jpg"}]},"assets/images/actualites/verrerie-laboratoire.jpg":{"width":1400,"height":933,"variants":[{"width":360,"path":"assets/images/actualites/_responsive/verrerie-laboratoire-360w.jpg"},{"width":640,"path":"assets/images/actualites/_responsive/verrerie-laboratoire-640w.jpg"},{"width":960,"path":"assets/images/actualites/_responsive/verrerie-laboratoire-960w.jpg"},{"width":1200,"path":"assets/images/actualites/_responsive/verrerie-laboratoire-1200w.jpg"},{"width":1400,"path":"assets/images/actualites/verrerie-laboratoire.jpg"}]},"assets/images/actualites/controle-sorbonne-technique.jpg":{"width":1500,"height":1000,"variants":[{"width":360,"path":"assets/images/actualites/_responsive/controle-sorbonne-technique-360w.jpg"},{"width":640,"path":"assets/images/actualites/_responsive/controle-sorbonne-technique-640w.jpg"},{"width":960,"path":"assets/images/actualites/_responsive/controle-sorbonne-technique-960w.jpg"},{"width":1200,"path":"assets/images/actualites/_responsive/controle-sorbonne-technique-1200w.jpg"},{"width":1500,"path":"assets/images/actualites/controle-sorbonne-technique.jpg"}]},"assets/images/prestation/Essai de routine/essai_reception.0e520cff.png":{"width":795,"height":438,"variants":[{"width":360,"path":"assets/images/prestation/Essai de routine/_responsive/essai_reception.0e520cff-360w.png"},{"width":480,"path":"assets/images/prestation/Essai de routine/_responsive/essai_reception.0e520cff-480w.png"},{"width":640,"path":"assets/images/prestation/Essai de routine/_responsive/essai_reception.0e520cff-640w.png"},{"width":768,"path":"assets/images/prestation/Essai de routine/_responsive/essai_reception.0e520cff-768w.png"},{"width":795,"path":"assets/images/prestation/Essai de routine/essai_reception.0e520cff.png"}]},"assets/images/prestation/Essai de routine/mesure_vitesse_air_frontale.b137f1bc (1).jpg":{"width":1500,"height":1000,"variants":[{"width":360,"path":"assets/images/prestation/Essai de routine/_responsive/mesure_vitesse_air_frontale.b137f1bc (1)-360w.jpg"},{"width":640,"path":"assets/images/prestation/Essai de routine/_responsive/mesure_vitesse_air_frontale.b137f1bc (1)-640w.jpg"},{"width":960,"path":"assets/images/prestation/Essai de routine/_responsive/mesure_vitesse_air_frontale.b137f1bc (1)-960w.jpg"},{"width":1200,"path":"assets/images/prestation/Essai de routine/_responsive/mesure_vitesse_air_frontale.b137f1bc (1)-1200w.jpg"},{"width":1500,"path":"assets/images/prestation/Essai de routine/mesure_vitesse_air_frontale.b137f1bc (1).jpg"}]},"assets/images/prestation/Essai de réception/mesure_confinement_gaz_traceur_SF6.39f9232a.jpg":{"width":898,"height":476,"variants":[{"width":360,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_confinement_gaz_traceur_SF6.39f9232a-360w.jpg"},{"width":480,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_confinement_gaz_traceur_SF6.39f9232a-480w.jpg"},{"width":640,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_confinement_gaz_traceur_SF6.39f9232a-640w.jpg"},{"width":768,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_confinement_gaz_traceur_SF6.39f9232a-768w.jpg"},{"width":898,"path":"assets/images/prestation/Essai de réception/mesure_confinement_gaz_traceur_SF6.39f9232a.jpg"}]},"assets/images/prestation/Essai de réception/mesure_vitesse_air_ambiante.862f7a01.jpg":{"width":1500,"height":1000,"variants":[{"width":360,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_vitesse_air_ambiante.862f7a01-360w.jpg"},{"width":640,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_vitesse_air_ambiante.862f7a01-640w.jpg"},{"width":960,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_vitesse_air_ambiante.862f7a01-960w.jpg"},{"width":1200,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_vitesse_air_ambiante.862f7a01-1200w.jpg"},{"width":1500,"path":"assets/images/prestation/Essai de réception/mesure_vitesse_air_ambiante.862f7a01.jpg"}]},"assets/images/prestation/Essai de réception/mesure_vitesse_air_frontale.b137f1bc.jpg":{"width":1500,"height":1000,"variants":[{"width":360,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_vitesse_air_frontale.b137f1bc-360w.jpg"},{"width":640,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_vitesse_air_frontale.b137f1bc-640w.jpg"},{"width":960,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_vitesse_air_frontale.b137f1bc-960w.jpg"},{"width":1200,"path":"assets/images/prestation/Essai de réception/_responsive/mesure_vitesse_air_frontale.b137f1bc-1200w.jpg"},{"width":1500,"path":"assets/images/prestation/Essai de réception/mesure_vitesse_air_frontale.b137f1bc.jpg"}]}};

  function responsiveImageMeta(path) {
    const normalized = String(path || "").replace(/^\/+/, "");
    return responsiveImageManifest[normalized] || null;
  }

  function responsiveImageSrcset(path) {
    const meta = responsiveImageMeta(path);
    if (!meta || !Array.isArray(meta.variants) || !meta.variants.length) {
      return "";
    }

    return meta.variants
      .filter((entry) => entry && entry.width && entry.path)
      .sort((left, right) => Number(left.width || 0) - Number(right.width || 0))
      .map((entry) => `${asset(entry.path)} ${Number(entry.width)}w`)
      .join(", ");
  }

  function responsiveImageSizesForElement(element) {
    if (!element || typeof element.closest !== "function") {
      return "100vw";
    }

    if (element.closest('.hero__media, .page-hero__media, .detail-hero__media')) {
      return '100vw';
    }

    if (element.closest('.home-news-feature__media')) {
      return '(max-width: 720px) 100vw, 58vw';
    }

    if (element.closest('.news-list-item__media')) {
      return '(max-width: 720px) 100vw, 44vw';
    }

    if (element.closest('.home-news-note__media')) {
      return '(max-width: 720px) 100vw, 32vw';
    }

    if (element.closest('.case-card__media, .article-card__media, .home-work-card__media, .service-hub-card__media')) {
      return '(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw';
    }

    if (element.closest('.split-layout__visual, .editorial-figure, .home-definition__figure, .gallery-grid__item, .service-detail-minimal__media, .service-accordion__figure')) {
      return '(max-width: 720px) 100vw, 50vw';
    }

    return '100vw';
  }

  function applyResponsiveImages(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== 'function') {
      return;
    }

    scope.querySelectorAll('img[src]').forEach((img) => {
      const src = String(img.getAttribute('src') || '').replace(/^\/+/, '');
      const meta = responsiveImageMeta(src);
      if (!meta) {
        return;
      }

      if (!img.getAttribute('width') && meta.width) {
        img.setAttribute('width', String(meta.width));
      }

      if (!img.getAttribute('height') && meta.height) {
        img.setAttribute('height', String(meta.height));
      }

      if (!img.getAttribute('srcset')) {
        const srcset = responsiveImageSrcset(src);
        if (srcset) {
          img.setAttribute('srcset', srcset);
        }
      }

      if (!img.getAttribute('sizes') && (img.getAttribute('srcset') || '').trim()) {
        img.setAttribute('sizes', responsiveImageSizesForElement(img));
      }
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function siteOrigin() {
    return siteSettings.canonicalOrigin;
  }

  function absoluteUrl(path = "/") {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const normalized = `/${String(path || "").replace(/^\/+/, "")}`;
    return new URL(normalized, `${siteOrigin()}/`).toString();
  }

  function prettyPath(key) {
    return prettyRoutes[key] || prettyRoutes.home;
  }

  function workHref(slug) {
    const encoded = encodeURIComponent(slug || "");
    return isLocalPreview() ? `realisation.html?slug=${encoded}` : `${prettyPath("works")}/${encoded}`;
  }

  function articleHref(slug) {
    const encoded = encodeURIComponent(slug || "");
    return isLocalPreview() ? `article.html?slug=${encoded}` : `${prettyPath("news")}/${encoded}`;
  }

  function serviceHref(slug) {
    const encoded = encodeURIComponent(slug || "");
    return isLocalPreview() ? `prestation.html?slug=${encoded}` : `${prettyPath("services")}/${encoded}`;
  }

  function slugFromPrettyPath(sectionKey) {
    const expectedRoot = prettyPath(sectionKey).replace(/^\/+/, "");
    const segments = String(window.location.pathname || "")
      .split("/")
      .filter(Boolean);

    if (segments[0] !== expectedRoot || !segments[1]) {
      return "";
    }

    try {
      return decodeURIComponent(segments[1]);
    } catch (error) {
      return segments[1];
    }
  }

  function currentCanonicalPath() {
    switch (page()) {
      case "home":
        return prettyPath("home");
      case "services":
        return prettyPath("services");
      case "service-detail":
        return prettyPath("services");
      case "regulations":
        return prettyPath("regulations");
      case "works":
        return prettyPath("works");
      case "news":
        return prettyPath("news");
      case "contact":
        return prettyPath("contact");
      case "mentions-legales":
        return prettyPath("legalMentions");
      case "confidentialite":
        return prettyPath("legalPrivacy");
      case "cookies":
        return prettyPath("legalCookies");
      default:
        return prettyPath("home");
    }
  }

  function defaultMetaImage() {
    switch (page()) {
      case "home":
        return editorial("hero", siteSettings.defaultSocialImage);
      case "services":
      case "service-detail":
        return editorial("hero", siteSettings.defaultSocialImage);
      case "regulations":
        return editorial("regulations", siteSettings.defaultSocialImage);
      case "works":
        return editorial("works", siteSettings.defaultSocialImage);
      case "news":
        return editorial("news", siteSettings.defaultSocialImage);
      case "contact":
        return editorial("contact", siteSettings.defaultSocialImage);
      case "mentions-legales":
      case "confidentialite":
      case "cookies":
        return editorial("legal", siteSettings.defaultSocialImage);
      default:
        return siteSettings.defaultSocialImage;
    }
  }

  function upsertMeta(attrName, attrValue, contentValue) {
    let tag = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attrName, attrValue);
      document.head.appendChild(tag);
    }

    tag.setAttribute("content", contentValue || "");
    return tag;
  }

  function removeMeta(attrName, attrValue) {
    document.head.querySelector(`meta[${attrName}="${attrValue}"]`)?.remove();
  }

  function upsertLink(relValue, hrefValue) {
    let tag = document.head.querySelector(`link[rel="${relValue}"]`);
    if (!tag) {
      tag = document.createElement("link");
      tag.setAttribute("rel", relValue);
      document.head.appendChild(tag);
    }

    tag.setAttribute("href", hrefValue);
    return tag;
  }

  function setStructuredData(graphItems) {
    let tag = document.getElementById("structured-data");
    if (!tag) {
      tag = document.createElement("script");
      tag.id = "structured-data";
      tag.type = "application/ld+json";
      document.head.appendChild(tag);
    }

    tag.textContent = JSON.stringify(
      {
        "@context": "https://schema.org",
        "@graph": graphItems
      },
      null,
      2
    );
  }

  function organizationSchema() {
    return {
      "@type": "Organization",
      name: content.company?.legalName || content.company?.name || "Control'Air",
      url: siteSettings.canonicalOrigin,
      logo: absoluteUrl(siteSettings.defaultSocialImage),
      email: content.company?.email || "",
      telephone: content.company?.phoneLinks?.[0] ? `+33${String(content.company.phoneLinks[0]).replace(/^0/, "")}` : "",
      address: {
        "@type": "PostalAddress",
        streetAddress: "46 allée des Coteaux",
        postalCode: "93340",
        addressLocality: "Le Raincy",
        addressCountry: "FR"
      }
    };
  }


  function professionalServiceSchema() {
    const telephone = content.company?.phoneLinks?.[0]
      ? `+33${String(content.company.phoneLinks[0]).replace(/^0/, "")}`
      : "";

    return {
      "@type": "ProfessionalService",
      name: content.company?.name || "Control'Air",
      url: siteSettings.canonicalOrigin,
      image: absoluteUrl(siteSettings.defaultSocialImage),
      logo: absoluteUrl(siteSettings.defaultSocialImage),
      email: content.company?.email || "",
      telephone,
      address: {
        "@type": "PostalAddress",
        streetAddress: "46 allée des Coteaux",
        postalCode: "93340",
        addressLocality: "Le Raincy",
        addressCountry: "FR"
      },
      areaServed: [
        {
          "@type": "AdministrativeArea",
          name: "Île-de-France"
        }
      ],
      serviceType: [
        "Contrôle de sorbonnes de laboratoire",
        "Contrôle d'équipements ventilés",
        "Mesures aérauliques"
      ]
    };
  }

  function websiteSchema() {
    return {
      "@type": "WebSite",
      name: content.company?.name || "Control'Air",
      url: siteSettings.canonicalOrigin,
      inLanguage: ["fr-FR", "en-US"]
    };
  }

  function webPageSchema({ title, description, url, image, typeName = "WebPage" }) {
    const schema = {
      "@type": typeName,
      name: title,
      description,
      url,
      inLanguage: lang() === "fr" ? "fr-FR" : "en-US"
    };

    if (image) {
      schema.primaryImageOfPage = {
        "@type": "ImageObject",
        url: image
      };
    }

    return schema;
  }

  function articleSchema({ title, description, url, image, datePublished, author }) {
    return {
      "@type": "Article",
      headline: title,
      description,
      url,
      datePublished,
      dateModified: datePublished,
      inLanguage: lang() === "fr" ? "fr-FR" : "en-US",
      image: image ? [image] : undefined,
      author: {
        "@type": "Organization",
        name: author || content.company?.name || "Control'Air"
      },
      publisher: {
        "@type": "Organization",
        name: content.company?.name || "Control'Air",
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(siteSettings.defaultSocialImage)
        }
      }
    };
  }

  function breadcrumbSchema(items) {
    return {
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.path)
      }))
    };
  }

  function itemListSchema({ name, path, items = [] }) {
    const listItems = Array.isArray(items) ? items.filter((item) => item && item.name && item.path) : [];

    return {
      "@type": "ItemList",
      name,
      url: absoluteUrl(path),
      itemListOrder: "https://schema.org/ItemListUnordered",
      numberOfItems: listItems.length,
      itemListElement: listItems.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(item.path),
        name: item.name
      }))
    };
  }

  function pageSchemaType() {
    switch (page()) {
      case "services":
      case "works":
      case "news":
        return "CollectionPage";
      case "contact":
        return "ContactPage";
      default:
        return "WebPage";
    }
  }

  function compactMetaDescription(value, maxLength = 180) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();

    if (!normalized) {
      return "";
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    const sentenceBoundary = normalized.lastIndexOf(". ", maxLength);
    if (sentenceBoundary >= Math.floor(maxLength * 0.55)) {
      return normalized.slice(0, sentenceBoundary + 1).trim();
    }

    const clipped = normalized.slice(0, maxLength + 1);
    const wordBoundary = clipped.lastIndexOf(" ");
    return `${clipped.slice(0, wordBoundary > 0 ? wordBoundary : maxLength).trim()}…`;
  }

  function setMeta(title, description, options = {}) {
    const metaTitle = title || pageTitles.home[lang()];
    const metaDescription = compactMetaDescription(description || localize(content.company?.tagline));
    const metaPath = options.path || currentCanonicalPath();
    const metaUrl = absoluteUrl(metaPath);
    const metaImage = absoluteUrl(options.image || defaultMetaImage());
    const metaType = options.type || (page() === "article" ? "article" : "website");

    document.title = metaTitle;
    upsertMeta("name", "description", metaDescription);
    upsertMeta("name", "robots", options.robots || "index,follow");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", metaTitle);
    upsertMeta("name", "twitter:description", metaDescription);
    upsertMeta("name", "twitter:image", metaImage);
    upsertMeta("property", "og:site_name", content.company?.name || "Control'Air");
    upsertMeta("property", "og:locale", lang() === "fr" ? "fr_FR" : "en_US");
    upsertMeta("property", "og:type", metaType);
    upsertMeta("property", "og:title", metaTitle);
    upsertMeta("property", "og:description", metaDescription);
    upsertMeta("property", "og:url", metaUrl);
    upsertMeta("property", "og:image", metaImage);
    upsertLink("canonical", metaUrl);

    if (options.publishedTime) {
      upsertMeta("property", "article:published_time", options.publishedTime);
    } else {
      removeMeta("property", "article:published_time");
    }

    if (options.author) {
      upsertMeta("property", "article:author", options.author);
    } else {
      removeMeta("property", "article:author");
    }

    const graph = [
      organizationSchema(),
      professionalServiceSchema(),
      websiteSchema(),
      webPageSchema({
        title: metaTitle,
        description: metaDescription,
        url: metaUrl,
        image: metaImage,
        typeName: options.pageType || pageSchemaType()
      })
    ];

    if (Array.isArray(options.breadcrumbs) && options.breadcrumbs.length) {
      graph.push(breadcrumbSchema(options.breadcrumbs));
    }

    if (metaType === "article") {
      graph.push(
        articleSchema({
          title: metaTitle,
          description: metaDescription,
          url: metaUrl,
          image: metaImage,
          datePublished: options.publishedTime,
          author: options.author
        })
      );
    }

    if (Array.isArray(options.extraSchemas)) {
      graph.push(...options.extraSchemas);
    }

    setStructuredData(graph.filter(Boolean));
  }

  function shell() {
    return document.querySelector(".shell");
  }

  function page() {
    return document.body.dataset.page || "home";
  }

  function canReusePrerenderedCollection(root, type) {
    if (!root || document.body?.dataset?.prerendered !== "true" || state.lang !== "fr") {
      return false;
    }

    if (root.dataset.prerenderReuseDone === "true") {
      return false;
    }

    if (type === "works") {
      return state.worksFilters.intervention === "all" && state.worksFilters.equipment === "all";
    }

    if (type === "news") {
      return true;
    }

    return false;
  }


function pageTemplateKey() {
  if (page() === "realisation") {
    return "work";
  }

  if (page() === "article") {
    return "article";
  }

  if (page() === "mentions-legales" || page() === "confidentialite" || page() === "cookies") {
    return "legal";
  }

  return page();
}

function editorial(key, fallback = "") {
  return content.editorialMedia?.[key]?.src || fallback;
}

function editorialAlt(key, fallback = "") {
  return localize(content.editorialMedia?.[key]?.alt || fallback);
}

function isCurrentRoute(key) {
  const current = page();

  if (key === "home") {
    return current === "home";
  }

  if (key === "services") {
    return current === "services" || current === "service-detail";
  }

  if (key === "regulations") {
    return current === "regulations" || (current === "home" && String(window.location.hash || "") === "#reglementation");
  }

  if (key === "works") {
    return current === "works" || current === "realisation";
  }

  if (key === "news") {
    return current === "news" || current === "article";
  }

  if (key === "contact") {
    return current === "contact";
  }

  return false;
}

  function formatDate(value) {
    if (!value) {
      return "";
    }

    try {
      let parsedDate;

      if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        const [year, month, day] = String(value).split("-").map((part) => Number(part));
        parsedDate = new Date(year, month - 1, day);
      } else {
        parsedDate = new Date(value);
      }

      return new Intl.DateTimeFormat(lang() === "fr" ? "fr-FR" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(parsedDate);
    } catch (error) {
      return value;
    }
  }


function buttonMarkup({ href, label, variant = "primary", icon = true, extraClass = "", target = "" }) {
  const rel = target === "_blank" ? ' rel="noopener noreferrer"' : "";
  const className = ["button", `button--${variant}`, extraClass].filter(Boolean).join(" ");
  const iconMarkup = icon
    ? `<span class="button__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M5 12h13"></path>
          <path d="M12 5l7 7-7 7"></path>
        </svg>
      </span>`
    : "";

  return `<a class="${escapeHtml(className)}" href="${escapeHtml(href)}"${target ? ` target="${target}"` : ""}${rel}>
    <span>${escapeHtml(label)}</span>
    ${iconMarkup}
  </a>`;
}

  function tinyBadge(label) {
    return `<span class="tiny-badge">${escapeHtml(label)}</span>`;
  }

function whyChooseIconMarkup(iconKey) {
  switch (String(iconKey || "")) {
    case "competence":
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M4 14a8 8 0 1 1 16 0"></path>
          <path d="M12 14l4-4"></path>
          <path d="M7 18h10"></path>
        </svg>`;
    case "expertise":
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M10 3h4a1 1 0 0 1 1 1v1.5H9V4a1 1 0 0 1 1-1z"></path>
          <path d="M8 5.5h8a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z"></path>
          <path d="M9.5 12.5l1.6 1.6 3.4-3.6"></path>
        </svg>`;
    case "disponibilite":
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <circle cx="12" cy="12" r="8"></circle>
          <path d="M4 12h16"></path>
          <path d="M12 4c2.6 2.2 4 5 4 8s-1.4 5.8-4 8"></path>
          <path d="M12 4c-2.6 2.2-4 5-4 8s1.4 5.8 4 8"></path>
        </svg>`;
    case "qualite-rapports":
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M8 3.5h6l4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z"></path>
          <path d="M14 3.5V8h4"></path>
          <path d="M9 12h6"></path>
          <path d="M9 16h6"></path>
        </svg>`;
    case "securite":
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M12 3l7 3v5c0 4.4-2.7 7.6-7 10-4.3-2.4-7-5.6-7-10V6l7-3z"></path>
          <path d="M9.5 12.5l1.8 1.8 3.5-3.5"></path>
        </svg>`;
    default:
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <circle cx="12" cy="12" r="8"></circle>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>`;
  }
}

function processStepIconMarkup(stepIndex) {
  switch (Number(stepIndex)) {
    case 0:
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M6.8 5.5h2.3l1.2 3.2-1.5 1.4a14 14 0 0 0 5.2 5.2l1.4-1.5 3.2 1.2v2.3a1.4 1.4 0 0 1-1.4 1.4A12.7 12.7 0 0 1 5.4 6.9a1.4 1.4 0 0 1 1.4-1.4z"></path>
        </svg>`;
    case 1:
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <circle cx="11" cy="11" r="5.5"></circle>
          <path d="M16 16l3.8 3.8"></path>
        </svg>`;
    case 2:
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M14.4 6.1l3.5 3.5"></path>
          <path d="M13.2 7.3l-6.9 6.9a1.7 1.7 0 0 0 0 2.4l1.1 1.1a1.7 1.7 0 0 0 2.4 0l6.9-6.9"></path>
          <path d="M15.7 4.8a2.3 2.3 0 0 1 3.2 3.2l-1 1-3.5-3.5 1.3-.7z"></path>
        </svg>`;
    case 3:
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M8 3.5h6l4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z"></path>
          <path d="M14 3.5V8h4"></path>
          <path d="M9 12h6"></path>
          <path d="M9 16h6"></path>
        </svg>`;
    case 4:
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M8.5 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"></path>
          <path d="M4.8 18.2a4.2 4.2 0 0 1 7.4-2.7"></path>
          <path d="M16.5 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path>
          <path d="M15 17.8h4.2"></path>
          <path d="M17.1 15.7v4.2"></path>
        </svg>`;
    default:
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <circle cx="12" cy="12" r="8"></circle>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>`;
  }
}


function renderHeader() {
  const currentLang = lang();
  const headerRoot = document.getElementById("site-header");
  if (!headerRoot) {
    return;
  }

  const navItems = [
    { key: "home", href: routes.home },
    { key: "services", href: routes.services },
    { key: "works", href: routes.works },
    { key: "news", href: routes.news },
    { key: "contact", href: routes.contact }
  ];

  headerRoot.innerHTML = `
    <header class="site-header">
      <div class="shell site-header__inner">
        <a class="brand" href="${routes.home}" aria-label="Control'Air">
          <span class="brand__mark">
            <img src="${asset("assets/images/logo/control-air-mark.png")}" alt="" decoding="async" />
          </span>
          <span class="brand__text">
            <strong>Control'Air</strong>
            <small>${escapeHtml(localize(content.company.coordinatesLabel))}</small>
          </span>
        </a>

        <nav class="site-nav" aria-label="${escapeHtml(localize({ fr: "Navigation principale", en: "Main navigation" }))}">
          ${navItems
            .map(
              (item) => `
              <a class="site-nav__link ${isCurrentRoute(item.key) ? "is-active" : ""}" href="${item.href}" ${isCurrentRoute(item.key) ? 'aria-current="page"' : ""}>
                <span class="site-nav__text">${escapeHtml(content.ui[currentLang].nav[item.key])}</span>
                <span class="site-nav__text-hover" aria-hidden="true">${escapeHtml(content.ui[currentLang].nav[item.key])}</span>
              </a>`
            )
            .join("")}
        </nav>

        <div class="site-header__actions">
          <div class="lang-switch" aria-label="${escapeHtml(tr("changeLanguage"))}">
            <button class="lang-switch__button ${currentLang === "fr" ? "is-active" : ""}" type="button" data-lang="fr">FR</button>
            <button class="lang-switch__button ${currentLang === "en" ? "is-active" : ""}" type="button" data-lang="en">EN</button>
          </div>
          <a class="button button--primary button--small desktop-only site-header__quote" href="${routes.contact}">
            <span>${escapeHtml(content.ui[currentLang].nav.quote)}</span>
            <span class="button__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M5 12h13"></path>
                <path d="M12 5l7 7-7 7"></path>
              </svg>
            </span>
          </a>
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu">
            <span>${escapeHtml(tr("menu"))}</span>
          </button>
        </div>
      </div>
      <div class="shell site-header__progress" aria-hidden="true"><span></span></div>
      <div class="mobile-menu" id="mobile-menu" hidden>
        <div class="mobile-menu__panel">
          <div class="mobile-menu__top">
            <span class="mobile-menu__title">Control'Air</span>
            <button class="mobile-menu__close" type="button">${escapeHtml(tr("close"))}</button>
          </div>
          <nav class="mobile-menu__nav" aria-label="${escapeHtml(localize({ fr: "Navigation mobile", en: "Mobile navigation" }))}">
            ${navItems
              .map(
                (item) => `
                <a class="mobile-menu__link ${isCurrentRoute(item.key) ? "is-active" : ""}" href="${item.href}">
                  ${escapeHtml(content.ui[currentLang].nav[item.key])}
                </a>`
              )
              .join("")}
          </nav>
          <div class="mobile-menu__footer">
            ${buttonMarkup({ href: routes.contact, label: content.ui[currentLang].nav.quote, variant: "primary" })}
          </div>
        </div>
      </div>
    </header>
  `;
}

  function renderFooter() {
    const currentLang = lang();
    const footerRoot = document.getElementById("site-footer");
    if (!footerRoot) {
      return;
    }

    const year = new Date().getFullYear();

    footerRoot.innerHTML = `
      <footer class="site-footer">
        <div class="shell site-footer__grid">
          <div class="site-footer__brand" data-reveal>
            <a class="brand brand--footer" href="${routes.home}">
              <span class="brand__mark">
                <img src="${asset("assets/images/logo/control-air-mark.png")}" alt="" decoding="async" />
              </span>
              <span class="brand__text">
                <strong>Control'Air</strong>
                <small>${escapeHtml(localize(content.company.coordinatesLabel))}</small>
              </span>
            </a>
            <div class="site-footer__approval">
              <a href="${escapeHtml(content.company.approvalLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localize(content.company.approvalLabel))}</a>
            </div>
          </div>

          <div class="site-footer__column site-footer__column--nav" data-reveal>
            <h3>${escapeHtml(content.ui[currentLang].footer.navigation)}</h3>
            <div class="site-footer__links site-footer__links--nav">
              <a href="${routes.home}">${escapeHtml(content.ui[currentLang].nav.home)}</a>
              <a href="${routes.services}">${escapeHtml(content.ui[currentLang].nav.services)}</a>
              <a href="${routes.regulations}">${escapeHtml(content.ui[currentLang].nav.regulations)}</a>
              <a href="${routes.works}">${escapeHtml(content.ui[currentLang].nav.works)}</a>
              <a href="${routes.news}">${escapeHtml(content.ui[currentLang].nav.news)}</a>
              <a href="${routes.contact}">${escapeHtml(content.ui[currentLang].nav.contact)}</a>
            </div>
          </div>

          <div class="site-footer__column site-footer__column--quick" data-reveal>
            <h3>${escapeHtml(tr("legalCrosslinks"))}</h3>
            <div class="site-footer__links site-footer__links--quick">
              <a href="tel:${escapeHtml(content.company.phoneLinks[0])}">${escapeHtml(content.company.phones[0])}</a>
              <a href="tel:${escapeHtml(content.company.phoneLinks[1])}">${escapeHtml(content.company.phones[1])}</a>
              <a href="mailto:${escapeHtml(content.company.email)}">${escapeHtml(content.company.email)}</a>
              <span>${escapeHtml(content.company.address)}</span>
            </div>
          </div>

          <div class="site-footer__column site-footer__column--legal" data-reveal>
            <h3>${escapeHtml(content.ui[currentLang].footer.legal)}</h3>
            <div class="site-footer__links site-footer__links--legal">
              <a href="${routes.legalMentions}">${escapeHtml(content.ui[currentLang].legal.anchor1)}</a>
              <a href="${routes.legalPrivacy}">${escapeHtml(content.ui[currentLang].legal.anchor2)}</a>
              <a href="${routes.legalCookies}">${escapeHtml(content.ui[currentLang].legal.anchor3)}</a>
              <a href="${escapeHtml(content.company.approvalLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tr("approval"))}</a>
            </div>
          </div>
        </div>

        <div class="shell site-footer__bottom">
          <span>© ${year} ${escapeHtml(content.company.name)}. ${escapeHtml(localize(content.company.copyright))}</span>
        </div>
      </footer>
    `;
  }

  function renderCookieBanner() {
    const root = document.getElementById("cookie-banner");
    if (!root) {
      return;
    }

    const choice = localStorage.getItem("controlAirCookieChoice");
    if (choice) {
      root.innerHTML = "";
      root.hidden = true;
      return;
    }

    root.hidden = false;
    root.innerHTML = `
      <div class="cookie-banner">
        <div class="cookie-banner__copy">
          <strong>${escapeHtml(content.ui[lang()].cookie.title)}</strong>
          <p>${escapeHtml(content.ui[lang()].cookie.text)}</p>
        </div>
        <div class="cookie-banner__actions">
          <button class="button button--primary button--small" type="button" data-cookie-choice="accepted">${escapeHtml(content.ui[lang()].buttons.accept)}</button>
          <button class="button button--secondary button--small" type="button" data-cookie-choice="refused">${escapeHtml(content.ui[lang()].buttons.refuse)}</button>
          <a class="cookie-banner__link" href="${routes.legalCookies}">${escapeHtml(content.ui[lang()].cookie.policy)}</a>
        </div>
      </div>
    `;
  }

  function renderSkipLink() {
    const skipLink = document.querySelector(".skip-link");
    if (!skipLink) {
      return;
    }

    skipLink.textContent = tr("common.skipLink") || skipLink.textContent;
  }


function heroBlock({ eyebrow, title, lead, paragraphs = [], noteLabel = "", note = "" }) {
  const heroBullets = Array.isArray(content.hero?.bullets) ? content.hero.bullets.slice(0, 3) : [];
  const trailLabel = localize({
    fr: "Découvrir les prestations",
    en: "Explore services"
  });

  return `
    <section class="hero hero--home">
      <div class="hero__media">
        <img src="${asset(editorial("hero", content.hero.visuals?.coverImage || ""))}" alt="${escapeHtml(editorialAlt("hero"))}" loading="eager" decoding="async" fetchpriority="high" />
      </div>
      <div class="hero__veil"></div>
      <div class="shell hero__grid">
        <div class="hero__copy" data-reveal>
          <h1 class="section-label section-label--hero section-label--hero-title">${escapeHtml(localize(title))}</h1>
          <p class="hero__statement">${escapeHtml(localize(lead))}</p>
          ${
            heroBullets.length
              ? `
              <ul class="hero__list" role="list">
                ${heroBullets.map((item) => `<li>${escapeHtml(localize(item))}</li>`).join("")}
              </ul>`
              : ""
          }
          <div class="hero__actions">
            ${buttonMarkup({ href: sectionHref("services"), label: localize(content.hero.primaryCta), variant: "primary" })}
            ${buttonMarkup({ href: routes.contact, label: localize(content.hero.secondaryCta), variant: "secondary" })}
          </div>
          <a class="hero__trail" href="${sectionHref("services")}">
            <span class="hero__trail-line" aria-hidden="true"></span>
            <span>${escapeHtml(trailLabel)}</span>
          </a>
        </div>
      </div>
    </section>
  `;
}

  function marqueeBlock() {
    const lines = [...content.marquee, ...content.marquee];

    return `
      <section class="marquee-band" aria-hidden="true">
        <div class="marquee-band__track">
          ${lines.map((item) => `<span>${escapeHtml(localize(item))}</span>`).join("")}
        </div>
      </section>
    `;
  }

  function sectionIntroMarkup({ label, title, lead, align = "left", mode = "full" }) {
    const labelOnly = mode === "label-only";

    return `
      <div class="section-intro section-intro--${align}${labelOnly ? " section-intro--label-only" : ""}" data-reveal>
        ${label ? `<span class="section-label">${escapeHtml(label)}</span>` : ""}
        ${!labelOnly && title ? `<h2 class="section-title">${escapeHtml(title)}</h2>` : ""}
        ${!labelOnly && lead ? `<p class="section-lead">${escapeHtml(lead)}</p>` : ""}
      </div>
    `;
  }


function identitySection() {
  return `
    <section class="section section--tone-alt">
      <div class="shell split-layout split-layout--identity split-layout--clean">
        <div class="split-layout__copy" data-reveal>
          <span class="section-label">${escapeHtml(localize(content.identity.eyebrow))}</span>
          <h2 class="section-title">${escapeHtml(localize(content.identity.title))}</h2>
          <p class="section-lead">${escapeHtml(localize(content.identity.intro))}</p>

          <div class="point-list point-list--clean">
            ${content.identity.points
              .map(
                (point) => `
                <article class="point-list__item point-list__item--clean">
                  <span class="point-list__icon" aria-hidden="true"></span>
                  <span>${escapeHtml(localize(point))}</span>
                </article>`
              )
              .join("")}
          </div>

          <article class="function-card function-card--clean">
            <span class="section-kicker">${escapeHtml(localize(content.identity.functionLabel))}</span>
            <p>${escapeHtml(localize(content.identity.functionText))}</p>
            <a class="text-link" href="${sectionHref("services")}">
              ${escapeHtml(localize(content.ui[lang()].home.identity.cta))}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13"></path>
                <path d="M12 5l7 7-7 7"></path>
              </svg>
            </a>
          </article>
        </div>

        <div class="split-layout__visual" data-reveal>
          <figure class="editorial-figure editorial-figure--identity">
            <img src="${asset(editorial("identity", content.identity.visual))}" alt="${escapeHtml(editorialAlt("identity"))}" loading="lazy" decoding="async" />
          </figure>
        </div>
      </div>
    </section>
  `;
}


function homeServicesSection() {
  const serviceEntries = serviceCatalogEntries();

  return `
    <section class="section section--tone home-services" id="${escapeHtml(sectionAnchors.services)}">
      <div class="shell">
        ${sectionIntroMarkup({
          label: localize(content.ui[lang()].home.services.eyebrow),
          title: localize(content.ui[lang()].home.services.headline),
          lead: localize(content.ui[lang()].home.services.lead),
          mode: "label-only"
        })}
        <div class="service-accordion service-accordion--minimal service-accordion--home">
          ${serviceEntries.map((item) => serviceAccordionItem(item, { variant: "minimal", titleTag: "h3", detailMode: "teaser" })).join("")}
        </div>
      </div>
    </section>
  `;
}

function homeProofStrip() {
  const approvalItem = {
    eyebrow: {
      fr: "Référence",
      en: "Reference"
    },
    value: content.company.approvalLabel,
    text: {
      fr: "Cadre reconnu pour le contrôle de l'aération et de l'assainissement des locaux de travail.",
      en: "Recognized framework for ventilation and workplace air-treatment inspections."
    },
    href: content.company.approvalLink
  };

  const proofItems = [approvalItem, ...(Array.isArray(content.hero.metrics) ? content.hero.metrics.slice(0, 3) : []).map((item) => ({
    eyebrow: {
      fr: "Repère",
      en: "Key point"
    },
    value: item.value,
    text: item.label
  }))];

  return `
    <section class="section section--tight home-proof-band">
      <div class="shell">
        <div class="home-proof">
          ${proofItems
            .map(
              (item) => `
              <article class="home-proof__item" data-reveal>
                <span class="home-proof__eyebrow">${escapeHtml(localize(item.eyebrow))}</span>
                <strong>${escapeHtml(localize(item.value))}</strong>
                <p>${escapeHtml(localize(item.text))}</p>
                ${
                  item.href
                    ? `<a class="text-link" href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localize({ fr: "Voir l'agrément", en: "View approval" }))}</a>`
                    : ""
                }
              </article>`
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function homeDefinitionSection() {
  const paragraphs = Array.isArray(content.hero.paragraphs) ? content.hero.paragraphs : [];
  const visual = content.hero.visuals?.primaryImage || editorial("identity", content.identity.visual);
  const visualAlt = content.hero.caption || content.hero.title;

  return `
    <section class="section section--tone-alt">
      <div class="shell split-layout split-layout--clean home-definition">
        <div class="split-layout__copy" data-reveal>
          ${sectionIntroMarkup({
            label: localize({
              fr: "Comprendre une sorbonne",
              en: "Understanding a fume hood"
            }),
            title: localize(content.hero.title),
            lead: localize(content.hero.lead),
            mode: "label-only"
          })}
          <div class="home-definition__prose">
            ${paragraphs.map((item) => `<p>${escapeHtml(localize(item))}</p>`).join("")}
          </div>
          ${
            content.hero.note
              ? `
              <article class="home-definition__note">
                <span class="home-definition__note-label">${escapeHtml(localize(content.hero.noteLabel))}</span>
                <p>${escapeHtml(localize(content.hero.note))}</p>
              </article>`
              : ""
          }
        </div>

        <div class="split-layout__visual" data-reveal>
          <figure class="editorial-figure home-definition__figure">
            <img src="${asset(visual)}" alt="${escapeHtml(localize(visualAlt))}" loading="lazy" decoding="async" />
          </figure>
        </div>
      </div>
    </section>
  `;
}


function whySection() {
  const whyUi = content.ui?.[lang()]?.home?.why || {};
  const items = Array.isArray(content.whyChooseUs) ? content.whyChooseUs.slice(0, 5) : [];
  const sectionId = `why-choose-${page()}`;
  const tabsLabel = localize(whyUi.title) || "Why choose us";
  const sectionHeadline = localize(whyUi.headline) || tabsLabel;

  if (!items.length) {
    return "";
  }

  return `
    <section class="section section--tone-alt">
      <div class="shell">
        ${sectionIntroMarkup({
          label: tabsLabel,
          mode: "label-only"
        })}
        <div class="why-choose__header" data-reveal>
          <h2 class="why-choose__section-title">${escapeHtml(sectionHeadline)}</h2>
        </div>
        <div class="why-choose" data-why-choose>
          <div class="why-choose__tabs" role="tablist" aria-label="${escapeHtml(tabsLabel)}" data-reveal>
            ${items
              .map((item, index) => {
                const itemKey = escapeHtml(String(item.key || `item-${index + 1}`));
                const itemIndex = String(index + 1).padStart(2, "0");
                const isActive = index === 0;

                return `
                <button
                  class="why-choose__tab ${isActive ? "is-active" : ""}"
                  id="${sectionId}-tab-${itemKey}"
                  type="button"
                  role="tab"
                  aria-selected="${isActive ? "true" : "false"}"
                  aria-controls="${sectionId}-panel-${itemKey}"
                  tabindex="${isActive ? "0" : "-1"}"
                  data-why-tab="${itemKey}"
                >
                  <span class="why-choose__tab-icon" aria-hidden="true">${whyChooseIconMarkup(item.icon || item.key)}</span>
                  <span class="why-choose__tab-copy">
                    <span class="why-choose__tab-index">${itemIndex}</span>
                    <span class="why-choose__tab-title">${escapeHtml(localize(item.title))}</span>
                  </span>
                </button>`;
              })
              .join("")}
          </div>
          <div class="why-choose__panels" data-reveal>
            ${items
              .map((item, index) => {
                const itemKey = escapeHtml(String(item.key || `item-${index + 1}`));
                const itemIndex = String(index + 1).padStart(2, "0");
                const isActive = index === 0;

                return `
                <article
                  class="why-choose__panel ${isActive ? "is-active" : ""}"
                  id="${sectionId}-panel-${itemKey}"
                  role="tabpanel"
                  aria-labelledby="${sectionId}-tab-${itemKey}"
                  data-why-panel="${itemKey}"
                  ${isActive ? "" : "hidden"}
                >
                  <div class="why-choose__panel-head">
                    <span class="why-choose__panel-index">${itemIndex}</span>
                    <span class="why-choose__panel-icon" aria-hidden="true">${whyChooseIconMarkup(item.icon || item.key)}</span>
                  </div>
                  <h3 class="why-choose__panel-title">${escapeHtml(localize(item.title))}</h3>
                  <p class="why-choose__panel-text">${escapeHtml(localize(item.text))}</p>
                </article>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

  function processSection() {
    const processUi = content.ui?.[lang()]?.home?.process || {};
    const stepLabelBase = localize(processUi.stepLabel) || localize({ fr: "Étape", en: "Step" });
    const steps = (Array.isArray(content.processSteps) ? content.processSteps : [])
      .slice(0, 5)
      .map((step, index) => {
        const fallbackNumber = String(index + 1).padStart(2, "0");
        const number = String(step?.number || fallbackNumber);
        let title = localize(step?.title);
        let text = localize(step?.text);

        if (index === 0) {
          const prefix = localize(processUi.step1Prefix);
          const link = localize(processUi.step1Link);
          title = `${prefix} ${link}`.trim() || title;
          text = localize(processUi.step1Text) || text;
        } else {
          title = localize(processUi[`step${index + 1}Title`]) || title;
          text = localize(processUi[`step${index + 1}Text`]) || text;
        }

        return {
          number,
          stepLabel: `${stepLabelBase} ${number}`,
          title,
          text
        };
      });

    if (!steps.length) {
      return "";
    }

    return `
      <section class="section section--light home-process" data-process-story>
        <div class="shell process-story">
          <div class="process-story__intro" data-process-intro>
            <div class="process-story__intro-inner" data-reveal>
              <span class="process-story__eyebrow">${escapeHtml(localize(processUi.title))}</span>
              <h2 class="process-story__title">${escapeHtml(localize(processUi.headline))}</h2>
              <p class="process-story__lead">${escapeHtml(localize(processUi.sub))}</p>
            </div>
          </div>
          <div class="process-story__rail">
            <div class="process-story__line" aria-hidden="true">
              <span class="process-story__track" data-process-track></span>
              <span class="process-story__fill-clip" data-process-fill-clip>
                <span class="process-story__fill" data-process-fill></span>
              </span>
            </div>
            ${steps
              .map((step, index) => `
                <article class="process-card process-card--journey" data-process-card data-reveal>
                  <span class="process-card__dot" data-process-dot aria-hidden="true"></span>
                  <span class="process-card__icon" aria-hidden="true">${processStepIconMarkup(index)}</span>
                  <div class="process-card__body">
                    <span class="process-card__eyebrow">${escapeHtml(step.stepLabel)}</span>
                    <div class="process-card__title-row">
                      <h3>${escapeHtml(step.title)}</h3>
                      <span class="process-card__title-arrow" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M7 12h10"></path>
                          <path d="M12 7l5 5-5 5"></path>
                        </svg>
                      </span>
                    </div>
                    <p>${escapeHtml(step.text)}</p>
                  </div>
                </article>`)
              .join("")}
            <div class="process-story__actions" data-reveal>
              ${buttonMarkup({
                href: routes.contact,
                label: localize(processUi.cta) || localize({ fr: "Nous contacter", en: "Contact us" }),
                variant: "secondary",
                extraClass: "process-story__cta-button"
              })}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function regulatoryDefinitionEntries() {
    return Array.isArray(content.regulatory?.definitions) ? content.regulatory.definitions : [];
  }

  function regulatoryFindDefinition(test) {
    const frTitle = localize(test, "fr");
    const enTitle = localize(test, "en");

    return regulatoryDefinitionEntries().find((entry) => {
      const entryFr = localize(entry.title, "fr");
      const entryEn = localize(entry.title, "en");
      return (frTitle && entryFr === frTitle) || (enTitle && entryEn === enTitle);
    }) || null;
  }

  function regulatoryJourneyStages() {
    const fallbackContexts = [
      { fr: "Chez le fabricant", en: "At the manufacturer" },
      { fr: "Chez l'utilisateur", en: "At the user site" },
      { fr: "Suivi périodique", en: "Periodic follow-up" }
    ];
    const fallbackSteps = [
      { fr: "Étape 1", en: "Step 1" },
      { fr: "Étape 2", en: "Step 2" },
      { fr: "Étape 3", en: "Step 3" }
    ];
    const tones = ["manufacturer", "site", "routine"];

    return (Array.isArray(content.regulatory?.journey) ? content.regulatory.journey : [])
      .slice(0, 3)
      .map((item, index) => {
        const number = String(localize(item.number) || index + 1).padStart(2, "0");

        return {
          number,
          tone: tones[index] || "neutral",
          step: item.step || fallbackSteps[index] || { fr: `Étape ${index + 1}`, en: `Step ${index + 1}` },
          context: item.context || fallbackContexts[index] || { fr: "Parcours", en: "Journey" },
          title: item.title,
          tests: (Array.isArray(item.tests) ? item.tests : []).map((test) => ({
            title: test,
            text: regulatoryFindDefinition(test)?.text || ""
          }))
        };
      });
  }

  function regulatoryNormCases() {
    const defaultCases = [
      {
        label: {
          fr: "Mise en service",
          en: "Commissioning"
        },
        title: {
          fr: "Essai de réception",
          en: "Acceptance test"
        },
        context: {
          fr: "Sorbonne installée après 2005",
          en: "Fume hood installed after 2005"
        },
        norms: [
          { fr: "NF EN 14175", en: "NF EN 14175" },
          { fr: "NF X 15-206", en: "NF X 15-206" }
        ],
        text: {
          fr: "Le cadre à retenir pour la vérification sur site lors de l'installation et la constitution du dossier de référence.",
          en: "The framework to use for on-site verification at installation and for building the reference file."
        }
      },
      {
        label: {
          fr: "Suivi en exploitation",
          en: "In-service monitoring"
        },
        title: {
          fr: "Essai de routine",
          en: "Routine test"
        },
        context: {
          fr: "Sorbonne installée après 2005",
          en: "Fume hood installed after 2005"
        },
        norms: [
          { fr: "NF EN 14175", en: "NF EN 14175" }
        ],
        text: {
          fr: "Le contrôle périodique suit le cadre normatif des sorbonnes installées après 2005 pour vérifier l'évolution des performances dans le temps.",
          en: "Periodic inspection follows the normative framework for fume hoods installed after 2005 to verify performance evolution over time."
        }
      },
      {
        label: {
          fr: "Suivi en exploitation",
          en: "In-service monitoring"
        },
        title: {
          fr: "Essai de routine",
          en: "Routine test"
        },
        context: {
          fr: "Sorbonne installée avant 2005",
          en: "Fume hood installed before 2005"
        },
        norms: [
          { fr: "XP X 15-203", en: "XP X 15-203" }
        ],
        text: {
          fr: "Le contrôle périodique se lit selon le référentiel applicable aux sorbonnes installées avant 2005, avec une logique de suivi annuelle.",
          en: "Periodic inspection is read against the framework applicable to fume hoods installed before 2005, with the same annual monitoring logic."
        }
      }
    ];

    return defaultCases.map((fallback, index) => {
      const source = Array.isArray(content.regulatory?.cases) ? content.regulatory.cases[index] || {} : {};
      return {
        label: source.label || fallback.label,
        title: source.title || fallback.title,
        context: source.context || fallback.context,
        norms: Array.isArray(source.norms) && source.norms.length ? source.norms : fallback.norms,
        text: source.text || fallback.text
      };
    });
  }

function regulatoryStageIconMarkup(tone) {
  switch (tone) {
    case "manufacturer":
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M4 10.5 12 4l8 6.5"></path>
          <path d="M6.5 9.5V20h11V9.5"></path>
          <path d="M10.5 20v-5.5h3V20"></path>
        </svg>`;
    case "site":
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M12 21s5-4.35 5-9a5 5 0 1 0-10 0c0 4.65 5 9 5 9Z"></path>
          <circle cx="12" cy="12" r="1.85"></circle>
        </svg>`;
    default:
      return `
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <circle cx="12" cy="12" r="8"></circle>
          <path d="M12 8v4.4l3 1.8"></path>
        </svg>`;
  }
}

function regulationsPreviewSection() {
  const regulationsUi = content.ui?.[lang()]?.home?.regulations || {};
  const obligations = (Array.isArray(content.regulatory?.obligations) ? content.regulatory.obligations : []).slice(0, 2);
  const stages = regulatoryJourneyStages();
  const definitions = regulatoryDefinitionEntries();
  const normCases = regulatoryNormCases();
  const sectionLabel = localize(regulationsUi.title) || localize({ fr: "Réglementation", en: "Regulations" });
  const sectionTitle = localize(regulationsUi.headline) || localize({
    fr: "Un cadre réglementaire lisible, avec des essais clairement distingués selon la situation de l'équipement.",
    en: "A clear regulatory framework with tests distinctly separated according to the equipment situation."
  });
  const sectionLead = localize(content.regulatory.intro);
  const flowLabel = localize(regulationsUi.flowLabel) || localize({ fr: "Schéma principal", en: "Main diagram" });
  const flowHeading = localize(regulationsUi.flowHeading) || localize({
    fr: "Parcours des essais selon la situation de l'équipement",
    en: "Inspection path according to the equipment situation"
  });
  const definitionsLabel = localize(regulationsUi.definitionsLabel) || localize({ fr: "Définitions", en: "Definitions" });
  const definitionsTitle = localize(regulationsUi.definitionsTitle) || localize({
    fr: "À quoi correspond chaque essai",
    en: "What each inspection covers"
  });
  const casesLabel = localize(regulationsUi.casesLabel) || localize({ fr: "Normes et cas d'application", en: "Standards and use cases" });
  const approvalButtonLabel = localize(regulationsUi.cta) || localize({
    fr: "Agrément Légifrance",
    en: "Legifrance approval"
  });

  return `
    <section class="section section--light home-regulations" id="${escapeHtml(sectionAnchors.regulations)}">
      <div class="shell">
        <div class="home-regulations__grid">
          <figure class="home-regulations__figure" data-reveal>
            <img src="${asset(editorial("regulations", "assets/images/editorial/technician-machine.jpg"))}" alt="${escapeHtml(editorialAlt("regulations"))}" loading="eager" decoding="async" fetchpriority="low" />
          </figure>
          <div class="home-regulations__content">
            <div class="home-regulations__intro" data-reveal>
              <div class="home-regulations__header">
                <span class="home-regulations__header-label">${escapeHtml(sectionLabel)}</span>
                <span class="home-regulations__header-line" aria-hidden="true"></span>
              </div>
              <h2 class="home-regulations__title">${escapeHtml(sectionTitle)}</h2>
              <p class="home-regulations__lead">${escapeHtml(sectionLead)}</p>
            </div>

            <div class="home-regulations__obligations">
              ${obligations
                .map(
                  (item) => `
                  <article class="home-regulations__obligation" data-reveal>
                    <h3>${escapeHtml(localize(item.title))}</h3>
                    <p>${escapeHtml(localize(item.text))}</p>
                  </article>`
                )
                .join("")}
            </div>

            <div class="home-regulations__diagram" data-reveal>
              <div class="home-regulations__diagram-grid">
                <div class="home-regulations__journey-panel">
                  <div class="home-regulations__diagram-head">
                    <span class="home-regulations__eyebrow">${escapeHtml(flowLabel)}</span>
                    <h3>${escapeHtml(flowHeading)}</h3>
                  </div>
                  <div class="home-regulations__journey">
                  ${stages
                    .map(
                      (item) => `
                      <article class="home-reg-stage home-reg-stage--${escapeHtml(item.tone)}" data-reveal>
                        <div class="home-reg-stage__rail" aria-hidden="true">
                          <span class="home-reg-stage__icon">${regulatoryStageIconMarkup(item.tone)}</span>
                        </div>
                        <div class="home-reg-stage__card">
                          <div class="home-reg-stage__meta">
                            <p class="home-reg-stage__eyebrow-line">
                              <span class="home-reg-stage__step">${escapeHtml(localize(item.step))}</span>
                              <span class="home-reg-stage__context">${escapeHtml(localize(item.context))}</span>
                            </p>
                            <h4>${escapeHtml(localize(item.title))}</h4>
                          </div>
                          <div class="home-reg-stage__tests home-reg-stage__tests--${item.tests.length > 1 ? "dual" : "single"}">
                          ${item.tests
                            .map(
                              (test) => `
                              <span class="home-reg-test${item.tone !== "routine" ? " home-reg-test--linked" : ""}">
                                <strong>${escapeHtml(localize(test.title))}</strong>
                              </span>`
                            )
                            .join("")}
                          </div>
                        </div>
                      </article>`
                    )
                    .join("")}
                  </div>
                </div>
                <div class="home-regulations__definitions">
                  <div class="home-regulations__definitions-head">
                    <span class="home-regulations__eyebrow">${escapeHtml(definitionsLabel)}</span>
                    <h4>${escapeHtml(definitionsTitle)}</h4>
                  </div>
                  <div class="home-regulations__definitions-list">
                    ${definitions
                      .map(
                        (item) => `
                        <article class="home-reg-definition" data-reveal>
                          <strong>${escapeHtml(localize(item.title))}</strong>
                          <p>${escapeHtml(localize(item.text))}</p>
                        </article>`
                      )
                      .join("")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="home-regulations__bottom">
          <div class="home-regulations__cases" data-reveal>
            <div class="home-regulations__cases-head">
              <span class="home-regulations__eyebrow">${escapeHtml(casesLabel)}</span>
            </div>
            <div class="home-regulations__cases-grid">
              ${normCases
                .map(
                  (item) => `
                  <article class="reg-norm-card home-regulations__case" data-reveal>
                    <span class="reg-norm-card__label">${escapeHtml(localize(item.label))}</span>
                    <h3>${escapeHtml(localize(item.title))}</h3>
                    <p class="reg-norm-card__context">${escapeHtml(localize(item.context))}</p>
                    <div class="reg-norm-card__chips">
                      ${item.norms.map((norm) => `<span>${escapeHtml(localize(norm))}</span>`).join("")}
                    </div>
                    <p>${escapeHtml(localize(item.text))}</p>
                  </article>`
                )
                .join("")}
            </div>
          </div>

          <div class="home-regulations__approval" data-reveal>
            <div class="home-regulations__approval-copy">
              <span class="section-kicker">${escapeHtml(localize({ fr: "Agrément", en: "Approval" }))}</span>
              <p>${escapeHtml(localize(content.regulatory.note))}</p>
            </div>
            ${buttonMarkup({
              href: content.company.approvalLink,
              label: approvalButtonLabel,
              variant: "primary",
              extraClass: "button--small home-regulations__approval-button home-regulations__approval-button--flag",
              target: "_blank"
            })}
          </div>
        </div>
      </div>
    </section>
  `;
}


function workCard(item, size = "", imageOptions = {}) {
  const image = Array.isArray(item.images) && item.images.length ? item.images[0] : null;
  const loading = imageOptions.loading === "eager" ? "eager" : "lazy";
  const fetchpriority = imageOptions.fetchpriority ? ` fetchpriority="${escapeHtml(imageOptions.fetchpriority)}"` : "";

  return `
    <article class="case-card ${size}" data-reveal>
      <a class="case-card__link" href="${workHref(item.slug)}">
        <div class="case-card__media">
          ${image ? `<img src="${asset(image.src)}" alt="${escapeHtml(localize(image.alt))}" loading="${loading}" decoding="async"${fetchpriority} />` : ""}
        </div>
        <div class="case-card__body">
          <div class="case-card__top">
            ${tinyBadge(localize(item.interventionType))}
            <span>${escapeHtml(formatDate(item.date))}</span>
          </div>
          <h3>${escapeHtml(localize(item.title))}</h3>
          <p>${escapeHtml(localize(item.shortDescription))}</p>
          <div class="case-card__meta">
            <span>${escapeHtml(localize(item.equipmentType))}</span>
            <span>${escapeHtml(localize(item.location))}</span>
          </div>
          <span class="text-link">${escapeHtml(tr("viewProject"))}</span>
        </div>
      </a>
    </article>
  `;
}

function homeWorkShowcaseCard(item, featured = false, imageOptions = {}) {
  const image = Array.isArray(item.images) && item.images.length ? item.images[0] : null;
  const loading = imageOptions.loading === "eager" ? "eager" : "lazy";
  const fetchpriority = imageOptions.fetchpriority ? ` fetchpriority="${escapeHtml(imageOptions.fetchpriority)}"` : "";
  const interventionLabel = localize(item.interventionType);
  const locationLabel = localize(item.location);
  const equipmentLabel = localize(item.equipmentType);
  const description = localize(item.shortDescription);

  return `
    <article class="home-work-card${featured ? " home-work-card--featured" : ""}" data-reveal>
      <a class="home-work-card__link" href="${workHref(item.slug)}">
        <div class="home-work-card__media">
          ${image ? `<img src="${asset(image.src)}" alt="${escapeHtml(localize(image.alt))}" loading="${loading}" decoding="async"${fetchpriority} />` : ""}
        </div>
        <span class="home-work-card__veil" aria-hidden="true"></span>
        <div class="home-work-card__body">
          <div class="home-work-card__eyebrow">
            ${interventionLabel ? `<span class="home-work-card__tag">${escapeHtml(interventionLabel)}</span>` : ""}
            ${locationLabel ? `<span class="home-work-card__location">${escapeHtml(locationLabel)}</span>` : ""}
          </div>
          <h3>${escapeHtml(localize(item.title))}</h3>
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
          <div class="home-work-card__footer">
            ${equipmentLabel ? `<span>${escapeHtml(equipmentLabel)}</span>` : ""}
            ${item.date ? `<span>${escapeHtml(formatDate(item.date))}</span>` : ""}
          </div>
          <span class="text-link home-work-card__readmore">${escapeHtml(tr("viewProject"))}</span>
        </div>
      </a>
    </article>
  `;
}


function articleCard(article, variant = "", imageOptions = {}) {
  const image = article.coverImage;
  const loading = imageOptions.loading === "eager" ? "eager" : "lazy";
  const fetchpriority = imageOptions.fetchpriority ? ` fetchpriority="${escapeHtml(imageOptions.fetchpriority)}"` : "";
  const isHomeGrid = variant.includes("article-card--home-grid");
  const categoryLabel = localize(article.category);
  const metaLabel = [formatDate(article.date), `${escapeHtml(String(article.readingTime))} min`].filter(Boolean).join(" · ");

  return `
    <article class="article-card ${variant}" data-reveal>
      <a class="article-card__link" href="${articleHref(article.slug)}">
        <div class="article-card__media">
          ${image ? `<img src="${asset(image.src)}" alt="${escapeHtml(localize(image.alt))}" loading="${loading}" decoding="async"${fetchpriority} />` : ""}
        </div>
        <div class="article-card__body">
          ${
            isHomeGrid
              ? `<div class="article-card__meta article-card__meta--home">
                  <span class="article-card__category">${escapeHtml(categoryLabel)}</span>
                  <span class="article-card__meta-line">${escapeHtml(metaLabel)}</span>
                </div>`
              : `<div class="article-card__meta">
                  ${tinyBadge(categoryLabel)}
                  <span>${escapeHtml(formatDate(article.date))}</span>
                  <span>${escapeHtml(String(article.readingTime))} min</span>
                </div>`
          }
          <h3>${escapeHtml(localize(article.title))}</h3>
          <p>${escapeHtml(localize(article.excerpt))}</p>
          <span class="text-link article-card__readmore">${escapeHtml(tr("readArticle"))}</span>
        </div>
      </a>
    </article>
  `;
}

function homeNewsFeatureCard(article, imageOptions = {}) {
  const image = article.coverImage;
  const loading = imageOptions.loading === "eager" ? "eager" : "lazy";
  const fetchpriority = imageOptions.fetchpriority ? ` fetchpriority="${escapeHtml(imageOptions.fetchpriority)}"` : "";
  const categoryLabel = localize(article.category);
  const metaLabel = [formatDate(article.date), `${String(article.readingTime)} min`].filter(Boolean).join(" · ");

  return `
    <article class="home-news-feature" data-reveal>
      <a class="home-news-feature__link" href="${articleHref(article.slug)}">
        <div class="home-news-feature__media">
          ${image ? `<img src="${asset(image.src)}" alt="${escapeHtml(localize(image.alt))}" loading="${loading}" decoding="async"${fetchpriority} />` : ""} 
        </div>
        <div class="home-news-feature__body">
          <div class="home-news-editorial__meta">
            <span class="home-news-editorial__category">${escapeHtml(categoryLabel)}</span>
            <span class="home-news-editorial__meta-line">${escapeHtml(metaLabel)}</span>
          </div>
          <h3>${escapeHtml(localize(article.title))}</h3>
          <p>${escapeHtml(localize(article.excerpt))}</p>
          <span class="text-link home-news-editorial__readmore">${escapeHtml(tr("readArticle"))}</span>
        </div>
      </a>
    </article>
  `;
}

function homeNewsCompactCard(article, imageOptions = {}) {
  const image = article.coverImage;
  const loading = imageOptions.loading === "eager" ? "eager" : "lazy";
  const fetchpriority = imageOptions.fetchpriority ? ` fetchpriority="${escapeHtml(imageOptions.fetchpriority)}"` : "";
  const categoryLabel = localize(article.category);
  const metaLabel = [formatDate(article.date), `${String(article.readingTime)} min`].filter(Boolean).join(" · ");

  return `
    <article class="home-news-note" data-reveal>
      <a class="home-news-note__link" href="${articleHref(article.slug)}">
        <div class="home-news-note__body">
          <div class="home-news-editorial__meta">
            <span class="home-news-editorial__category">${escapeHtml(categoryLabel)}</span>
            <span class="home-news-editorial__meta-line">${escapeHtml(metaLabel)}</span>
          </div>
          <h3>${escapeHtml(localize(article.title))}</h3>
          <p>${escapeHtml(localize(article.excerpt))}</p>
          <span class="text-link home-news-editorial__readmore">${escapeHtml(tr("readArticle"))}</span>
        </div>
        <div class="home-news-note__media">
          ${image ? `<img src="${asset(image.src)}" alt="${escapeHtml(localize(image.alt))}" loading="${loading}" decoding="async"${fetchpriority} />` : ""}
        </div>
      </a>
    </article>
  `;
}

function newsListItem(article, imageOptions = {}) {
  const image = article.coverImage;
  const loading = imageOptions.loading === "eager" ? "eager" : "lazy";
  const fetchpriority = imageOptions.fetchpriority ? ` fetchpriority="${escapeHtml(imageOptions.fetchpriority)}"` : "";
  const categoryLabel = localize(article.category);
  const metaLabel = [formatDate(article.date), `${String(article.readingTime)} min`].filter(Boolean).join(" · ");

  return `
    <article class="news-list-item" data-reveal>
      <a class="news-list-item__link" href="${articleHref(article.slug)}">
        <div class="news-list-item__media">
          ${image ? `<img src="${asset(image.src)}" alt="${escapeHtml(localize(image.alt))}" loading="${loading}" decoding="async"${fetchpriority} />` : ""}
        </div>
        <div class="news-list-item__body">
          <div class="news-list-item__meta">
            <span class="news-list-item__category">${escapeHtml(categoryLabel)}</span>
            <span class="news-list-item__meta-line">${escapeHtml(metaLabel)}</span>
          </div>
          <h2>${escapeHtml(localize(article.title))}</h2>
          <p>${escapeHtml(localize(article.excerpt))}</p>
          <span class="text-link news-list-item__readmore">${escapeHtml(tr("readArticle"))}</span>
        </div>
      </a>
    </article>
  `;
}


function homeWorksSection() {
  const featured = content.works.filter((item) => item.isFeatured).slice(0, 3);
  const fallback = featured.length ? featured : content.works.slice(0, 3);
  const leadWork = fallback[0] || null;
  const supportingWorks = fallback.slice(1, 3);
  const leadPreviewImageOptions = { loading: "eager", fetchpriority: "low" };
  const supportingPreviewImageOptions = { loading: "lazy" };

  return `
    <section class="section section--tone home-works">
      <div class="shell">
        <div class="home-works__header" data-reveal>
          <h2 class="home-works__title">${escapeHtml(localize(content.ui[lang()].nav.works))}</h2>
          <span class="home-works__title-line" aria-hidden="true"></span>
        </div>
        <div class="home-works__showcase">
          ${leadWork ? homeWorkShowcaseCard(leadWork, true, leadPreviewImageOptions) : ""}
          <div class="home-works__rail">
            ${supportingWorks.map((item) => homeWorkShowcaseCard(item, false, supportingPreviewImageOptions)).join("")}
          </div>
        </div>
        <div class="section-actions section-actions--center home-works__actions" data-reveal>
          ${buttonMarkup({ href: routes.works, label: tr("viewAllProjects"), variant: "secondary", extraClass: "home-works__cta" })}
        </div>
      </div>
    </section>
  `;
}


function homeNewsSection() {
  const articles = (Array.isArray(content.articles) ? content.articles : []).slice(0, 3);
  const leadArticle = articles[0] || null;
  const supportingArticles = articles.slice(1, 3);
  const leadPreviewImageOptions = { loading: "eager", fetchpriority: "low" };
  const supportingPreviewImageOptions = { loading: "lazy" };

  return `
    <section class="section section--light home-news">
      <div class="shell">
        <div class="home-news__header" data-reveal>
          <h2 class="home-news__title">${escapeHtml(localize(content.ui[lang()].news.title))}</h2>
          <span class="home-news__title-line" aria-hidden="true"></span>
        </div>
        <div class="home-news__magazine">
          ${leadArticle ? homeNewsFeatureCard(leadArticle, leadPreviewImageOptions) : ""}
          ${supportingArticles.length
            ? `<div class="home-news__stack">
                ${supportingArticles.map((article) => homeNewsCompactCard(article, supportingPreviewImageOptions)).join("")}
              </div>`
            : ""}
        </div>
        <div class="section-actions section-actions--center" data-reveal>
          ${buttonMarkup({ href: routes.news, label: tr("viewAllArticles"), variant: "secondary", extraClass: "home-news__cta" })}
        </div>
      </div>
    </section>
  `;
}

  function contactBandSection({ href = routes.contact, extraClass = "" } = {}) {
    return `
      <section class="section section--light home-contact-band-section contact-band-section ${escapeHtml(extraClass)}">
        <div class="shell">
          <div class="home-contact-band" data-reveal>
            <div class="home-contact-band__copy">
              <h2>${escapeHtml(localize({
                fr: "Un besoin de contrôle ou de vérification ?",
                en: "Need an inspection or verification?"
              }))}</h2>
              <p>${escapeHtml(localize({
                fr: "Présentez votre projet en quelques clics.",
                en: "Present your project in just a few clicks."
              }))}</p>
            </div>
            ${buttonMarkup({
              href,
              label: localize({
                fr: "Présenter votre besoin",
                en: "Present your project"
              }),
              variant: "primary",
              extraClass: "home-contact-band__button"
            })}
          </div>
        </div>
      </section>
    `;
  }

  function contactPanelSection() {
    return contactBandSection({
      href: page() === "contact" ? "#contact-form" : routes.contact,
      extraClass: "contact-band-section--inner"
    });
  }

  function homeContactBandSection() {
    return contactBandSection({
      href: routes.contact,
      extraClass: "contact-band-section--home"
    });
  }


function pageHero({ eyebrow, title, lead, image, imageAlt = "", chips = [], featuredLink = "" }) {
  const visibleChips = chips.filter(Boolean).slice(0, 3);

  return `
    <section class="page-hero">
      <div class="shell page-hero__grid">
        <div class="page-hero__copy" data-reveal>
          <span class="section-label">${escapeHtml(eyebrow)}</span>
          <h1 class="page-hero__title">${escapeHtml(title)}</h1>
          <p class="page-hero__lead">${escapeHtml(lead)}</p>
          ${visibleChips.length ? `<div class="page-hero__chips">${visibleChips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
          ${featuredLink}
        </div>
        <div class="page-hero__media" data-reveal>
          <div class="page-hero__frame">
            <img src="${asset(image)}" alt="${escapeHtml(imageAlt || title)}" loading="eager" decoding="async" fetchpriority="high" />
          </div>
        </div>
      </div>
    </section>
  `;
}

  function summaryCards(items) {
    return `
      <div class="summary-grid">
        ${items
          .map(
            (item) => `
            <article class="summary-card" data-reveal>
              <span class="summary-card__number">${escapeHtml(item.number)}</span>
              <h3>${escapeHtml(localize(item.title))}</h3>
              <p>${escapeHtml(localize(item.text))}</p>
            </article>`
          )
          .join("")}
      </div>
    `;
  }

  function serviceCatalogEntries() {
    return [
      ...content.coreServices.map((item) => ({
        id: item.id,
        slug: serviceSlugs[item.id] || item.id,
        catalogType: "core",
        groupLabel: {
          fr: "Contrôle des sorbonnes de laboratoire",
          en: "Laboratory fume hood inspections"
        },
        detailHeading: {
          fr: `${localize(item.badge, "fr")} — ${localize(item.title, "fr")}`,
          en: `${localize(item.badge, "en")} — ${localize(item.title, "en")}`
        },
        kicker: item.badge,
        title: item.title,
        norm: item.norm,
        excerpt: item.excerpt,
        summary: item.summary,
        detailIntro: item.detailIntro,
        checksTitle: item.checksTitle,
        detailChecklist: item.detailChecklist || [],
        checks: item.checks || [],
        detailModules: item.detailModules || [],
        hideDetailMedia: item.hideDetailMedia === true,
        media: item.media || [],
        image: item.image || ""
      })),
      ...content.equipmentCards.map((item) => ({
        id: item.id,
        slug: serviceSlugs[item.id] || item.id,
        catalogType: "equipment",
        detailHeading: item.detailHeading,
        groupLabel: item.groupLabel || item.name,
        kicker: "",
        title: item.title,
        norm: item.norm,
        excerpt: item.excerpt,
        summary: item.summary,
        detailIntro: item.detailIntro,
        detailNote: item.detailNote,
        textOnlyLead: item.textOnlyLead,
        textOnlyChecklistTitle: item.textOnlyChecklistTitle,
        textOnlyChecklistColumns: item.textOnlyChecklistColumns,
        checksTitle: item.checksTitle || {
          fr: "Points contrôlés",
          en: "Key checks"
        },
        detailChecklist: item.detailChecklist || [],
        checks: item.checks || [],
        detailModules: item.detailModules || [],
        hideDetailMedia: item.hideDetailMedia === true,
        media: item.image ? [item.image] : [],
        image: item.image || ""
      })),
      ...content.expertises.map((item) => ({
        id: item.id,
        slug: serviceSlugs[item.id] || item.id,
        catalogType: "expertise",
        detailHeading: item.detailHeading,
        groupLabel: {
          fr: "Accompagnements techniques",
          en: "Technical support"
        },
        kicker: item.badge,
        title: item.title,
        norm: "",
        excerpt: item.excerpt,
        summary: item.summary,
        detailIntro: item.detailIntro,
        detailNote: item.detailNote,
        textOnlyLead: item.textOnlyLead,
        textOnlyChecklistTitle: item.textOnlyChecklistTitle,
        textOnlyChecklistColumns: item.textOnlyChecklistColumns,
        checksTitle: item.checksTitle || {
          fr: "Périmètre",
          en: "Scope"
        },
        detailChecklist: item.detailChecklist || [],
        checks: item.checks || [],
        detailModules: item.detailModules || [],
        hideDetailMedia: item.hideDetailMedia === true,
        media: item.image ? [item.image] : [],
        image: item.image || ""
      }))
    ];
  }

  function servicePageHeading(item, forcedLang) {
    const activeLang = forcedLang || lang();
    const detailHeading = localize(item.detailHeading, activeLang);
    const group = localize(item.groupLabel, activeLang);
    const title = localize(item.title, activeLang);

    if (detailHeading) {
      return detailHeading;
    }

    if (!title) {
      return group;
    }

    if (item.catalogType === "expertise" || !group || group === title) {
      return title;
    }

    return `${group} - ${title}`;
  }

  function normalizeComparableText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[“”«»]/g, "")
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function serviceTeaserSegments(item, forcedLang) {
    const excerpt = localize(item.excerpt || item.summary || item.detailIntro, forcedLang).trim();
    const summary = localize(item.summary || item.detailIntro || item.excerpt, forcedLang).trim();
    const intro = localize(item.detailIntro || item.summary || item.excerpt, forcedLang).trim();
    const excerptComparable = normalizeComparableText(excerpt);
    const introComparable = normalizeComparableText(intro);
    const summaryComparable = normalizeComparableText(summary);

    let continuation = "";

    if (intro && excerpt && introComparable.startsWith(excerptComparable) && introComparable.length > excerptComparable.length) {
      continuation = intro.slice(excerpt.length).replace(/^[\s,;:–—-]+/, "").trim();
    } else if (intro && introComparable !== excerptComparable) {
      continuation = intro;
    } else if (summary && summaryComparable !== excerptComparable) {
      continuation = summary;
    }

    return {
      excerpt,
      continuation
    };
  }

  function serviceTeaserText(item, forcedLang) {
    return serviceTeaserSegments(item, forcedLang).continuation;
  }

  function serviceShowsDedicatedMedia(item) {
    return item?.catalogType === "core";
  }

  function servicePreferredCardImage(item) {
    const preferredCardImages = {
      "recirculation-routine": {
        src: "assets/images/realisations/controle-technique-laboratoire.jpg",
        alt: {
          fr: "Environnement de laboratoire technique pour une sorbonne à recirculation.",
          en: "Technical laboratory environment for a recirculating hood."
        }
      },
      "hotte-controle": {
        src: "assets/images/editorial/lab-bench.jpg",
        alt: {
          fr: "Paillasse de laboratoire illustrant une hotte de chimie.",
          en: "Laboratory bench illustrating a chemical hood."
        }
      }
    };

    return preferredCardImages[item?.id] || null;
  }

  function serviceMetaDescription(item, forcedLang) {
    return localize(item.excerpt || item.summary || item.detailIntro, forcedLang);
  }

  function serviceHubTitle(item, forcedLang) {
    const activeLang = forcedLang || lang();
    const primary = localize(item.groupLabel || item.name || item.title, activeLang);
    const secondary = localize(item.title, activeLang);

    if (item.catalogType === "expertise") {
      return secondary || primary;
    }

    if (!primary) {
      return secondary;
    }

    if (!secondary || primary === secondary) {
      return primary;
    }

    return `${primary} — ${secondary}`;
  }

  function serviceFallbackVisualData(item) {
    const curatedFallbacks = {
      "hotte-controle": {
        src: "assets/images/editorial/lab-bench.jpg",
        alt: {
          fr: "Environnement de laboratoire pour une hotte de chimie.",
          en: "Laboratory environment for a chemical hood."
        }
      },
      "bras-controle": {
        src: "assets/images/editorial/machine-room.jpg",
        alt: {
          fr: "Environnement technique correspondant à un bras orientable aspirant.",
          en: "Technical environment corresponding to an articulating extraction arm."
        }
      },
      "armoire-controle": {
        src: "assets/images/editorial/lab-hall.jpg",
        alt: {
          fr: "Environnement de laboratoire correspondant à une armoire ventilée.",
          en: "Laboratory environment corresponding to a ventilated cabinet."
        }
      },
      "maintenance-preventive": {
        src: "assets/images/editorial/technician-machine.jpg",
        alt: {
          fr: "Technicien intervenant dans le cadre d'une maintenance préventive.",
          en: "Technician carrying out preventive maintenance."
        }
      },
      "audit-aeraulique": {
        src: "assets/images/editorial/industrial-rooftop.jpg",
        alt: {
          fr: "Installations techniques correspondant à un audit aéraulique.",
          en: "Technical installations corresponding to an aeraulic audit."
        }
      },
      "prelevement-polluants": {
        src: "assets/images/editorial/glassware.jpg",
        alt: {
          fr: "Environnement de laboratoire correspondant à un prélèvement de polluants organiques.",
          en: "Laboratory environment corresponding to organic pollutant sampling."
        }
      }
    };

    if (curatedFallbacks[item.id]) {
      return {
        src: curatedFallbacks[item.id].src,
        alt: localize(curatedFallbacks[item.id].alt) || serviceHubTitle(item)
      };
    }

    return {
      src: editorial("serviceTeaser", siteSettings.defaultSocialImage),
      alt: editorialAlt("serviceTeaser", serviceHubTitle(item))
    };
  }

  function serviceImageEntries(item) {
    if (!serviceShowsDedicatedMedia(item)) {
      return [];
    }

    const title = serviceHubTitle(item);
    const entries = [];
    const seen = new Set();

    const pushEntry = (src, alt) => {
      if (!src || typeof src !== "string" || /\.mp4(\?|#|$)/i.test(src) || seen.has(src)) {
        return;
      }

      seen.add(src);
      entries.push({
        src,
        alt: alt || title
      });
    };

    if (Array.isArray(item.detailModules)) {
      item.detailModules.forEach((module) => {
        if (String(module?.mediaType || "image").toLowerCase() === "video") {
          return;
        }

        pushEntry(
          module?.mediaSrc || "",
          localize(module?.mediaAlt) || localize(module?.title) || title
        );
      });
    }

    if (Array.isArray(item.media)) {
      item.media.forEach((src) => {
        pushEntry(src, title);
      });
    }

    pushEntry(item.image || "", title);

    if (!entries.length) {
      const fallback = serviceFallbackVisualData(item);
      pushEntry(fallback.src, fallback.alt);
    }

    return entries;
  }

  function serviceCardImageEntries(item) {
    const title = serviceHubTitle(item);
    const entries = [];
    const seen = new Set();

    const pushEntry = (src, alt) => {
      if (!src || typeof src !== "string" || /\.mp4(\?|#|$)/i.test(src) || seen.has(src)) {
        return;
      }

      seen.add(src);
      entries.push({
        src,
        alt: alt || title
      });
    };

    const preferredImage = servicePreferredCardImage(item);
    if (preferredImage) {
      pushEntry(preferredImage.src, localize(preferredImage.alt) || title);
    }

    if (Array.isArray(item.detailModules)) {
      item.detailModules.forEach((module) => {
        if (String(module?.mediaType || "image").toLowerCase() === "video") {
          return;
        }

        pushEntry(
          module?.mediaSrc || "",
          localize(module?.mediaAlt) || localize(module?.title) || title
        );
      });
    }

    if (Array.isArray(item.media)) {
      item.media.forEach((src) => {
        pushEntry(src, title);
      });
    }

    pushEntry(item.image || "", title);

    if (!entries.length) {
      const fallback = serviceFallbackVisualData(item);
      pushEntry(fallback.src, fallback.alt);
    }

    return entries;
  }

  function serviceVisualData(item) {
    return serviceImageEntries(item)[0] || serviceFallbackVisualData(item);
  }

  function serviceCardVisualData(item) {
    return serviceCardImageEntries(item)[0] || serviceFallbackVisualData(item);
  }

  function serviceHubVisualData(item) {
    return serviceCardVisualData(item);
  }

  function servicePrimaryImage(item) {
    return serviceVisualData(item).src;
  }

  function serviceHubCard(item) {
    const hasMedia = serviceCardImageEntries(item).length > 0;
    const image = hasMedia ? serviceHubVisualData(item) : null;
    const title = serviceHubTitle(item);
    const groupLabel = localize(item.groupLabel);
    const description = serviceMetaDescription(item) || serviceTeaserText(item);
    const ctaLabel = localize({
      fr: "Voir la prestation",
      en: "View service"
    });
    const linkClassName = hasMedia ? "service-hub-card__link" : "service-hub-card__link service-hub-card__link--text";

    return `
      <article class="service-hub-card" data-reveal>
        <a class="${linkClassName}" href="${serviceHref(item.slug || item.id)}">
          ${
            hasMedia
              ? `
              <div class="service-hub-card__media">
                <img src="${asset(image.src)}" alt="${escapeHtml(image.alt || title)}" loading="lazy" decoding="async" />
              </div>`
              : ""
          }
          <div class="service-hub-card__body">
            <div class="service-hub-card__meta">
              ${groupLabel ? `<span class="service-hub-card__group">${escapeHtml(groupLabel)}</span>` : ""}
            </div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(description)}</p>
            <span class="service-hub-card__cta">${escapeHtml(ctaLabel)}</span>
          </div>
        </a>
      </article>
    `;
  }

  function findServiceBySlug() {
    const slug = new URLSearchParams(window.location.search).get("slug") || slugFromPrettyPath("services");
    if (!slug) {
      return null;
    }

    const decoded = decodeURIComponent(slug);
    return serviceCatalogEntries().find((item) => item.slug === decoded || item.slug === slug) || null;
  }

  function serviceSchema(item, path) {
    return {
      "@type": "Service",
      name: servicePageHeading(item),
      description: serviceMetaDescription(item) || serviceTeaserText(item),
      serviceType: localize(item.title),
      url: absoluteUrl(path),
      provider: {
        "@type": "Organization",
        name: content.company?.name || "Control'Air",
        url: siteSettings.canonicalOrigin
      },
      areaServed: {
        "@type": "Country",
        name: "France"
      }
    };
  }

  function normalizedText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function serviceOverviewFacts(item) {
    return [
      {
        label: localize({
          fr: "Famille",
          en: "Category"
        }),
        value: localize(item.groupLabel)
      },
      {
        label: localize({
          fr: "\u00c9quipement",
          en: "Equipment"
        }),
        value: localize(item.kicker)
      },
      {
        label: localize({
          fr: "Intervention",
          en: "Service"
        }),
        value: localize(item.title)
      },
      {
        label: localize({
          fr: "R\u00e9f\u00e9rence",
          en: "Reference"
        }),
        value: localize(item.norm)
      }
    ].filter((entry) => normalizedText(entry.value));
  }

  function serviceDetailHeroMarkup({ item, title, lead, summary, backToServicesLabel }) {
    const image = serviceVisualData(item);
    const factItems = [
      localize(item.groupLabel),
      localize(item.kicker),
      localize(item.norm)
    ].filter(Boolean).slice(0, 3);
    const summaryNote = normalizedText(summary) && normalizedText(summary) !== normalizedText(lead) ? summary : "";
    const signalText = [localize(item.title), localize(item.kicker || item.norm || item.groupLabel)]
      .filter(Boolean)
      .join(" · ");

    return `
      <section class="service-detail-hero">
        <div class="shell service-detail-hero__grid">
          <div class="service-detail-hero__copy" data-reveal>
            <a class="service-detail-hero__back" href="${routes.services}">
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M19 12H5"></path>
                  <path d="M12 19l-7-7 7-7"></path>
                </svg>
              </span>
              <span>${escapeHtml(backToServicesLabel)}</span>
            </a>
            <span class="section-label">${escapeHtml(localize(content.ui[lang()].services.heroEyebrow))}</span>
            <h1 class="service-detail-hero__title">${escapeHtml(title)}</h1>
            <p class="service-detail-hero__lead">${escapeHtml(lead)}</p>
            ${
              factItems.length
                ? `<div class="service-detail-hero__chips">${factItems.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>`
                : ""
            }
            <div class="service-detail-hero__actions">
              ${buttonMarkup({
                href: routes.contact,
                label: tr("ctaPrimary") || localize({ fr: "Pr\u00e9senter votre besoin", en: "Present your need" }),
                variant: "primary"
              })}
            </div>
            ${
              summaryNote
                ? `<p class="service-detail-hero__summary">${escapeHtml(summaryNote)}</p>`
                : ""
            }
          </div>

          <div class="service-detail-hero__visual" data-reveal>
            <figure class="service-detail-hero__frame">
              <img src="${asset(image.src)}" alt="${escapeHtml(image.alt || title)}" loading="eager" decoding="async" />
            </figure>
            <div class="service-detail-hero__signal">
              <span>${escapeHtml(localize({ fr: "Rep\u00e8re visuel", en: "Visual marker" }))}</span>
              <strong>${escapeHtml(localize(item.title))}</strong>
              <p>${escapeHtml(signalText || localize(item.groupLabel) || title)}</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function serviceDetailOverviewMarkup({ item, intro, summary }) {
    const facts = serviceOverviewFacts(item);
    const summaryDeck = normalizedText(summary) && normalizedText(summary) !== normalizedText(intro) ? summary : "";

    return `
      <section class="section section--light">
        <div class="shell service-detail-overview">
          <div class="service-detail-overview__grid">
            <article class="service-detail-overview__copy" data-reveal>
              <span class="section-label">${escapeHtml(localize({ fr: "Pr\u00e9sentation", en: "Overview" }))}</span>
              <h2>${escapeHtml(localize({ fr: "La prestation", en: "The service" }))}</h2>
              ${summaryDeck ? `<p class="service-detail-overview__deck">${escapeHtml(summaryDeck)}</p>` : ""}
              <div class="service-detail-overview__body">
                <p>${escapeHtml(intro)}</p>
              </div>
            </article>

            <aside class="service-detail-overview__aside" data-reveal>
              <span class="section-label">${escapeHtml(localize({ fr: "Rep\u00e8res", en: "Quick facts" }))}</span>
              <h2>${escapeHtml(localize({ fr: "Points de rep\u00e8re", en: "Useful markers" }))}</h2>
              ${
                facts.length
                  ? `
                  <dl class="service-detail-facts">
                    ${facts
                      .map(
                        (fact) => `
                        <div class="service-detail-facts__row">
                          <dt>${escapeHtml(fact.label)}</dt>
                          <dd>${escapeHtml(fact.value)}</dd>
                        </div>`
                      )
                      .join("")}
                  </dl>`
                  : ""
              }
              <div class="service-detail-overview__aside-action">
                ${buttonMarkup({
                  href: routes.contact,
                  label: tr("ctaPrimary") || localize({ fr: "Pr\u00e9senter votre besoin", en: "Present your need" }),
                  variant: "secondary",
                  extraClass: "button--small"
                })}
              </div>
            </aside>
          </div>
        </div>
      </section>
    `;
  }

  function serviceChecklistSectionMarkup(checks, title) {
    if (!Array.isArray(checks) || !checks.length) {
      return "";
    }

    return `
      <section class="section section--paper">
        <div class="shell">
          ${sectionIntroMarkup({
            label: localize({ fr: "Points contr\u00f4l\u00e9s", en: "Key checks" }),
            title,
            lead: localize({
              fr: "Une lecture plus visuelle des v\u00e9rifications pr\u00e9vues pendant l'intervention.",
              en: "A more visual reading of the checks carried out during the service."
            })
          })}
          <div class="service-check-grid">
            ${checks
              .map(
                (check, index) => `
                <article class="service-check-card" data-reveal>
                  <span class="service-check-card__index">${String(index + 1).padStart(2, "0")}</span>
                  <p>${escapeHtml(localize(check))}</p>
                </article>`
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  function serviceDetailStoryMarkup(modules, fallbackTitle) {
    if (!Array.isArray(modules) || !modules.length) {
      return "";
    }

    const stepLabel = localize({
      fr: "\u00c9tape",
      en: "Step"
    });

    return `
      <div class="service-detail-story">
        ${modules
          .map((module, index) => {
            const moduleTitle = localize(module.title) || fallbackTitle;
            const moduleBody = localize(module.body);
            const moduleAlt = localize(module.mediaAlt) || moduleTitle;
            const mediaType = String(module.mediaType || "image").toLowerCase();
            const mediaSrc = module.mediaSrc ? asset(module.mediaSrc) : "";
            const reverseClass = index % 2 ? " service-detail-story__item--reverse" : "";
            const mediaMarkup = mediaSrc
              ? mediaType === "video"
                ? `
                  <video controls playsinline preload="metadata" aria-label="${escapeHtml(moduleAlt)}">
                    <source src="${mediaSrc}" type="video/mp4" />
                  </video>`
                : `<img src="${mediaSrc}" alt="${escapeHtml(moduleAlt)}" loading="lazy" decoding="async" />`
              : "";

            return `
              <article class="service-detail-story__item${reverseClass}" data-reveal>
                ${
                  mediaMarkup
                    ? `<div class="service-detail-story__media service-detail-story__media--${escapeHtml(mediaType)}">${mediaMarkup}</div>`
                    : ""
                }
                <div class="service-detail-story__copy">
                  <span class="service-detail-story__step">${escapeHtml(stepLabel)} ${String(index + 1).padStart(2, "0")}</span>
                  <h3>${escapeHtml(moduleTitle)}</h3>
                  <p>${escapeHtml(moduleBody)}</p>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function serviceCompactStoryMarkup(item, checklist) {
    const images = serviceImageEntries(item).slice(0, 3);
    const primaryImage = images[0] || serviceVisualData(item);
    const lead = localize(item.summary || item.excerpt || item.detailIntro);
    const secondaryText = localize(item.detailIntro || item.summary || item.excerpt);
    const supportingText = normalizedText(secondaryText) !== normalizedText(lead) ? secondaryText : "";

    return `
      <div class="service-compact-story" data-reveal>
        <div class="service-compact-story__visual">
          <figure class="service-compact-story__main">
            <img src="${asset(primaryImage.src)}" alt="${escapeHtml(primaryImage.alt || serviceHubTitle(item))}" loading="lazy" decoding="async" />
          </figure>
          ${
            images.length > 1
              ? `
              <div class="service-compact-story__thumbs">
                ${images
                  .slice(1)
                  .map(
                    (image) => `
                    <figure class="service-compact-story__thumb">
                      <img src="${asset(image.src)}" alt="${escapeHtml(image.alt || serviceHubTitle(item))}" loading="lazy" decoding="async" />
                    </figure>`
                  )
                  .join("")}
              </div>`
              : ""
          }
        </div>

        <div class="service-compact-story__copy">
          <span class="service-detail-story__step">${escapeHtml(localize({ fr: "Vue d'ensemble", en: "Overview" }))}</span>
          <h3>${escapeHtml(localize({ fr: "L'intervention en contexte", en: "The service in context" }))}</h3>
          <p>${escapeHtml(lead)}</p>
          ${supportingText ? `<p class="service-compact-story__secondary">${escapeHtml(supportingText)}</p>` : ""}
          ${
            checklist.length
              ? `
              <ul class="service-compact-story__list" role="list">
                ${checklist
                  .slice(0, 4)
                  .map((check) => `<li>${escapeHtml(localize(check))}</li>`)
                  .join("")}
              </ul>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function serviceMinimalModulesMarkup(modules, fallbackTitle) {
    if (!Array.isArray(modules) || !modules.length) {
      return "";
    }

    return `
      <div class="service-detail-minimal__modules">
        ${modules
          .map((module, index) => {
            const moduleTitle = localize(module.title) || fallbackTitle;
            const moduleBody = localize(module.body);
            const moduleAlt = localize(module.mediaAlt) || moduleTitle;
            const mediaType = String(module.mediaType || "image").toLowerCase();
            const mediaSrc = module.mediaSrc ? asset(module.mediaSrc) : "";
            const reverseClass = index % 2 ? " service-detail-minimal__module--reverse" : "";
            const mediaMarkup = mediaSrc
              ? mediaType === "video"
                ? `
                  <video controls playsinline preload="metadata" aria-label="${escapeHtml(moduleAlt)}">
                    <source src="${mediaSrc}" type="video/mp4" />
                  </video>`
                : `<img src="${mediaSrc}" alt="${escapeHtml(moduleAlt)}" loading="lazy" decoding="async" />`
              : "";

            return `
              <article class="service-detail-minimal__module${reverseClass}" data-reveal>
                ${
                  mediaMarkup
                    ? `<div class="service-detail-minimal__media service-detail-minimal__media--${escapeHtml(mediaType)}">${mediaMarkup}</div>`
                    : ""
                }
                <div class="service-detail-minimal__copy">
                  <h2>${escapeHtml(moduleTitle)}</h2>
                  ${moduleBody ? `<p>${escapeHtml(moduleBody)}</p>` : ""}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function serviceMinimalFallbackMarkup(item) {
    const detailNote = localize(item.detailNote);
    const moduleBody = localize(item.textOnlyLead || item.detailIntro || item.summary || item.excerpt);
    const detailChecklist = Array.isArray(item.detailChecklist) && item.detailChecklist.length ? item.detailChecklist : item.checks || [];
    const checklistTitle = localize(item.textOnlyChecklistTitle);
    const checklistColumns = Number(item.textOnlyChecklistColumns || 1);
    const listClassName = checklistColumns > 1
      ? `service-detail-minimal__list service-detail-minimal__list--columns-${checklistColumns}`
      : "service-detail-minimal__list";

    return `
      <div class="service-detail-minimal__modules">
        <article class="service-detail-minimal__text" data-reveal>
          ${detailNote ? `<p class="service-detail-minimal__note">${escapeHtml(detailNote)}</p>` : ""}
          ${moduleBody ? `<div class="service-detail-minimal__prose"><p>${escapeHtml(moduleBody)}</p></div>` : ""}
          ${
            detailChecklist.length
              ? `
              ${checklistTitle ? `<h2 class="service-detail-minimal__subheading">${escapeHtml(checklistTitle)}</h2>` : ""}
              <ul class="${listClassName}" role="list">
                ${detailChecklist.map((check) => `<li>${escapeHtml(localize(check))}</li>`).join("")}
              </ul>`
              : ""
          }
        </article>
      </div>
    `;
  }

  function serviceDetailModulesMarkup(modules, fallbackTitle) {
    if (!Array.isArray(modules) || !modules.length) {
      return "";
    }

    return `
      <div class="service-accordion__modules">
        ${modules
          .map((module) => {
            const moduleTitle = localize(module.title) || fallbackTitle;
            const moduleBody = localize(module.body);
            const moduleAlt = localize(module.mediaAlt) || moduleTitle;
            const mediaType = String(module.mediaType || "image").toLowerCase();
            const mediaSrc = module.mediaSrc ? asset(module.mediaSrc) : "";

            const mediaMarkup = mediaSrc
              ? mediaType === "video"
                ? `
                  <video controls playsinline preload="metadata" aria-label="${escapeHtml(moduleAlt)}">
                    <source src="${mediaSrc}" type="video/mp4" />
                  </video>`
                : `<img src="${mediaSrc}" alt="${escapeHtml(moduleAlt)}" loading="lazy" decoding="async" />`
              : "";

            return `
              <article class="service-detail-module">
                ${
                  mediaMarkup
                    ? `<div class="service-detail-module__media service-detail-module__media--${escapeHtml(mediaType)}">
                        ${mediaMarkup}
                      </div>`
                    : ""
                }
                <div class="service-detail-module__copy">
                  <h3>${escapeHtml(moduleTitle)}</h3>
                  <p>${escapeHtml(moduleBody)}</p>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function serviceAccordionItem(item, options = {}) {
    const panelId = `service-panel-${item.id}`;
    const itemClass = options.variant ? ` service-accordion__item--${escapeHtml(options.variant)}` : "";
    const titleTag = options.titleTag || "h2";
    const detailMode = options.detailMode || "full";
    const isTeaserMode = detailMode === "teaser";
    const openLabel = localize({
      fr: "Voir le détail",
      en: "View details"
    });
    const closeLabel = localize({
      fr: "Refermer",
      en: "Close"
    });
    const collapseEndLabel = localize({
      fr: "Replier cette prestation",
      en: "Collapse this service"
    });
    const detailLinkLabel = localize({
      fr: "Voir la prestation",
      en: "View service"
    });
    const detailLinkAria = localize({
      fr: `Voir la page dédiée à ${servicePageHeading(item, "fr")}`,
      en: `View the dedicated page for ${servicePageHeading(item, "en")}`
    });
    const teaserSegments = serviceTeaserSegments(item);
    const excerptText = teaserSegments.excerpt;
    const detailLead = isTeaserMode
      ? excerptText
      : localize(item.detailIntro || item.summary || item.excerpt);
    const teaserLead = teaserSegments.continuation;
    const detailChecklist = Array.isArray(item.detailChecklist) && item.detailChecklist.length ? item.detailChecklist : item.checks || [];
    const hasRichDetail = Array.isArray(item.detailModules) && item.detailModules.length > 0;
    const hasStructuredDetail = Boolean(
      item.excerpt ||
      item.detailIntro ||
      (Array.isArray(item.detailChecklist) && item.detailChecklist.length) ||
      hasRichDetail ||
      item.hideDetailMedia
    );
    const contentClassName = `service-accordion__content${hasRichDetail ? " service-accordion__content--rich" : ""}${isTeaserMode ? " service-accordion__content--teaser" : ""}`;
    const copyClassName = `service-accordion__copy${hasRichDetail ? " service-accordion__copy--rich" : ""}${isTeaserMode ? " service-accordion__copy--teaser" : ""}`;
    const detailHref = serviceHref(item.slug || item.id);
    const teaserMarkup = `
      <div class="${copyClassName}">
        ${teaserLead ? `<p class="service-accordion__lead">${escapeHtml(teaserLead)}</p>` : ""}
        <div class="service-accordion__actions">
          ${buttonMarkup({
            href: detailHref,
            label: detailLinkLabel,
            variant: "secondary",
            extraClass: "button--small service-accordion__link"
          }).replace("<a ", `<a aria-label="${escapeHtml(detailLinkAria)}" `)}
        </div>
      </div>
    `;

    return `
      <article class="service-accordion__item${itemClass}" id="${escapeHtml(item.id)}" data-service-accordion-item>
        <div class="service-accordion__head">
          <div class="service-accordion__summary">
            <span class="service-accordion__group">${escapeHtml(localize(item.groupLabel))}</span>
            ${item.kicker ? `<p class="service-accordion__kicker">${escapeHtml(localize(item.kicker))}</p>` : ""}
            <${titleTag}>${escapeHtml(localize(item.title))}</${titleTag}>
            ${item.norm ? `<p class="service-accordion__norm">${escapeHtml(localize(item.norm))}</p>` : ""}
            <p
              class="service-accordion__excerpt"
              data-service-excerpt
              data-closed-text="${escapeHtml(excerptText)}"
              data-open-text="${escapeHtml(detailLead)}"
            >${escapeHtml(excerptText)}</p>
          </div>

          <button
            class="service-accordion__toggle"
            type="button"
            aria-expanded="false"
            aria-controls="${escapeHtml(panelId)}"
            data-service-toggle
            data-open-label="${escapeHtml(openLabel)}"
            data-close-label="${escapeHtml(closeLabel)}"
          >
            <span data-service-toggle-text>${escapeHtml(openLabel)}</span>
            <span class="service-accordion__toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6"></path>
              </svg>
            </span>
          </button>
        </div>

        <div class="service-accordion__panel" id="${escapeHtml(panelId)}" data-service-panel>
          <div class="service-accordion__panel-inner">
            <div class="${contentClassName}">
              ${
                isTeaserMode
                  ? teaserMarkup
                  : `
                  <div class="${copyClassName}">
                    ${
                      detailChecklist && detailChecklist.length
                        ? `
                        <div class="service-accordion__checklist">
                          <h3>${escapeHtml(localize(item.checksTitle))}</h3>
                          <ul role="list">
                            ${detailChecklist.map((check) => `<li>${escapeHtml(localize(check))}</li>`).join("")}
                          </ul>
                        </div>`
                        : !hasStructuredDetail ? `
                        <div class="service-accordion__checklist service-accordion__checklist--compact">
                          <h3>${escapeHtml(localize(item.checksTitle))}</h3>
                          <p>${escapeHtml(detailLead)}</p>
                        </div>` : ""
                    }
                    ${hasRichDetail ? serviceDetailModulesMarkup(item.detailModules, localize(item.title)) : ""}
                  </div>

                  ${
                    !hasRichDetail && !item.hideDetailMedia && item.media && item.media.length
                      ? `
                      <div class="service-accordion__gallery service-accordion__gallery--${Math.min(item.media.length, 3)}">
                        ${item.media
                          .slice(0, 3)
                          .map(
                            (src) => `
                            <figure class="service-accordion__figure">
                              <img src="${asset(src)}" alt="${escapeHtml(localize(item.title))}" loading="lazy" decoding="async" />
                            </figure>`
                          )
                          .join("")}
                      </div>`
                      : ""
                  }
                `
              }
            </div>

            ${
              isTeaserMode
                ? ""
                : `
                <div class="service-accordion__footer">
                  <button class="service-accordion__collapse" type="button" data-service-collapse-end>
                    <span>${escapeHtml(collapseEndLabel)}</span>
                    <span class="service-accordion__collapse-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M18 15l-6-6-6 6"></path>
                      </svg>
                    </span>
                  </button>
                </div>
              `
            }
          </div>
        </div>
      </article>
    `;
  }

  function serviceDetailPage() {
    const item = findServiceBySlug();
    const backToServicesLabel = localize({
      fr: "Retour aux prestations",
      en: "Back to services"
    });

    if (!item) {
      setMeta(pageTitles.serviceDetail[lang()], tr("noResultsTitle"), {
        path: prettyPath("services"),
        image: editorial("serviceTeaser", siteSettings.defaultSocialImage),
        breadcrumbs: [
          { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
          { name: localize(content.ui[lang()].nav.services), path: prettyPath("services") }
        ]
      });
      return `
        <section class="section section--dark">
          <div class="shell empty-state">
            <h1>${escapeHtml(tr("noResultsTitle"))}</h1>
            <p>${escapeHtml(tr("noResultsText"))}</p>
            ${buttonMarkup({ href: routes.services, label: backToServicesLabel, variant: "primary" })}
          </div>
        </section>
      `;
    }

    const detailPath = `${prettyPath("services")}/${encodeURIComponent(item.slug)}`;
    const title = servicePageHeading(item);
    const description = serviceMetaDescription(item) || serviceTeaserText(item);
    const hasRichDetail = Array.isArray(item.detailModules) && item.detailModules.length > 0;

    setMeta(`${title} | Control'Air`, description, {
      path: detailPath,
      image: servicePrimaryImage(item),
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(content.ui[lang()].nav.services), path: prettyPath("services") },
        { name: title, path: detailPath }
      ],
      extraSchemas: [serviceSchema(item, detailPath)]
    });

    if (!isLocalPreview()) {
      if (window.location.pathname !== detailPath || window.location.search) {
        window.history.replaceState({}, "", detailPath);
      }
    }

    return `
      <section class="section section--light service-detail-minimal">
        <div class="shell service-detail-minimal__inner">
          <header class="service-detail-minimal__header" data-reveal>
            <div class="service-detail-minimal__topline">
              <span class="service-detail-minimal__eyebrow">${escapeHtml(localize(content.ui[lang()].services.heroEyebrow))}</span>
              <a class="service-detail-minimal__back" href="${routes.services}">
                <span aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M19 12H5"></path>
                    <path d="M12 19l-7-7 7-7"></path>
                  </svg>
                </span>
                <span>${escapeHtml(backToServicesLabel)}</span>
              </a>
            </div>
            <h1 class="service-detail-minimal__title">${escapeHtml(title)}</h1>
          </header>

          ${
            hasRichDetail
              ? serviceMinimalModulesMarkup(item.detailModules, localize(item.title))
              : serviceMinimalFallbackMarkup(item)
          }
        </div>
      </section>

      ${contactPanelSection()}
    `;
  }

  function servicesPage() {
    const serviceEntries = serviceCatalogEntries();

    setMeta(pageTitles.services[lang()], localize(content.ui[lang()].services.lead), {
      path: prettyPath("services"),
      image: servicePrimaryImage(serviceEntries[0] || {}),
      pageType: "CollectionPage",
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(content.ui[lang()].nav.services), path: prettyPath("services") }
      ],
      extraSchemas: [
        itemListSchema({
          name: localize(content.ui[lang()].nav.services),
          path: prettyPath("services"),
          items: serviceEntries.map((item) => ({
            name: serviceHubTitle(item),
            path: `${prettyPath("services")}/${encodeURIComponent(item.slug)}`
          }))
        })
      ]
    });

    return `
      <section class="section section--light service-hub">
        <div class="shell">
          <div class="service-hub__header" data-reveal>
            <h1 class="service-hub__title">${escapeHtml(localize({ fr: "Nos Prestations", en: "Our Services" }))}</h1>
            <span class="service-hub__line" aria-hidden="true"></span>
          </div>
          <div class="service-hub__grid">
            ${serviceEntries.map((item) => serviceHubCard(item)).join("")}
          </div>
        </div>
      </section>

      ${contactPanelSection()}
    `;
  }

  function regulationsPage() {
    setMeta(pageTitles.regulations[lang()], localize(content.ui[lang()].regulations.lead), {
      path: prettyPath("regulations"),
      image: editorial("regulations", siteSettings.defaultSocialImage),
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(content.ui[lang()].nav.regulations), path: prettyPath("regulations") }
      ]
    });
    const regulationsUi = content.ui?.[lang()]?.home?.regulations || {};
    const obligations = Array.isArray(content.regulatory.obligations) ? content.regulatory.obligations.slice(0, 2) : [];
    const processStages = regulatoryJourneyStages();
    const normCases = regulatoryNormCases();
    const approvalButtonLabel = localize(regulationsUi.cta) || localize({
      fr: "Agrément Légifrance",
      en: "Legifrance approval"
    });

    return `
      ${pageHero({
        eyebrow: localize(content.ui[lang()].regulations.heroEyebrow),
        title: localize(content.ui[lang()].regulations.title),
        lead: localize(content.regulatory.intro),
        image: editorial("regulations", "assets/images/editorial/technician-machine.jpg"),
        chips: [
          localize(obligations[0]?.title),
          localize(obligations[1]?.title),
          localize(content.regulatory.journey?.[2]?.tests?.[0])
        ]
      })}

      <section class="section section--light">
        <div class="shell">
          ${sectionIntroMarkup({
            label: localize({ fr: "Cadre réglementaire", en: "Regulatory framework" }),
            title: localize({ fr: "Les obligations essentielles à retenir", en: "The key obligations to keep in mind" }),
            lead: localize(content.regulatory.intro)
          })}
          <div class="reg-overview-grid">
            ${obligations
              .map(
                (item, index) => `
                <article class="reg-obligation-card" data-reveal>
                  <span class="reg-obligation-card__index">${String(index + 1).padStart(2, "0")}</span>
                  <h3>${escapeHtml(localize(item.title))}</h3>
                  <p>${escapeHtml(localize(item.text))}</p>
                </article>`
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="section section--paper">
        <div class="shell">
          ${sectionIntroMarkup({
            label: localize({ fr: "Processus réglementaire", en: "Regulatory process" }),
            title: localize({ fr: "Du fabricant au suivi périodique", en: "From manufacturer validation to periodic follow-up" }),
            lead: localize({
              fr: "Chaque essai correspond à un moment précis du cycle de vie de l'équipement. L'objectif est de distinguer clairement la validation initiale, la vérification sur site et le suivi en exploitation.",
              en: "Each test corresponds to a specific stage in the equipment lifecycle. The goal is to clearly distinguish initial validation, on-site verification and in-service follow-up."
            })
          })}
          <div class="reg-process">
            ${processStages
              .map(
                (item) => `
                <article class="reg-stage-card" data-reveal>
                  <div class="reg-stage-card__head">
                    <span class="reg-stage-card__step">${escapeHtml(localize({ fr: `Étape ${item.number}`, en: `Step ${item.number}` }))}</span>
                    <span class="reg-stage-card__context">${escapeHtml(localize(item.context))}</span>
                  </div>
                  <h3>${escapeHtml(localize(item.title))}</h3>
                  <div class="reg-stage-card__tests">
                    ${item.tests
                      .map(
                        (test) => `
                        <article class="reg-stage-card__test">
                          <strong>${escapeHtml(localize(test.title))}</strong>
                          <p>${escapeHtml(localize(test.text))}</p>
                        </article>`
                      )
                      .join("")}
                  </div>
                </article>`
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="section section--light">
        <div class="shell">
          ${sectionIntroMarkup({
            label: localize({ fr: "Normes et cas d'application", en: "Standards and use cases" }),
            title: localize({ fr: "Quel essai selon la situation de l'équipement ?", en: "Which test applies to the equipment situation?" }),
            lead: localize({
              fr: "La lecture des normes se fait toujours en lien avec le moment de vie de la sorbonne et avec la distinction avant ou après 2005.",
              en: "Standards must always be read in connection with the hood lifecycle stage and with the distinction between before and after 2005."
            })
          })}
          <div class="reg-norm-grid">
            ${normCases
              .map(
                (item) => `
                <article class="reg-norm-card" data-reveal>
                  <span class="reg-norm-card__label">${escapeHtml(localize(item.label))}</span>
                  <h3>${escapeHtml(localize(item.title))}</h3>
                  <p class="reg-norm-card__context">${escapeHtml(localize(item.context))}</p>
                  <div class="reg-norm-card__chips">
                    ${item.norms.map((norm) => `<span>${escapeHtml(localize(norm))}</span>`).join("")}
                  </div>
                  <p>${escapeHtml(localize(item.text))}</p>
                </article>`
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="section section--tone-alt">
        <div class="shell">
          <div class="reg-approval-card" data-reveal>
            <div class="reg-approval-card__copy">
              <span class="section-kicker">${escapeHtml(localize({ fr: "Agrément", en: "Approval" }))}</span>
              <h2>${escapeHtml(localize({ fr: "Une intervention réalisée dans un cadre reconnu", en: "Interventions performed within a recognized framework" }))}</h2>
              <p>${escapeHtml(localize(content.regulatory.note))}</p>
            </div>
            ${buttonMarkup({
              href: content.company.approvalLink,
              label: approvalButtonLabel,
              variant: "secondary",
              target: "_blank"
            })}
          </div>
        </div>
      </section>

      ${contactPanelSection()}
    `;
  }

  function uniqueLocalizedOptions(items, getter) {
    const map = new Map();

    items.forEach((item) => {
      const value = getter(item);
      const key = stableFilterValue(value);
      if (!key) {
        return;
      }

      if (!map.has(key)) {
        map.set(key, value);
      }
    });

    return [...map.entries()].map(([key, value]) => ({
      key,
      label: localize(value)
    }));
  }

  function filteredWorksItems() {
    return content.works.filter((item) => {
      const intervention = stableFilterValue(item.interventionType);
      const equipment = stableFilterValue(item.equipmentType);
      const interventionMatch =
        state.worksFilters.intervention === "all" || state.worksFilters.intervention === intervention;
      const equipmentMatch =
        state.worksFilters.equipment === "all" || state.worksFilters.equipment === equipment;

      return interventionMatch && equipmentMatch;
    });
  }

  function worksGridMarkup(items) {
    if (!Array.isArray(items) || !items.length) {
      return `
        <div class="empty-state" data-reveal>
          <h2>${escapeHtml(tr("noResultsTitle"))}</h2>
          <p>${escapeHtml(tr("noResultsText"))}</p>
        </div>
      `;
    }

    return `<div class="case-grid case-grid--catalog works-catalog-grid">${items.map((item) => workCard(item)).join("")}</div>`;
  }

  function worksPage() {
    const leadItem = content.works[0];
    setMeta(pageTitles.works[lang()], tr("projectsLead"), {
      path: prettyPath("works"),
      image: leadItem?.images?.[0]?.src || editorial("works", siteSettings.defaultSocialImage),
      pageType: "CollectionPage",
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(content.ui[lang()].nav.works), path: prettyPath("works") }
      ],
      extraSchemas: [
        itemListSchema({
          name: localize(content.ui[lang()].nav.works),
          path: prettyPath("works"),
          items: content.works.map((item) => ({
            name: localize(item.title),
            path: `${prettyPath("works")}/${encodeURIComponent(item.slug)}`
          }))
        })
      ]
    });
    const interventionOptions = uniqueLocalizedOptions(content.works, (item) => item.interventionType);
    const equipmentOptions = uniqueLocalizedOptions(content.works, (item) => item.equipmentType);

    return `
      <section class="section section--light works-catalog-page">
        <div class="shell">
          <div class="works-catalog-page__header" data-reveal>
            <h1 class="works-catalog-page__title">${escapeHtml(localize({ fr: "Nos Réalisations", en: "Our Projects" }))}</h1>
            <span class="works-catalog-page__line" aria-hidden="true"></span>
          </div>
          <div class="filter-panel works-catalog-page__filters" data-reveal>
            <div class="filter-group">
              <span>${escapeHtml(tr("filterIntervention"))}</span>
              <div class="filter-options">
                <button class="filter-chip ${state.worksFilters.intervention === "all" ? "is-active" : ""}" type="button" data-filter-group="intervention" data-filter-value="all">${escapeHtml(tr("all"))}</button>
                ${interventionOptions
                  .map((option) => `<button class="filter-chip ${state.worksFilters.intervention === option.key ? "is-active" : ""}" type="button" data-filter-group="intervention" data-filter-value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</button>`)
                  .join("")}
              </div>
            </div>
            <div class="filter-group">
              <span>${escapeHtml(tr("filterEquipment"))}</span>
              <div class="filter-options">
                <button class="filter-chip ${state.worksFilters.equipment === "all" ? "is-active" : ""}" type="button" data-filter-group="equipment" data-filter-value="all">${escapeHtml(tr("all"))}</button>
                ${equipmentOptions
                  .map((option) => `<button class="filter-chip ${state.worksFilters.equipment === option.key ? "is-active" : ""}" type="button" data-filter-group="equipment" data-filter-value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</button>`)
                  .join("")}
              </div>
            </div>
          </div>
          <div id="works-grid">${worksGridMarkup(filteredWorksItems())}</div>
        </div>
      </section>

      ${contactPanelSection()}
    `;
  }

  function renderWorksGrid() {
    const root = document.getElementById("works-grid");
    if (!root) {
      return;
    }

    if (canReusePrerenderedCollection(root, "works")) {
      root.dataset.prerenderReuseDone = "true";
      return;
    }

    const filtered = filteredWorksItems();

    root.innerHTML = worksGridMarkup(filtered);
    applyResponsiveImages(root);
    initReveal();
  }

  function findWorkBySlug() {
    const slug = new URLSearchParams(window.location.search).get("slug") || slugFromPrettyPath("works");
    if (!slug) {
      return null;
    }

    const decoded = decodeURIComponent(slug);
    return content.works.find((item) => item.slug === decoded || item.slug === slug) || null;
  }

  function relatedWorks(current) {
    const sameType = content.works.filter(
      (item) =>
        item.slug !== current.slug &&
        (localize(item.interventionType, "fr") === localize(current.interventionType, "fr") ||
          localize(item.equipmentType, "fr") === localize(current.equipmentType, "fr"))
    );

    return (sameType.length ? sameType : content.works.filter((item) => item.slug !== current.slug)).slice(0, 3);
  }

  function workDetailPage() {
    const item = findWorkBySlug();

    if (!item) {
      setMeta(pageTitles.work[lang()], tr("noResultsTitle"), {
        path: prettyPath("works"),
        image: editorial("works", siteSettings.defaultSocialImage),
        breadcrumbs: [
          { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
          { name: localize(content.ui[lang()].nav.works), path: prettyPath("works") }
        ]
      });
      return `
        <section class="section section--dark">
          <div class="shell empty-state">
            <h1>${escapeHtml(tr("noResultsTitle"))}</h1>
            <p>${escapeHtml(tr("noResultsText"))}</p>
            ${buttonMarkup({ href: routes.works, label: tr("backToWorks"), variant: "primary" })}
          </div>
        </section>
      `;
    }

    setMeta(localize(item.title), localize(item.shortDescription), {
      path: `${prettyPath("works")}/${encodeURIComponent(item.slug)}`,
      image: item.images?.[0]?.src || editorial("works", siteSettings.defaultSocialImage),
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(content.ui[lang()].nav.works), path: prettyPath("works") },
        { name: localize(item.title), path: `${prettyPath("works")}/${encodeURIComponent(item.slug)}` }
      ]
    });

    if (!isLocalPreview()) {
      const expectedPath = `${prettyPath("works")}/${encodeURIComponent(item.slug)}`;
      if (window.location.pathname !== expectedPath || window.location.search) {
        window.history.replaceState({}, "", expectedPath);
      }
    }

    return `
      <section class="detail-hero">
        <div class="detail-hero__media">
          <img src="${asset(item.images?.[0]?.src || editorial("works", "assets/images/editorial/pipes-room.jpg"))}" alt="${escapeHtml(localize(item.images?.[0]?.alt || ""))}" loading="eager" decoding="async" />
        </div>
        <div class="shell detail-hero__content">
          <a class="detail-back" href="${routes.works}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H6"></path>
              <path d="M12 5l-7 7 7 7"></path>
            </svg>
            <span>${escapeHtml(tr("backToWorks"))}</span>
          </a>
          ${tinyBadge(localize(item.interventionType))}
          <h1>${escapeHtml(localize(item.title))}</h1>
          <p>${escapeHtml(localize(item.shortDescription))}</p>
          <div class="detail-meta">
            <article><span>${escapeHtml(tr("location"))}</span><strong>${escapeHtml(localize(item.location))}</strong></article>
            <article><span>${escapeHtml(tr("equipment"))}</span><strong>${escapeHtml(localize(item.equipmentType))}</strong></article>
            <article><span>${escapeHtml(tr("intervention"))}</span><strong>${escapeHtml(localize(item.interventionType))}</strong></article>
            <article><span>${escapeHtml(tr("date"))}</span><strong>${escapeHtml(formatDate(item.date))}</strong></article>
          </div>
        </div>
      </section>

      <section class="section section--light">
        <div class="shell detail-grid">
          <article class="detail-panel detail-panel--context" data-reveal>
            <span class="section-label">${escapeHtml(tr("context"))}</span>
            <h2 class="section-title">${escapeHtml(localize(content.company.name))}</h2>
            <p>${escapeHtml(localize(item.fullContext))}</p>
          </article>

          <article class="detail-panel" data-reveal>
            <span class="section-label">${escapeHtml(tr("workPerformed"))}</span>
            <ul class="detail-list" role="list">
              ${item.workPerformed.map((entry) => `<li>${escapeHtml(localize(entry))}</li>`).join("")}
            </ul>
          </article>

          <article class="detail-panel" data-reveal>
            <span class="section-label">${escapeHtml(tr("results"))}</span>
            <ul class="detail-list" role="list">
              ${item.results.map((entry) => `<li>${escapeHtml(localize(entry))}</li>`).join("")}
            </ul>
          </article>
        </div>
      </section>

      <section class="section section--dark">
        <div class="shell">
          ${sectionIntroMarkup({
            label: tr("gallery"),
            title: tr("gallery"),
            lead: localize(item.shortDescription)
          })}
          <div class="gallery-grid">
            ${(item.images || [])
              .map(
                (image) => `
                <figure class="gallery-grid__item" data-reveal>
                  <img src="${asset(image.src)}" alt="${escapeHtml(localize(image.alt))}" loading="lazy" decoding="async" />
                </figure>`
              )
              .join("")}
          </div>
        </div>
      </section>

      <section class="section section--light">
        <div class="shell">
          ${sectionIntroMarkup({
            label: tr("similarProjects"),
            title: tr("similarProjects"),
            lead: tr("needComparableText")
          })}
          <div class="case-grid case-grid--catalog">
            ${relatedWorks(item).map((entry) => workCard(entry)).join("")}
          </div>
        </div>
      </section>

      ${contactPanelSection()}
    `;
  }

  function newsListMarkup(items) {
    if (!Array.isArray(items) || !items.length) {
      return `
        <div class="empty-state" data-reveal>
          <h2>${escapeHtml(tr("noResultsTitle"))}</h2>
          <p>${escapeHtml(tr("noResultsText"))}</p>
        </div>
      `;
    }

    return `
      <div class="news-list">
        ${items.map((article, index) => newsListItem(article, index < 1 ? { loading: "eager", fetchpriority: "low" } : { loading: "lazy" })).join("")}
      </div>
    `;
  }

  function newsPage() {
    const leadItem = content.articles.find((article) => article.isFeatured) || content.articles[0];
    setMeta(pageTitles.news[lang()], tr("newsLead"), {
      path: prettyPath("news"),
      image: leadItem?.coverImage?.src || editorial("news", siteSettings.defaultSocialImage),
      pageType: "CollectionPage",
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(content.ui[lang()].nav.news), path: prettyPath("news") }
      ],
      extraSchemas: [
        itemListSchema({
          name: localize(content.ui[lang()].nav.news),
          path: prettyPath("news"),
          items: content.articles.map((item) => ({
            name: localize(item.title),
            path: `${prettyPath("news")}/${encodeURIComponent(item.slug)}`
          }))
        })
      ]
    });
    return `
      <section class="section section--light news-catalog-page">
        <div class="shell">
          <div class="news-catalog-page__header" data-reveal>
            <h1 class="news-catalog-page__title">${escapeHtml(localize({ fr: "Nos Actualités", en: "Latest News" }))}</h1>
            <span class="news-catalog-page__line" aria-hidden="true"></span>
          </div>
          <div id="news-grid">${newsListMarkup(content.articles.slice())}</div>
        </div>
      </section>

      ${contactPanelSection()}
    `;
  }

  function renderNewsGrid() {
    const root = document.getElementById("news-grid");
    if (!root) {
      return;
    }

    if (canReusePrerenderedCollection(root, "news")) {
      root.dataset.prerenderReuseDone = "true";
      return;
    }

    const filtered = content.articles.slice();

    root.innerHTML = newsListMarkup(filtered);
    applyResponsiveImages(root);
    initReveal();
  }

  function findArticleBySlug() {
    const slug = new URLSearchParams(window.location.search).get("slug") || slugFromPrettyPath("news");
    if (!slug) {
      return null;
    }

    const decoded = decodeURIComponent(slug);
    return content.articles.find((item) => item.slug === decoded || item.slug === slug) || null;
  }

  function relatedArticles(current) {
    const explicit = Array.isArray(current.relatedArticles)
      ? current.relatedArticles
          .map((slug) => content.articles.find((item) => item.slug === slug))
          .filter(Boolean)
      : [];

    if (explicit.length) {
      return explicit.slice(0, 3);
    }

    return content.articles.filter((item) => item.slug !== current.slug).slice(0, 3);
  }

  function renderRichContent(blocks) {
    return (blocks || [])
      .map((block) => {
        if (!block) {
          return "";
        }

        if (block.type === "paragraph") {
          return `<p>${escapeHtml(localize(block.text))}</p>`;
        }

        if (block.type === "heading") {
          const level = Number(block.level) >= 3 ? "h3" : "h2";
          return `<${level}>${escapeHtml(localize(block.text))}</${level}>`;
        }

        if (block.type === "list") {
          return `<ul role="list">${(block.items || [])
            .map((item) => `<li>${escapeHtml(localize(item))}</li>`)
            .join("")}</ul>`;
        }

        return "";
      })
      .join("");
  }

  function articleDetailPage() {
    const article = findArticleBySlug();

    if (!article) {
      setMeta(pageTitles.article[lang()], tr("noResultsTitle"), {
        path: prettyPath("news"),
        image: editorial("news", siteSettings.defaultSocialImage),
        breadcrumbs: [
          { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
          { name: localize(content.ui[lang()].nav.news), path: prettyPath("news") }
        ]
      });
      return `
        <section class="section section--dark">
          <div class="shell empty-state">
            <h1>${escapeHtml(tr("noResultsTitle"))}</h1>
            <p>${escapeHtml(tr("noResultsText"))}</p>
            ${buttonMarkup({ href: routes.news, label: tr("backToNews"), variant: "primary" })}
          </div>
        </section>
      `;
    }

    setMeta(localize(article.seoTitle || article.title), localize(article.seoDescription || article.excerpt), {
      path: `${prettyPath("news")}/${encodeURIComponent(article.slug)}`,
      image: article.coverImage?.src || editorial("news", siteSettings.defaultSocialImage),
      type: "article",
      publishedTime: article.date,
      author: localize(article.author),
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(content.ui[lang()].nav.news), path: prettyPath("news") },
        { name: localize(article.title), path: `${prettyPath("news")}/${encodeURIComponent(article.slug)}` }
      ]
    });

    if (!isLocalPreview()) {
      const expectedPath = `${prettyPath("news")}/${encodeURIComponent(article.slug)}`;
      if (window.location.pathname !== expectedPath || window.location.search) {
        window.history.replaceState({}, "", expectedPath);
      }
    }

    return `
      <section class="detail-hero detail-hero--article">
        <div class="detail-hero__media">
          <img src="${asset(article.coverImage?.src || editorial("news", "assets/images/editorial/lab-bench.jpg"))}" alt="${escapeHtml(localize(article.coverImage?.alt || ""))}" loading="eager" decoding="async" />
        </div>
        <div class="shell detail-hero__content">
          <a class="detail-back" href="${routes.news}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H6"></path>
              <path d="M12 5l-7 7 7 7"></path>
            </svg>
            <span>${escapeHtml(tr("backToNews"))}</span>
          </a>
          ${tinyBadge(localize(article.category))}
          <h1>${escapeHtml(localize(article.title))}</h1>
          <p>${escapeHtml(localize(article.excerpt))}</p>
          <div class="article-detail__meta">
            <span>${escapeHtml(formatDate(article.date))}</span>
            <span>${escapeHtml(String(article.readingTime))} min</span>
            <span>${escapeHtml(localize(article.author))}</span>
          </div>
        </div>
      </section>

      <section class="section section--light">
        <div class="shell article-body">
          <aside class="article-body__aside" data-reveal>
            <div class="aside-card">
              <span class="section-label">${escapeHtml(tr("keyTakeaways"))}</span>
              <ul role="list">
                ${(article.keyTakeaways || []).map((item) => `<li>${escapeHtml(localize(item))}</li>`).join("")}
              </ul>
            </div>
          </aside>
          <article class="article-body__content" data-reveal>
            ${renderRichContent(article.content)}
          </article>
        </div>
      </section>

      <section class="section section--dark">
        <div class="shell">
          ${sectionIntroMarkup({
            label: tr("relatedArticles"),
            title: tr("relatedArticles"),
            lead: tr("newsLead")
          })}
          <div class="editorial-layout editorial-layout--related">
            ${relatedArticles(article).map((item) => articleCard(item)).join("")}
          </div>
        </div>
      </section>

      ${contactPanelSection()}
    `;
  }

  function contactPage() {
    setMeta(pageTitles.contact[lang()], localize(content.ui[lang()].contact.lead), {
      path: prettyPath("contact"),
      image: editorial("contact", siteSettings.defaultSocialImage),
      pageType: "ContactPage",
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(content.ui[lang()].nav.contact), path: prettyPath("contact") }
      ]
    });
    const c = content.ui[lang()].contact;
    const extras = contactFormExtras();
    const equipmentOptions = [
      c.equipmentOption1,
      c.equipmentOption2,
      c.equipmentOption3,
      c.equipmentOption4,
      c.equipmentOption5,
      c.equipmentOption6
    ];
    const requestOptions = [
      c.requestOption1,
      c.requestOption2,
      c.requestOption3,
      c.requestOption4,
      c.requestOption5,
      c.requestOption6
    ];
    return `
      <section class="section section--dark contact-page-compact">
        <div class="shell contact-page-compact__inner">
          <div class="contact-page-compact__header" data-reveal>
            <div class="contact-page-compact__title-row">
              <h1 class="contact-page-compact__title">${escapeHtml(localize(c.title))}</h1>
              <span class="contact-page-compact__line" aria-hidden="true"></span>
            </div>
          </div>

          <div class="contact-page-compact__form" data-reveal>
            <section class="contact-form-shell">
              <form class="contact-form" id="contact-form" data-contact-form novalidate>
                <div class="visually-hidden" aria-hidden="true">
                  <label>
                    <span>Website</span>
                    <input name="website" type="text" tabindex="-1" autocomplete="off" />
                  </label>
                </div>

                <div class="contact-form__section" data-contact-section="1">
                  <div class="contact-form__section-head">
                    <span class="contact-form__section-step" data-contact-step-number="1">01</span>
                    <h3 class="contact-form__section-title">${escapeHtml(localize(c.section1Title))}</h3>
                  </div>

                  <div class="contact-form__grid contact-form__grid--triple">
                    <label class="contact-field" for="contact-name">
                      <span class="contact-field__label contact-field__label--required">${escapeHtml(localize(c.fieldName))}</span>
                      <input class="contact-field__input" id="contact-name" name="name" type="text" placeholder="${escapeHtml(localize(c.namePlaceholder))}" autocomplete="name" autocapitalize="words" enterkeyhint="next" required />
                    </label>
                    <label class="contact-field" for="contact-email">
                      <span class="contact-field__label contact-field__label--required">${escapeHtml(localize(c.fieldEmail))}</span>
                      <input class="contact-field__input" id="contact-email" name="email" type="email" placeholder="${escapeHtml(localize(c.emailPlaceholder))}" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" required />
                    </label>
                    <label class="contact-field" for="contact-phone">
                      <span class="contact-field__label">${escapeHtml(localize(c.fieldPhone))}</span>
                      <input class="contact-field__input" id="contact-phone" name="phone" type="tel" placeholder="${escapeHtml(localize(c.phonePlaceholder))}" autocomplete="tel" inputmode="tel" enterkeyhint="next" />
                    </label>
                  </div>
                </div>

                <div class="contact-form__section" data-contact-section="2">
                  <div class="contact-form__section-head">
                    <span class="contact-form__section-step" data-contact-step-number="2">02</span>
                    <h3 class="contact-form__section-title">${escapeHtml(localize(c.section2Title))}</h3>
                  </div>

                  <div class="contact-form__grid contact-form__grid--triple">
                    <label class="contact-field" for="contact-site">
                      <span class="contact-field__label">${escapeHtml(localize(c.fieldSite))}</span>
                      <input class="contact-field__input" id="contact-site" name="site" type="text" placeholder="${escapeHtml(localize(c.sitePlaceholder))}" autocomplete="organization" autocapitalize="words" enterkeyhint="next" />
                    </label>
                    <label class="contact-field" for="contact-equipment">
                      <span class="contact-field__label">${escapeHtml(localize(c.fieldEquipment))}</span>
                      <select class="contact-field__input contact-field__select" id="contact-equipment" name="equipment">
                        <option value="">${escapeHtml(localize(c.equipmentPlaceholder))}</option>
                        ${equipmentOptions
                          .map((option) => {
                            const label = localize(option);
                            return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
                          })
                          .join("")}
                      </select>
                    </label>
                    <label class="contact-field" for="contact-request-type">
                      <span class="contact-field__label contact-field__label--required">${escapeHtml(localize(c.fieldRequestType))}</span>
                      <select class="contact-field__input contact-field__select" id="contact-request-type" name="requestType" required>
                        <option value="">${escapeHtml(localize(c.requestPlaceholder))}</option>
                        ${requestOptions
                          .map((option) => {
                            const label = localize(option);
                            return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
                          })
                          .join("")}
                      </select>
                    </label>
                    <label class="contact-field" for="contact-equipment-count">
                      <span class="contact-field__label">${escapeHtml(extras.equipmentCountLabel)}</span>
                      <input class="contact-field__input" id="contact-equipment-count" name="equipmentCount" type="text" placeholder="${escapeHtml(extras.equipmentCountPlaceholder)}" />
                    </label>
                    <label class="contact-field" for="contact-deadline">
                      <span class="contact-field__label">${escapeHtml(extras.deadlineLabel)}</span>
                      <input class="contact-field__input" id="contact-deadline" name="deadline" type="text" placeholder="${escapeHtml(extras.deadlinePlaceholder)}" />
                    </label>
                  </div>
                </div>

                <div class="contact-form__section" data-contact-section="3">
                  <div class="contact-form__section-head">
                    <span class="contact-form__section-step" data-contact-step-number="3">03</span>
                    <h3 class="contact-form__section-title">${escapeHtml(localize(c.section3Title))}</h3>
                  </div>

                  <div class="contact-form__grid">
                    <label class="contact-field contact-field--full" for="contact-message">
                      <span class="contact-field__label contact-field__label--required">${escapeHtml(localize(c.fieldMessage))}</span>
                      <textarea class="contact-field__input contact-field__textarea" id="contact-message" name="message" maxlength="2000" placeholder="${escapeHtml(localize(c.messagePlaceholder))}" autocapitalize="sentences" enterkeyhint="send" required></textarea>
                      <span class="contact-field__count" data-contact-char-count aria-live="polite">0 / 2 000</span>
                    </label>
                  </div>
                </div>

                <div class="contact-form__footer">
                  <div class="contact-form__consent-box">
                    <div class="contact-form__section-head">
                      <span class="contact-form__section-step" data-contact-step-number="4">04</span>
                      <h3 class="contact-form__section-title">${escapeHtml(localize(c.section4Title))}</h3>
                    </div>

                    <div class="contact-form__legal">
                      <label class="contact-form__consent" for="contact-consent">
                        <input id="contact-consent" name="consent" type="checkbox" required />
                        <span class="contact-form__checkmark" aria-hidden="true">
                          <svg viewBox="0 0 24 24" focusable="false">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </span>
                        <span class="contact-form__consent-text">${escapeHtml(localize(c.formConsent))}</span>
                      </label>

                      <div class="contact-form__meta-group">
                        <p class="contact-form__helper">${escapeHtml(localize(c.formHelper))}</p>
                        <a class="contact-form__policy" href="${routes.legalPrivacy}">${escapeHtml(localize(c.formPolicy))}</a>
                      </div>
                    </div>
                  </div>

                  <div class="contact-form__actions">
                    <button class="contact-form__submit" type="submit" data-submit-button>
                      <span>${escapeHtml(localize(c.formSubmit))}</span>
                      <span class="contact-form__submit-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                          <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                      </span>
                    </button>
                    <p class="contact-form__meta" role="status" aria-live="polite" data-state="neutral"></p>
                  </div>
                </div>
              </form>
            </section>
          </div>
        </div>
      </section>
    `;
  }

  function legalPage(pageKey) {
    const legalData = content.legalPages[pageKey];
    if (!legalData) {
      return "";
    }

    const legalPathMap = {
      "mentions-legales": prettyPath("legalMentions"),
      confidentialite: prettyPath("legalPrivacy"),
      cookies: prettyPath("legalCookies")
    };

    setMeta(localize(legalData.title), localize(legalData.intro), {
      path: legalPathMap[pageKey] || prettyPath("legalMentions"),
      image: editorial("legal", siteSettings.defaultSocialImage),
      breadcrumbs: [
        { name: localize(content.ui[lang()].nav.home), path: prettyPath("home") },
        { name: localize(legalData.title), path: legalPathMap[pageKey] || prettyPath("legalMentions") }
      ]
    });

    const crossLinks = [
      { href: routes.legalMentions, key: "mentions-legales", label: content.ui[lang()].legal.anchor1 },
      { href: routes.legalPrivacy, key: "confidentialite", label: content.ui[lang()].legal.anchor2 },
      { href: routes.legalCookies, key: "cookies", label: content.ui[lang()].legal.anchor3 }
    ];

    return `
      ${pageHero({
        eyebrow: localize(content.ui[lang()].legal.heroEyebrow),
        title: localize(legalData.title),
        lead: localize(legalData.intro),
        image: editorial("legal", "assets/images/editorial/glassware.jpg"),
        chips: crossLinks.map((item) => item.label)
      })}

      <section class="section section--light">
        <div class="shell legal-nav" data-reveal>
          ${crossLinks
            .map(
              (item) => `
              <a class="legal-nav__link ${pageKey === item.key ? "is-active" : ""}" href="${item.href}">
                ${escapeHtml(item.label)}
              </a>`
            )
            .join("")}
        </div>
      </section>

      <section class="section section--light section--paper">
        <div class="shell paper-card">
          ${legalData.sections
            .map(
              (section) => `
              <article class="legal-section" data-reveal>
                <h2>${escapeHtml(localize(section.title))}</h2>
                ${
                  section.rows
                    ? `<div class="legal-table">
                        ${section.rows
                          .map(
                            (row) => `
                            <div class="legal-table__row">
                              <span>${escapeHtml(localize(row.label))}</span>
                              <strong>${escapeHtml(localize(row.value))}</strong>
                            </div>`
                          )
                          .join("")}
                      </div>`
                    : ""
                }
                ${
                  section.paragraphs
                    ? section.paragraphs.map((paragraph) => `<p>${escapeHtml(localize(paragraph))}</p>`).join("")
                    : ""
                }
                ${
                  section.list
                    ? `<ul role="list">${section.list.map((item) => `<li>${escapeHtml(localize(item))}</li>`).join("")}</ul>`
                    : ""
                }
                ${section.note ? `<p class="legal-note">${escapeHtml(localize(section.note))}</p>` : ""}
              </article>`
            )
            .join("")}
        </div>
      </section>

      ${contactPanelSection()}
    `;
  }
function heroBlock() {
  const heroTitle = localize({
    fr: "Contr\u00f4le des sorbonnes de laboratoire",
    en: "Inspection of laboratory fume hoods"
  });
  const heroSubtitle = localize({
    fr: "Essais de r\u00e9ception, de qualification et de routine",
    en: "Acceptance, qualification and routine tests"
  });

  return `
    <section class="hero hero--home">
      <div class="hero__media">
        <img src="${asset(editorial("hero", content.hero.visuals?.coverImage || ""))}" alt="${escapeHtml(editorialAlt("hero"))}" loading="eager" decoding="async" fetchpriority="high" />
      </div>
      <div class="hero__veil"></div>
      <div class="shell hero__grid">
        <div class="hero__copy" data-reveal>
          <h1 class="hero__title hero__title--landing">${escapeHtml(heroTitle)}</h1>
          <p class="hero__subtitle">${escapeHtml(heroSubtitle)}</p>
        </div>
      </div>
    </section>
  `;
}

function homeDefinitionSection() {
  const sectionTitle = localize({
    fr: "Qu\'est-ce qu\'une sorbonne de laboratoire ?",
    en: "What is a laboratory fume hood?"
  });
  const paragraphs = [
    {
      fr: "La sorbonne de laboratoire est une enceinte ventil\u00e9e en d\u00e9pression con\u00e7ue pour capter l'air du local et ma\u00eetriser l'exposition des op\u00e9rateurs aux substances chimiques dangereuses.",
      en: "A laboratory fume hood is a negatively pressurized ventilated enclosure designed to capture room air and control operator exposure to hazardous chemical substances."
    },
    {
      fr: "\u00c9quipement de protection collective, elle extrait les vapeurs du volume de travail puis les rejette vers l'ext\u00e9rieur ou les traite par filtration, selon la configuration de l'installation.",
      en: "As collective protective equipment, it extracts vapors from the working volume and then discharges them outdoors or treats them by filtration depending on the installation configuration."
    },
    {
      fr: "Son contr\u00f4le, son entretien et son exploitation doivent r\u00e9pondre \u00e0 des exigences pr\u00e9cises, notamment celles d\u00e9finies par la norme europ\u00e9enne NF EN 14175 et son extension fran\u00e7aise NF X 15-206.",
      en: "Its inspection, maintenance and operation must meet precise requirements, including those defined by European standard EN 14175 and its French extension NF X 15-206."
    }
  ];
  const mentions = [
    {
      fr: "Protection des op\u00e9rateurs",
      en: "Operator protection"
    },
    {
      fr: "Conformit\u00e9 r\u00e9glementaire",
      en: "Regulatory compliance"
    }
  ];

  return `
    <section class="section section--light home-editorial">
      <div class="shell home-editorial__grid">
        <aside class="home-editorial__aside" data-reveal></aside>
        <div class="home-editorial__content" data-reveal>
          <h2 class="home-editorial__title">${escapeHtml(sectionTitle)}</h2>
          <div class="home-editorial__prose">
            ${paragraphs.map((item) => `<p>${escapeHtml(localize(item))}</p>`).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function homePage() {
  setMeta(pageTitles.home[lang()], localize({
    fr: "Essais de r\u00e9ception, de qualification et de routine pour sorbonnes de laboratoire.",
    en: "Acceptance, qualification and routine tests for laboratory fume hoods."
  }), {
    path: prettyPath("home"),
    image: editorial("hero", siteSettings.defaultSocialImage),
    breadcrumbs: [{ name: localize(content.ui[lang()].nav.home), path: prettyPath("home") }]
  });

  return `
    ${heroBlock()}
    ${homeDefinitionSection()}
    ${homeServicesSection()}
    ${whySection()}
    ${processSection()}
    ${regulationsPreviewSection()}
    ${homeWorksSection()}
    ${homeNewsSection()}
    ${homeContactBandSection()}
  `;
}

  function renderMain() {
    const root = document.getElementById("main");
    if (!root) {
      return;
    }

    let markup = "";
    switch (page()) {
      case "home":
        markup = homePage();
        break;
      case "services":
        markup = servicesPage();
        break;
      case "service-detail":
        markup = serviceDetailPage();
        break;
      case "regulations":
        markup = regulationsPage();
        break;
      case "works":
        markup = worksPage();
        break;
      case "realisation":
        markup = workDetailPage();
        break;
      case "news":
        markup = newsPage();
        break;
      case "article":
        markup = articleDetailPage();
        break;
      case "contact":
        markup = contactPage();
        break;
      case "mentions-legales":
        markup = legalPage("mentions-legales");
        break;
      case "confidentialite":
        markup = legalPage("confidentialite");
        break;
      case "cookies":
        markup = legalPage("cookies");
        break;
      default:
        markup = homePage();
    }

    root.innerHTML = markup;
  }

  function bindLangSwitch() {
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextLang = button.dataset.lang === "en" ? "en" : "fr";
        if (nextLang === state.lang) {
          return;
        }

        persistTransientPageState();
        state.lang = nextLang;
        localStorage.setItem("controlAirLang", nextLang);
        render();
      });
    });
  }

  function captureContactFormDraft(form) {
    if (!form) {
      return null;
    }

    const equipmentField = form.querySelector("#contact-equipment");
    const requestTypeField = form.querySelector("#contact-request-type");
    const consentField = form.querySelector("#contact-consent");

    return {
      name: String(form.querySelector("#contact-name")?.value || ""),
      email: String(form.querySelector("#contact-email")?.value || ""),
      phone: String(form.querySelector("#contact-phone")?.value || ""),
      site: String(form.querySelector("#contact-site")?.value || ""),
      equipmentIndex: equipmentField ? equipmentField.selectedIndex : 0,
      equipmentValue: String(equipmentField?.value || ""),
      requestTypeIndex: requestTypeField ? requestTypeField.selectedIndex : 0,
      requestTypeValue: String(requestTypeField?.value || ""),
      equipmentCount: String(form.querySelector("#contact-equipment-count")?.value || ""),
      deadline: String(form.querySelector("#contact-deadline")?.value || ""),
      message: String(form.querySelector("#contact-message")?.value || ""),
      consent: Boolean(consentField?.checked),
      website: String(form.querySelector('input[name="website"]')?.value || "")
    };
  }

  function restoreContactFormDraft(form) {
    if (!form || !state.contactDraft) {
      return;
    }

    const draft = state.contactDraft;
    const setValue = (selector, value) => {
      const field = form.querySelector(selector);
      if (field && typeof value === "string") {
        field.value = value;
      }
    };
    const setSelectValue = (selector, index, fallbackValue) => {
      const field = form.querySelector(selector);
      if (!(field instanceof HTMLSelectElement)) {
        return;
      }

      const nextIndex = Number.isInteger(index) ? index : 0;
      if (nextIndex >= 0 && nextIndex < field.options.length) {
        field.selectedIndex = nextIndex;
        return;
      }

      field.value = typeof fallbackValue === "string" ? fallbackValue : "";
    };

    setValue("#contact-name", draft.name);
    setValue("#contact-email", draft.email);
    setValue("#contact-phone", draft.phone);
    setValue("#contact-site", draft.site);
    setSelectValue("#contact-equipment", draft.equipmentIndex, draft.equipmentValue);
    setSelectValue("#contact-request-type", draft.requestTypeIndex, draft.requestTypeValue);
    setValue("#contact-equipment-count", draft.equipmentCount);
    setValue("#contact-deadline", draft.deadline);
    setValue("#contact-message", draft.message);
    setValue('input[name="website"]', draft.website);

    const consentField = form.querySelector("#contact-consent");
    if (consentField instanceof HTMLInputElement) {
      consentField.checked = Boolean(draft.consent);
    }
  }

  function persistTransientPageState() {
    if (page() === "contact") {
      state.contactDraft = captureContactFormDraft(document.getElementById("contact-form"));
    }
  }

  function bindMobileMenu() {
    const menu = document.getElementById("mobile-menu");
    const openButton = document.querySelector(".menu-toggle");
    const closeButton = document.querySelector(".mobile-menu__close");

    if (!menu || !openButton || !closeButton) {
      return;
    }

    const open = () => {
      menu.hidden = false;
      menu.classList.add("is-open");
      openButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
      window.__controlAirLenis?.stop?.();
    };

    const close = () => {
      menu.hidden = true;
      menu.classList.remove("is-open");
      openButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
      window.__controlAirLenis?.start?.();
    };

    openButton.addEventListener("click", open);
    closeButton.addEventListener("click", close);
    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  }

  function bindCookieBanner() {
    document.querySelectorAll("[data-cookie-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        localStorage.setItem("controlAirCookieChoice", button.dataset.cookieChoice || "accepted");
        renderCookieBanner();
      });
    });
  }


let headerStateRaf = 0;
let cachedHeaderElement = null;

function syncPerformanceModeAfterChange() {
  if (!performanceState.renderReady) {
    return;
  }

  window.removeEventListener("scroll", scheduleHeaderStateUpdate);
  syncSmoothScrollMode();
  if (!window.__controlAirLenis) {
    window.addEventListener("scroll", scheduleHeaderStateUpdate, { passive: true });
  }
  scheduleHeaderStateUpdate();
}

function updateHeaderState() {
  const header = cachedHeaderElement && document.body.contains(cachedHeaderElement)
    ? cachedHeaderElement
    : document.querySelector(".site-header");
  if (!header) {
    return;
  }

  cachedHeaderElement = header;

  const scrollY = window.scrollY || 0;
  const progressStart = 6;
  const progressEnd = 92;
  const progressRange = progressEnd - progressStart || 1;
  const nextProgress = Math.max(0, Math.min(1, (scrollY - progressStart) / progressRange));
  const nextProgressValue = nextProgress.toFixed(3);

  if (performanceState.headerProgress === nextProgressValue) {
    return;
  }

  performanceState.headerProgress = nextProgressValue;
  header.style.setProperty("--header-scroll-progress", nextProgressValue);
}

function scheduleHeaderStateUpdate() {
  if (headerStateRaf) {
    return;
  }

  headerStateRaf = window.requestAnimationFrame(() => {
    headerStateRaf = 0;
    updateHeaderState();
    updateProcessStoryState();
  });
}

let destroySmoothScroll = null;
function createSmoothScroll() {
  if (!canUseSmoothScrollOnCurrentDevice()) {
    document.documentElement.classList.remove("has-lenis");
    delete window.__controlAirLenis;
    return null;
  }

  if (typeof window.Lenis !== "function") {
    document.documentElement.classList.remove("has-lenis");
    delete window.__controlAirLenis;
    return null;
  }

  const lenis = new window.Lenis({
    autoRaf: true,
    anchors: true,
    lerp: 0.12,
    wheelMultiplier: 0.95
  });

  const syncScrollUi = () => {
    scheduleHeaderStateUpdate();
  };

  lenis.on("scroll", syncScrollUi);
  window.__controlAirLenis = lenis;
  document.documentElement.classList.add("has-lenis");

  if (document.body.classList.contains("menu-open")) {
    lenis.stop();
  }

  scheduleHeaderStateUpdate();

  return () => {
    if (typeof lenis.off === "function") {
      lenis.off("scroll", syncScrollUi);
    }

    lenis.destroy();
    delete window.__controlAirLenis;
    document.documentElement.classList.remove("has-lenis");
  };
}

async function syncSmoothScrollMode() {
  if (destroySmoothScroll) {
    destroySmoothScroll();
    destroySmoothScroll = null;
  }

  if (!canUseSmoothScrollOnCurrentDevice()) {
    document.documentElement.classList.remove("has-lenis");
    delete window.__controlAirLenis;
    return;
  }

  if (typeof window.Lenis !== "function") {
    const loaded = await ensureLenisScript();
    if (!loaded || !canUseSmoothScrollOnCurrentDevice()) {
      document.documentElement.classList.remove("has-lenis");
      delete window.__controlAirLenis;
      return;
    }
  }

  destroySmoothScroll = createSmoothScroll();
}

let revealObserver;
  function initReveal() {
    if (revealObserver) {
      revealObserver.disconnect();
      revealObserver = null;
    }

    // Keep section transitions visually stable during scroll.
    document.querySelectorAll("[data-reveal]").forEach((element) => element.classList.add("is-visible"));
  }

  function resetProcessStoryObservers() {
    if (performanceState.processStoryVisibilityObserver) {
      performanceState.processStoryVisibilityObserver.disconnect();
      performanceState.processStoryVisibilityObserver = null;
    }

    if (performanceState.processStoryResizeObserver) {
      performanceState.processStoryResizeObserver.disconnect();
      performanceState.processStoryResizeObserver = null;
    }

    performanceState.processStorySections = [];
    performanceState.processStoryEntries = new WeakMap();
  }

  function getProcessStoryEntry(section) {
    if (!section) {
      return null;
    }

    let entry = performanceState.processStoryEntries.get(section);
    if (entry) {
      return entry;
    }

    const rail = section.querySelector(".process-story__rail");
    const track = section.querySelector("[data-process-track]");
    const fillClip = section.querySelector("[data-process-fill-clip]");
    const fill = section.querySelector("[data-process-fill]");
    const cards = Array.from(section.querySelectorAll("[data-process-card]"));
    const dots = cards.map((card) => card.querySelector("[data-process-dot]"));

    entry = {
      section,
      rail,
      track,
      fillClip,
      fill,
      cards,
      dots,
      inView: !("IntersectionObserver" in window),
      needsMeasure: true,
      metrics: null,
      currentIndex: -2,
      lastScale: ""
    };

    performanceState.processStoryEntries.set(section, entry);
    return entry;
  }

  function markProcessStoryDirty(section) {
    const entry = getProcessStoryEntry(section);
    if (!entry) {
      return;
    }

    entry.needsMeasure = true;
  }

  function measureProcessStoryEntry(entry) {
    if (!entry?.rail || !entry.track || !entry.fillClip || !entry.fill || !entry.cards.length || entry.dots.some((dot) => !dot)) {
      return false;
    }

    const scrollY = window.scrollY || 0;
    const railRect = entry.rail.getBoundingClientRect();
    const railDocTop = railRect.top + scrollY;
    const anchors = entry.dots.map((dot) => {
      const dotRect = dot.getBoundingClientRect();
      const radius = dotRect.height / 2;
      const centerDoc = dotRect.top + scrollY + radius;
      return {
        centerDoc,
        centerInRail: centerDoc - railDocTop,
        leftInRail: (dotRect.left + radius) - railRect.left
      };
    });

    const firstAnchor = anchors[0]?.centerInRail ?? 0;
    const lastAnchor = anchors[anchors.length - 1]?.centerInRail ?? firstAnchor;
    const lineLeft = anchors[0]?.leftInRail ?? 0;
    const lineHeight = Math.max(0, lastAnchor - firstAnchor);
    const leftPx = `${Math.round(lineLeft)}px`;
    const topPx = `${Math.round(firstAnchor)}px`;
    const heightPx = `${Math.round(lineHeight)}px`;

    entry.track.style.left = leftPx;
    entry.track.style.top = topPx;
    entry.track.style.height = heightPx;

    entry.fillClip.style.left = leftPx;
    entry.fillClip.style.top = topPx;
    entry.fillClip.style.height = heightPx;
    entry.fillClip.style.width = "2px";

    entry.metrics = {
      anchorDocPositions: anchors.map((anchor) => anchor.centerDoc),
      startDoc: railDocTop + firstAnchor,
      lineHeight
    };
    entry.needsMeasure = false;

    return true;
  }

  function updateProcessStoryState(forceMeasure = false) {
    performanceState.processStorySections.forEach((section) => {
      const entry = getProcessStoryEntry(section);
      if (!entry || (!entry.inView && !forceMeasure)) {
        return;
      }

      if ((forceMeasure || entry.needsMeasure) && !measureProcessStoryEntry(entry)) {
        return;
      }

      if (!entry.metrics) {
        return;
      }

      const triggerDoc = (window.scrollY || 0) + ((window.innerHeight || 1) * 0.55);
      const progress = window.innerWidth <= 980
        ? 0
        : Math.max(0, Math.min(1, (triggerDoc - entry.metrics.startDoc) / Math.max(entry.metrics.lineHeight, 1)));
      const scaleValue = progress.toFixed(3);

      if (entry.lastScale !== scaleValue) {
        entry.fill.style.transform = `scaleY(${scaleValue})`;
        entry.lastScale = scaleValue;
      }

      const currentIndex = entry.metrics.anchorDocPositions.reduce((activeIndex, position, index) => (
        position <= triggerDoc ? index : activeIndex
      ), -1);

      if (currentIndex === entry.currentIndex) {
        return;
      }

      entry.currentIndex = currentIndex;
      entry.dots.forEach((dot, index) => {
        dot.classList.toggle("is-complete", currentIndex > index);
        dot.classList.toggle("is-current", currentIndex === index);
      });
    });
  }

  function bindProcessStory() {
    resetProcessStoryObservers();

    const sections = Array.from(document.querySelectorAll("[data-process-story]"));
    if (!sections.length) {
      return;
    }

    if (currentViewportWidth() <= 980 || performanceState.mode === "light") {
      sections.forEach((section) => {
        const dots = Array.from(section.querySelectorAll("[data-process-dot]"));
        dots.forEach((dot, index) => {
          dot.classList.toggle("is-complete", false);
          dot.classList.toggle("is-current", index === 0);
        });
        const fill = section.querySelector("[data-process-fill]");
        if (fill) {
          fill.style.transform = "scaleY(0)";
        }
      });
      return;
    }

    performanceState.processStorySections = sections;

    if ("IntersectionObserver" in window) {
      performanceState.processStoryVisibilityObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((item) => {
            const entry = getProcessStoryEntry(item.target);
            if (!entry) {
              return;
            }

            entry.inView = item.isIntersecting;
            if (item.isIntersecting) {
              entry.needsMeasure = true;
            }
          });

          scheduleHeaderStateUpdate();
        },
        {
          rootMargin: "20% 0px 20% 0px",
          threshold: 0
        }
      );
    }

    if ("ResizeObserver" in window) {
      performanceState.processStoryResizeObserver = new ResizeObserver((entries) => {
        const dirtySections = new Set();
        entries.forEach(({ target }) => {
          const section = target.closest("[data-process-story]");
          if (section) {
            dirtySections.add(section);
          }
        });

        dirtySections.forEach((section) => markProcessStoryDirty(section));
        if (dirtySections.size) {
          scheduleHeaderStateUpdate();
        }
      });
    }

    sections.forEach((section) => {
      const entry = getProcessStoryEntry(section);
      if (!entry) {
        return;
      }

      if (performanceState.processStoryVisibilityObserver) {
        performanceState.processStoryVisibilityObserver.observe(section);
      } else {
        entry.inView = true;
      }

      if (performanceState.processStoryResizeObserver) {
        if (entry.rail) {
          performanceState.processStoryResizeObserver.observe(entry.rail);
        }
        entry.cards.forEach((card) => performanceState.processStoryResizeObserver.observe(card));
      }
    });

    updateProcessStoryState(true);
  }

  function bindMarqueePerformance() {
    if (performanceState.marqueeObserver) {
      performanceState.marqueeObserver.disconnect();
      performanceState.marqueeObserver = null;
    }

    const bands = Array.from(document.querySelectorAll(".marquee-band"));
    if (!bands.length) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      bands.forEach((band) => band.classList.add("is-active"));
      return;
    }

    performanceState.marqueeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-active", entry.isIntersecting);
        });
      },
      {
        rootMargin: "160px 0px 160px 0px",
        threshold: 0
      }
    );

    bands.forEach((band) => {
      band.classList.add("is-active");
      performanceState.marqueeObserver.observe(band);
    });
  }

  function bindMediaPerformance() {
    if (performanceState.mediaObserver) {
      performanceState.mediaObserver.disconnect();
      performanceState.mediaObserver = null;
    }

    const controlledVideos = Array.from(document.querySelectorAll("video[controls]"));
    if (!controlledVideos.length || !("IntersectionObserver" in window)) {
      return;
    }

    performanceState.mediaObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.target instanceof HTMLVideoElement && !entry.target.paused) {
            entry.target.pause();
          }
        });
      },
      {
        threshold: 0.05
      }
    );

    controlledVideos.forEach((video) => performanceState.mediaObserver.observe(video));
  }

  function bindWorksFilters() {
    document.querySelectorAll("[data-filter-group]").forEach((button) => {
      button.addEventListener("click", () => {
        const group = button.dataset.filterGroup;
        const value = button.dataset.filterValue || "all";

        if (!group) {
          return;
        }

        state.worksFilters[group] = value;

        document.querySelectorAll(`[data-filter-group="${group}"]`).forEach((chip) => {
          chip.classList.toggle("is-active", chip === button);
        });

        renderWorksGrid();
      });
    });
  }

  function bindNewsFilters() {
    document.querySelectorAll("[data-news-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.newsFilter = button.dataset.newsFilter || "all";

        document.querySelectorAll("[data-news-filter]").forEach((chip) => {
          chip.classList.toggle("is-active", chip === button);
        });

        renderNewsGrid();
      });
    });
  }

  function contactFormExtras() {
    return {
      formLead: localize({
        fr: "Renseignez les informations essentielles pour permettre une lecture claire et structur\u00e9e de votre demande.",
        en: "Fill in the key information so your request can be reviewed clearly and efficiently."
      }),
      equipmentCountLabel: localize({
        fr: "Nombre d\u0027\u00e9quipements",
        en: "Number of equipment items"
      }),
      equipmentCountPlaceholder: localize({
        fr: "Ex. 4 sorbonnes",
        en: "E.g. 4 fume hoods"
      }),
      deadlineLabel: localize({
        fr: "\u00c9ch\u00e9ance souhait\u00e9e",
        en: "Requested timeframe"
      }),
      deadlinePlaceholder: localize({
        fr: "Ex. intervention sous 2 semaines",
        en: "E.g. intervention within 2 weeks"
      }),
      validationError: localize({
        fr: "Merci de compl\u00e9ter les champs obligatoires avant l\u0027envoi.",
        en: "Please complete the required fields before sending."
      })
    };
  }

  function buildContactMailto(details) {
    const currentLang = lang();
    const extras = contactFormExtras();
    const subject = currentLang === "fr"
      ? `Demande via le site  -  ${details.requestType || "Contact"}  -  ${details.name || "Sans nom"}`
      : `Website request  -  ${details.requestType || "Contact"}  -  ${details.name || "No name"}`;

    const lines = [
      `${localize(content.ui[currentLang].contact.fieldName)}: ${details.name}`,
      `${localize(content.ui[currentLang].contact.fieldEmail)}: ${details.email}`,
      details.phone ? `${localize(content.ui[currentLang].contact.fieldPhone)}: ${details.phone}` : "",
      details.site ? `${localize(content.ui[currentLang].contact.fieldSite)}: ${details.site}` : "",
      details.equipment ? `${localize(content.ui[currentLang].contact.fieldEquipment)}: ${details.equipment}` : "",
      details.equipmentCount ? `${extras.equipmentCountLabel}: ${details.equipmentCount}` : "",
      details.deadline ? `${extras.deadlineLabel}: ${details.deadline}` : "",
      `${localize(content.ui[currentLang].contact.fieldRequestType)}: ${details.requestType}`,
      "",
      `${localize(content.ui[currentLang].contact.fieldMessage)}:`,
      details.message
    ].filter(Boolean);

    return `mailto:${encodeURIComponent(content.company.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n").trim())}`;
  }

  function bindContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) {
      return;
    }

    const submitButton = form.querySelector("[data-submit-button]");
    const statusNode = form.querySelector(".contact-form__meta");
    const extras = contactFormExtras();
    const progressSteps = Array.from(document.querySelectorAll("[data-contact-progress-step]"));
    const stepBadges = Array.from(form.querySelectorAll("[data-contact-step-number]"));
    const selects = Array.from(form.querySelectorAll(".contact-field__select"));
    const messageField = form.querySelector("#contact-message");
    const charCount = form.querySelector("[data-contact-char-count]");
    const consentField = form.querySelector("#contact-consent");
    const requiredFields = Array.from(form.querySelectorAll("[required]"));

    const setStatus = (message, state = "neutral") => {
      if (!statusNode) {
        return;
      }

      statusNode.textContent = message;
      statusNode.dataset.state = state;
    };

    const setPending = (isPending) => {
      if (!submitButton) {
        return;
      }

      submitButton.disabled = isPending;
      submitButton.setAttribute("aria-busy", isPending ? "true" : "false");
    };

    const setFieldValidity = (field, isValid) => {
      if (!field) {
        return true;
      }

      if (field.type === "checkbox") {
        const consentLabel = field.closest(".contact-form__consent");
        if (consentLabel) {
          consentLabel.classList.toggle("is-invalid", !isValid);
        }
        return isValid;
      }

      field.classList.toggle("is-invalid", !isValid);
      return isValid;
    };

    const validateField = (field) => {
      if (!field || typeof field.checkValidity !== "function") {
        return true;
      }

      if (field.type === "checkbox") {
        return setFieldValidity(field, field.checked);
      }

      const value = typeof field.value === "string" ? field.value.trim() : field.value;
      const isValid = field.hasAttribute("required")
        ? Boolean(value) && field.checkValidity()
        : field.checkValidity();
      return setFieldValidity(field, isValid);
    };

    const validateForm = () => requiredFields.map((field) => validateField(field)).every(Boolean);

    const clearValidationState = () => {
      requiredFields.forEach((field) => setFieldValidity(field, true));
    };

    const focusFirstInvalid = () => {
      const invalidField = requiredFields.find((field) => !validateField(field));
      invalidField?.focus();
    };

    const updateSelects = () => {
      selects.forEach((select) => {
        select.classList.toggle("has-value", Boolean(select.value));
      });
    };

    const updateMessageCount = () => {
      if (!messageField || !charCount) {
        return;
      }

      const locale = lang() === "fr" ? "fr-FR" : "en-US";
      const length = messageField.value.length;
      const maxLength = Number(messageField.getAttribute("maxlength") || "2000");
      charCount.textContent = `${length.toLocaleString(locale)} / ${maxLength.toLocaleString(locale)}`;
      charCount.classList.toggle("is-near-limit", length >= maxLength * 0.75 && length < maxLength);
      charCount.classList.toggle("is-at-limit", length >= maxLength);
    };

    const updateProgress = () => {
      const checks = [
        () => {
          const nameField = form.querySelector("#contact-name");
          const emailField = form.querySelector("#contact-email");
          return Boolean(
            nameField &&
            nameField.value.trim() &&
            emailField &&
            emailField.value.trim() &&
            emailField.checkValidity()
          );
        },
        () => {
          const requestTypeField = form.querySelector("#contact-request-type");
          return Boolean(requestTypeField && requestTypeField.value);
        },
        () => Boolean(messageField && messageField.value.trim()),
        () => Boolean(consentField && consentField.checked)
      ];

      checks.forEach((check, index) => {
        const isActive = check();
        if (progressSteps[index]) {
          progressSteps[index].classList.toggle("is-active", isActive);
        }
        if (stepBadges[index]) {
          stepBadges[index].classList.toggle("is-complete", isActive);
        }
      });
    };

    const syncFormState = () => {
      updateSelects();
      updateMessageCount();
      updateProgress();
    };

    restoreContactFormDraft(form);

    form.addEventListener("input", (event) => {
      validateField(event.target);
      syncFormState();
      state.contactDraft = captureContactFormDraft(form);
    });

    form.addEventListener("change", (event) => {
      validateField(event.target);
      syncFormState();
      state.contactDraft = captureContactFormDraft(form);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      syncFormState();

      if (!validateForm()) {
        setStatus(extras.validationError, "error");
        focusFirstInvalid();
        return;
      }

      const formData = new FormData(form);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        site: String(formData.get("site") || "").trim(),
        equipment: String(formData.get("equipment") || "").trim(),
        equipmentCount: String(formData.get("equipmentCount") || "").trim(),
        deadline: String(formData.get("deadline") || "").trim(),
        requestType: String(formData.get("requestType") || "").trim(),
        message: String(formData.get("message") || "").trim(),
        consent: String(formData.get("consent") || "").trim() === "on",
        website: String(formData.get("website") || "").trim(),
        lang: lang()
      };

      const fallbackHref = buildContactMailto(payload);

      setPending(true);
      setStatus(tr("contactSending"), "pending");

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload)
        });

        let data = {};
        try {
          data = await response.json();
        } catch (error) {
          data = {};
        }

        if (response.ok) {
          form.reset();
          state.contactDraft = null;
          clearValidationState();
          syncFormState();
          setStatus(data.message || tr("contactSuccess"), "success");
          return;
        }

        if ([404, 405, 500, 502, 503].includes(response.status)) {
          setStatus(tr("contactFallback"), "warning");
          window.location.href = fallbackHref;
          return;
        }

        setStatus(data.error || tr("contactError"), "error");
      } catch (error) {
        setStatus(tr("contactFallback"), "warning");
        window.location.href = fallbackHref;
      } finally {
        setPending(false);
      }
    });

    clearValidationState();
    syncFormState();
    state.contactDraft = captureContactFormDraft(form);
  }

  function scrollElementIntoViewWithHeader(element, options = {}) {
    if (!element) {
      return;
    }

    const headerHeight = document.getElementById("site-header")?.getBoundingClientRect().height || 80;
    const offset = -(headerHeight + 18);
    const duration = typeof options.duration === "number" ? options.duration : 0.55;

    if (window.__controlAirLenis?.scrollTo) {
      window.__controlAirLenis.scrollTo(element, {
        offset,
        duration
      });
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({
      top,
      behavior: "smooth"
    });
  }

  function setServiceAccordionState(item, isOpen) {
    if (!item) {
      return;
    }

    const toggle = item.querySelector("[data-service-toggle]");
    const label = item.querySelector("[data-service-toggle-text]");
    const excerpt = item.querySelector("[data-service-excerpt]");

    item.classList.toggle("is-open", isOpen);

    if (toggle) {
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    if (label && toggle) {
      label.textContent = isOpen ? toggle.dataset.closeLabel || "" : toggle.dataset.openLabel || "";
    }

    if (excerpt) {
      excerpt.textContent = isOpen
        ? excerpt.dataset.openText || excerpt.dataset.closedText || ""
        : excerpt.dataset.closedText || excerpt.dataset.openText || "";
    }
  }

  function bindServicesAccordion() {
    const items = Array.from(document.querySelectorAll("[data-service-accordion-item]"));
    if (!items.length) {
      return;
    }

    items.forEach((item) => {
      const toggle = item.querySelector("[data-service-toggle]");
      const collapseEnd = item.querySelector("[data-service-collapse-end]");

      setServiceAccordionState(item, false);

      toggle?.addEventListener("click", () => {
        const shouldOpen = !item.classList.contains("is-open");

        items.forEach((entry) => {
          if (entry !== item) {
            setServiceAccordionState(entry, false);
          }
        });

        setServiceAccordionState(item, shouldOpen);
      });

      collapseEnd?.addEventListener("click", () => {
        setServiceAccordionState(item, false);
        window.requestAnimationFrame(() => {
          scrollElementIntoViewWithHeader(item, {
            duration: 0.42
          });
        });
      });
    });
  }

  function bindWhyChooseInteraction() {
    const canPreviewOnHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    document.querySelectorAll("[data-why-choose]").forEach((section) => {
      const tabs = Array.from(section.querySelectorAll("[data-why-tab]"));
      const panels = Array.from(section.querySelectorAll("[data-why-panel]"));

      if (!tabs.length || !panels.length) {
        return;
      }

      const activateTab = (nextTab, { focus = false } = {}) => {
        if (!nextTab) {
          return;
        }

        const nextKey = nextTab.dataset.whyTab || "";

        tabs.forEach((tab) => {
          const isActive = tab === nextTab;
          tab.classList.toggle("is-active", isActive);
          tab.setAttribute("aria-selected", isActive ? "true" : "false");
          tab.tabIndex = isActive ? 0 : -1;
        });

        panels.forEach((panel) => {
          const isActive = panel.dataset.whyPanel === nextKey;
          panel.hidden = !isActive;
          panel.classList.toggle("is-active", isActive);
        });

        if (focus) {
          nextTab.focus();
        }
      };

      const moveFocusToTab = (currentIndex, direction) => {
        const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
        activateTab(tabs[nextIndex], { focus: true });
      };

      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
          activateTab(tab);
        });

        if (canPreviewOnHover) {
          tab.addEventListener("mouseenter", () => {
            activateTab(tab);
          });
        }

        tab.addEventListener("keydown", (event) => {
          switch (event.key) {
            case "ArrowRight":
            case "ArrowDown":
              event.preventDefault();
              moveFocusToTab(index, 1);
              break;
            case "ArrowLeft":
            case "ArrowUp":
              event.preventDefault();
              moveFocusToTab(index, -1);
              break;
            case "Home":
              event.preventDefault();
              activateTab(tabs[0], { focus: true });
              break;
            case "End":
              event.preventDefault();
              activateTab(tabs[tabs.length - 1], { focus: true });
              break;
            case "Enter":
            case " ":
            case "Spacebar":
              event.preventDefault();
              activateTab(tab);
              break;
            default:
              break;
          }
        });
      });

      activateTab(tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0]);
    });
  }

  function bindPageSpecific() {
    switch (page()) {
      case "home":
        bindWhyChooseInteraction();
        bindServicesAccordion();
        bindProcessStory();
        break;
      case "services":
        bindServicesAccordion();
        break;
      case "works":
        renderWorksGrid();
        bindWorksFilters();
        break;
      case "news":
        renderNewsGrid();
        break;
      case "contact":
        bindContactForm();
        break;
      default:
        break;
    }
  }


function attachGlobalEvents() {
  bindLangSwitch();
  bindMobileMenu();
  bindCookieBanner();
  window.removeEventListener("scroll", scheduleHeaderStateUpdate);
  window.removeEventListener("resize", scheduleHeaderStateUpdate);
  window.addEventListener("resize", scheduleHeaderStateUpdate, { passive: true });

  syncSmoothScrollMode();
  if (!window.__controlAirLenis) {
    window.addEventListener("scroll", scheduleHeaderStateUpdate, { passive: true });
  }
  updateHeaderState();
}

  function shouldHydrateStaticMarkup() {
    if (state.hasCompletedInitialRender) {
      return false;
    }

    const header = document.getElementById("site-header");
    const main = document.getElementById("main");
    const footer = document.getElementById("site-footer");

    return Boolean(
      document.body?.dataset?.prerendered === "true" &&
      state.lang === "fr" &&
      header?.children?.length &&
      main?.children?.length &&
      footer?.children?.length
    );
  }

  function render() {
    document.documentElement.lang = lang();
    const hydrateOnly = shouldHydrateStaticMarkup();

    if (!hydrateOnly) {
      renderHeader();
      renderMain();
      renderFooter();
    }

    renderSkipLink();
    renderCookieBanner();
    performanceState.headerProgress = "";
    cachedHeaderElement = null;
    attachGlobalEvents();
    bindPageSpecific();
    applyResponsiveImages(document);
    bindMarqueePerformance();
    bindMediaPerformance();
    initReveal();
    performanceState.renderReady = true;
    state.hasCompletedInitialRender = true;
    observeFirstUserInputForPerformance();
    startRuntimePerformanceProbe("load");
    scheduleHeaderStateUpdate();
  }

  document.addEventListener("DOMContentLoaded", render);
})();
