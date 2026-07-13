(() => {
  const supported = ['de-DE', 'en-EN', 'fr-FR', 'es-ES'];
  const labels = {
    'de-DE': '🇩🇪 Deutsch',
    'en-EN': '🇬🇧 English',
    'fr-FR': '🇫🇷 Français',
    'es-ES': '🇪🇸 Español'
  };
  const dictionaries = {};
  let current = 'en-EN';
  let translating = false;

  const style = document.createElement('style');
  style.textContent = '.language-picker{position:relative;display:flex;align-items:center}.language-display{height:38px;min-width:142px;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:0 10px;border:1px solid #72404a;border-radius:7px;background:#241216;color:#f5e9e9;font-weight:700}.language-display-main,.language-option{display:flex;align-items:center;gap:8px}.language-chevron{font-size:10px;color:#d8aeb3}.language-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:100;width:174px;padding:5px;border:1px solid #72404a;border-radius:8px;background:#241216;box-shadow:0 12px 28px #000b}.language-menu[hidden]{display:none}.language-option{width:100%;padding:8px 9px;border-radius:5px;background:transparent;color:#f5e9e9;text-align:left}.language-option:hover,.language-option.active{background:#51242d}.language-flag{width:25px;height:17px;flex:0 0 auto;border-radius:2px;box-shadow:0 0 0 1px #ffffff35;overflow:hidden}.language-flag svg{display:block;width:100%;height:100%}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:650px){.buttons{flex-wrap:wrap}.language-display{min-width:130px}}';
  document.head.append(style);

  const playerInformationLabel = [...document.querySelectorAll('.panel > .label')]
    .find(label => label.textContent.trim() === 'SPIELER & BOT-STATUS');
  if (playerInformationLabel) playerInformationLabel.textContent = 'SPIELERINFORMATIONEN';
  const companionsPanel = [...document.querySelectorAll('.panel')]
    .find(panel => panel.querySelector('.label')?.textContent.trim() === 'BEGLEITER');
  const reportsPanel = document.getElementById('reportsPanel');
  if (companionsPanel && reportsPanel) companionsPanel.after(reportsPanel);

  const picker = document.createElement('label');
  picker.className = 'language-picker';
  picker.innerHTML = '<span class="sr-only">Language</span><select id="languageSelect" class="sr-only" aria-label="Language"></select><button class="language-display" id="languageDisplay" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="language-display-main"><span class="language-flag" id="selectedLanguageFlag"></span><span id="selectedLanguageName">English</span></span><span class="language-chevron">▼</span></button><div class="language-menu" id="languageMenu" role="listbox" hidden></div>';
  const select = picker.querySelector('select');
  for (const locale of supported) {
    const option = document.createElement('option');
    option.value = locale;
    option.textContent = labels[locale];
    select.append(option);
  }
  const flagSvg = locale => ({
    'de-DE':'<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#111" d="M0 0h30v7H0z"/><path fill="#d00" d="M0 7h30v6H0z"/><path fill="#ffce00" d="M0 13h30v7H0z"/></svg>',
    'en-EN':'<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#123b78" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="5" d="M0 0l30 20M30 0L0 20"/><path stroke="#d22630" stroke-width="2" d="M0 0l30 20M30 0L0 20"/><path fill="#fff" d="M12 0h6v20h-6zM0 7h30v6H0z"/><path fill="#d22630" d="M13.5 0h3v20h-3zM0 8.5h30v3H0z"/></svg>',
    'fr-FR':'<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#143c8c" d="M0 0h10v20H0z"/><path fill="#fff" d="M10 0h10v20H10z"/><path fill="#ed2939" d="M20 0h10v20H20z"/></svg>',
    'es-ES':'<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#aa151b" d="M0 0h30v5H0zM0 15h30v5H0z"/><path fill="#f1bf00" d="M0 5h30v10H0z"/></svg>'
  })[locale];
  const languageMenu = picker.querySelector('#languageMenu');
  const languageDisplay = picker.querySelector('#languageDisplay');
  for (const locale of supported) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'language-option';
    item.dataset.locale = locale;
    item.setAttribute('role', 'option');
    item.innerHTML = `<span class="language-flag">${flagSvg(locale)}</span><span>${labels[locale].replace(/^\S+\s/, '')}</span>`;
    item.addEventListener('click', () => {
      select.value = locale;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      languageMenu.hidden = true;
      languageDisplay.setAttribute('aria-expanded', 'false');
    });
    languageMenu.append(item);
  }
  languageDisplay.addEventListener('click', () => {
    languageMenu.hidden = !languageMenu.hidden;
    languageDisplay.setAttribute('aria-expanded', String(!languageMenu.hidden));
  });
  document.querySelector('.buttons')?.append(picker);

  const nativeNumberFormat = Intl.NumberFormat;
  Intl.NumberFormat = class extends nativeNumberFormat {
    constructor(locales, options) { super(window.uiLocale || locales, options); }
  };
  const nativeLocaleString = Date.prototype.toLocaleString;
  const nativeLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleString = function(locales, options) { return nativeLocaleString.call(this, window.uiLocale || locales, options); };
  Date.prototype.toLocaleTimeString = function(locales, options) { return nativeLocaleTimeString.call(this, window.uiLocale || locales, options); };

  function canonicalFor(value) {
    const clean = String(value || '').trim();
    if (!clean) return null;
    for (const dictionary of Object.values(dictionaries)) {
      for (const [source, translated] of Object.entries(dictionary)) {
        if (clean === source || clean === translated) return source;
      }
    }
    return null;
  }

  function translateValue(value) {
    const original = String(value || '');
    const clean = original.trim();
    if (!clean) return original;
    const source = canonicalFor(clean);
    const translated = source ? (dictionaries[current]?.[source] ?? source) : null;
    if (source) {
      const leading = original.match(/^\s*/)?.[0] || '';
      const trailing = original.match(/\s*$/)?.[0] || '';
      return leading + translated + trailing;
    }
    const occupiedSource = 'belegt';
    const occupiedVariants = [occupiedSource, ...Object.values(dictionaries).map(dict => dict[occupiedSource]).filter(Boolean)];
    for (const variant of occupiedVariants) {
      if (clean.endsWith(' ' + variant)) return clean.slice(0, -variant.length) + (dictionaries[current]?.[occupiedSource] || occupiedSource);
    }
    const prefixes = ['Level ', 'Aktualisiert: ', 'Inventar '];
    for (const prefix of prefixes) {
      const canonicalPrefix = canonicalFor(prefix.trim()) || prefix.trim();
      const variants = [prefix.trim(), ...Object.values(dictionaries).map(dict => dict[canonicalPrefix]).filter(Boolean)];
      const matched = variants.find(variant => clean.startsWith(variant + ' '));
      if (matched) {
        let result = (dictionaries[current]?.[canonicalPrefix] || canonicalPrefix) + clean.slice(matched.length);
        const occupiedSource = 'belegt';
        const occupiedVariants = [occupiedSource, ...Object.values(dictionaries).map(dict => dict[occupiedSource]).filter(Boolean)];
        for (const variant of occupiedVariants) if (result.endsWith(variant)) result = result.slice(0, -variant.length) + (dictionaries[current]?.[occupiedSource] || occupiedSource);
        return result;
      }
    }
    return original;
  }

  function translateTree(root = document.body) {
    if (translating || !root) return;
    translating = true;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest('#logs, .equipment-tooltip span')) continue;
      const value = translateValue(node.nodeValue);
      if (value !== node.nodeValue) node.nodeValue = value;
    }
    for (const element of root.querySelectorAll?.('[aria-label],[title]') || []) {
      for (const attribute of ['aria-label', 'title']) {
        if (!element.hasAttribute(attribute)) continue;
        const value = translateValue(element.getAttribute(attribute));
        if (value && value !== element.getAttribute(attribute)) element.setAttribute(attribute, value);
      }
    }
    translating = false;
  }

  async function setLocale(locale, persist = true) {
    if (!supported.includes(locale)) locale = 'en-EN';
    current = locale;
    window.uiLocale = locale;
    document.documentElement.lang = locale;
    select.value = locale;
    picker.querySelector('#selectedLanguageFlag').innerHTML = flagSvg(locale);
    picker.querySelector('#selectedLanguageName').textContent = labels[locale].replace(/^\S+\s/, '');
    picker.querySelectorAll('.language-option').forEach(option => {
      const active = option.dataset.locale === locale;
      option.classList.toggle('active', active);
      option.setAttribute('aria-selected', String(active));
    });
    translateTree();
    if (persist) {
      const response = await fetch('/api/locale', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale }) });
      if (!response.ok) throw new Error(`Language HTTP ${response.status}`);
    }
    window.dispatchEvent(new CustomEvent('tanoth-locale-change', { detail: { locale } }));
  }

  select.addEventListener('change', () => setLocale(select.value).catch(error => {
    const message = document.getElementById('message');
    if (message) message.textContent = error.message;
  }));

  Promise.all(supported.map(async locale => {
    const response = await fetch(`/locales/${locale}.json`, { cache: 'no-store' });
    dictionaries[locale] = response.ok ? await response.json() : {};
  })).then(async () => {
    const response = await fetch('/api/locale', { cache: 'no-store' });
    const settings = response.ok ? await response.json() : { locale: 'en-EN' };
    await setLocale(settings.locale || 'en-EN', false);
    const observer = new MutationObserver(records => {
      if (translating) return;
      for (const record of records) {
        if (record.type === 'characterData') translateTree(record.target.parentElement);
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) translateTree(node);
          else if (node.nodeType === Node.TEXT_NODE) translateTree(node.parentElement);
        }
        if (record.type === 'attributes') translateTree(record.target);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title'] });
  });
})();
