(() => {
  const supportedLanguages = ['en', 'es', 'fr'];
  const translatedAttributes = ['aria-label', 'title', 'placeholder'];
  const textState = new WeakMap();
  const attributeState = new WeakMap();
  let currentLanguage = 'en';
  let catalogue = { meta: {}, translations: { es: {}, fr: {} } };
  let observer;

  const chooseInitialLanguage = () => {
    try {
      const saved = localStorage.getItem('portfolio-language');
      if (supportedLanguages.includes(saved)) return saved;
    } catch {
      // Browser preference remains available when storage is unavailable.
    }

    const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
    const match = browserLanguages
      .map((language) => String(language || '').toLowerCase().split('-')[0])
      .find((language) => supportedLanguages.includes(language));
    return match || 'en';
  };

  const interpolate = (value, variables = {}) => String(value).replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  ));

  const translatePattern = (source, language) => {
    const dictionaries = {
      es: {
        light: 'claro',
        dark: 'oscuro',
        switchTheme: 'Cambiar al tema {theme}',
        video: 'Video de {title}',
        rateLimit: 'Hay dos simulaciones nuevas disponibles por minuto. La repetición es ilimitada; el siguiente cálculo estará disponible en {seconds} s.',
        simulationError: 'Error de simulación: {error}'
      },
      fr: {
        light: 'clair',
        dark: 'sombre',
        switchTheme: 'Passer au thème {theme}',
        video: 'Vidéo de {title}',
        rateLimit: 'Deux nouvelles simulations sont disponibles par minute. La relecture est illimitée; le prochain calcul sera disponible dans {seconds} s.',
        simulationError: 'Erreur de simulation : {error}'
      }
    };
    const dictionary = dictionaries[language];
    if (!dictionary) return source;

    const themeMatch = source.match(/^Switch to (light|dark) theme$/);
    if (themeMatch) return interpolate(dictionary.switchTheme, { theme: dictionary[themeMatch[1]] });

    const videoMatch = source.match(/^(.+) video$/);
    if (videoMatch) return interpolate(dictionary.video, { title: videoMatch[1] });

    const rateLimitMatch = source.match(/^Two new simulations are available per minute\. Replay is unlimited; the next recalculation is available in (\d+) s\.$/);
    if (rateLimitMatch) return interpolate(dictionary.rateLimit, { seconds: rateLimitMatch[1] });

    const errorMatch = source.match(/^Simulation error: (.+)$/);
    if (errorMatch) return interpolate(dictionary.simulationError, { error: errorMatch[1] });

    return source;
  };

  const translate = (source, variables = {}) => {
    const raw = String(source ?? '');
    if (currentLanguage === 'en') return interpolate(raw, variables);
    const exact = catalogue.translations?.[currentLanguage]?.[raw];
    if (exact) return interpolate(exact, variables);
    return interpolate(translatePattern(raw, currentLanguage), variables);
  };

  const excludedTextNode = (node) => {
    const parent = node.parentElement;
    return !parent || Boolean(parent.closest('script, style, pre, code, .language-select'));
  };

  const translateTextNode = (node, refreshSource = false) => {
    if (excludedTextNode(node)) return;
    const existing = textState.get(node);
    if (!existing || refreshSource || node.nodeValue !== existing.lastApplied) {
      textState.set(node, { source: node.nodeValue, lastApplied: node.nodeValue });
    }

    const state = textState.get(node);
    const trimmed = state.source.trim();
    if (!trimmed) return;
    const localized = translate(trimmed);
    const nextValue = state.source.replace(trimmed, localized);
    node.nodeValue = nextValue;
    state.lastApplied = nextValue;
  };

  const translateElementAttributes = (element, refreshSource = false) => {
    if (!(element instanceof Element)) return;
    let states = attributeState.get(element);
    if (!states) {
      states = new Map();
      attributeState.set(element, states);
    }

    translatedAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const value = element.getAttribute(attribute);
      const existing = states.get(attribute);
      if (!existing || refreshSource || value !== existing.lastApplied) {
        states.set(attribute, { source: value, lastApplied: value });
      }
      const state = states.get(attribute);
      const localized = translate(state.source);
      element.setAttribute(attribute, localized);
      state.lastApplied = localized;
    });
  };

  const translateTree = (root, refreshSource = false) => {
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root, refreshSource);
      return;
    }
    if (!(root instanceof Element) && root !== document.body) return;
    if (root instanceof Element) translateElementAttributes(root, refreshSource);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, refreshSource);
      else translateElementAttributes(node, refreshSource);
      node = walker.nextNode();
    }
  };

  const observeDocument = () => {
    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      observer.disconnect();
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') translateTextNode(mutation.target, true);
        if (mutation.type === 'attributes') translateElementAttributes(mutation.target, true);
        mutation.addedNodes?.forEach((node) => translateTree(node, true));
      });
      observer.takeRecords();
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: translatedAttributes
      });
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatedAttributes
    });
  };

  const applyLanguage = (language, { persist = true } = {}) => {
    currentLanguage = supportedLanguages.includes(language) ? language : 'en';
    document.documentElement.lang = currentLanguage;
    document.documentElement.dataset.language = currentLanguage;

    const selector = document.querySelector('.language-select');
    if (selector) selector.value = currentLanguage;

    if (persist) {
      try {
        localStorage.setItem('portfolio-language', currentLanguage);
      } catch {
        // The selected language still applies for this page view.
      }
    }

    observer?.disconnect();
    translateTree(document.body);
    const meta = catalogue.meta?.[currentLanguage] || catalogue.meta?.en;
    if (meta?.title) document.title = meta.title;
    if (meta?.description) document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
    observer?.takeRecords();
    observeDocument();
    document.dispatchEvent(new CustomEvent('portfolio-language-change', { detail: { language: currentLanguage } }));
  };

  const ready = fetch('assets/data/i18n.json?v=20260801-trilingual1')
    .then((response) => {
      if (!response.ok) throw new Error('Translation catalogue could not be loaded.');
      return response.json();
    })
    .then((data) => {
      catalogue = data;
      const selector = document.querySelector('.language-select');
      if (selector) {
        selector.disabled = false;
        selector.addEventListener('change', () => applyLanguage(selector.value));
      }
      applyLanguage(chooseInitialLanguage(), { persist: false });
      return currentLanguage;
    })
    .catch((error) => {
      console.warn('Translations were not loaded; keeping the English portfolio.', error);
      document.documentElement.lang = 'en';
      document.querySelector('.language-select')?.removeAttribute('disabled');
      return 'en';
    });

  window.PortfolioI18n = {
    applyLanguage,
    getLanguage: () => currentLanguage,
    ready,
    t: translate
  };
})();
