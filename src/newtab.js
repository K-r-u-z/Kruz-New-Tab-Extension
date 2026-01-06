// Prevent scrolling and ensure full coverage
document.documentElement.style.overflow = 'hidden';
document.body.style.overflow = 'hidden';
document.body.style.height = '100vh';
document.body.style.width = '100vw';

// Hide any Chrome default new tab elements
const hideChromeElements = () => {
  const selectors = [
    '[id*="most-visited"]',
    '[id*="customize"]',
    '[class*="customize"]',
    '[class*="most-visited"]'
  ];

  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el && !el.closest('main')) el.style.display = 'none';
      });
    } catch (e) {}
  });
};

document.addEventListener('DOMContentLoaded', () => {
  hideChromeElements();
  setTimeout(hideChromeElements, 100);
  setTimeout(hideChromeElements, 500);

  function revealUI() {
    const root = document.documentElement;
    if (!root.classList.contains('is-preloading')) return;
    requestAnimationFrame(() => root.classList.remove('is-preloading'));
  }

  // --- Blur mapping (stronger at high end)
  const BLUR_SLIDER_MAX = 24;

  // Max blur strength scaled down so 100% ≈ previous ~38% look
  const BLUR_MAX_PX = 12;

  function blurPxFromSliderValue(v) {
    const n = Math.max(0, Math.min(BLUR_SLIDER_MAX, Number(v) || 0));
    const t = n / BLUR_SLIDER_MAX;  // 0..1
    const eased = t * t;            // ease-in (more intense near max)
    return Math.round(eased * BLUR_MAX_PX);
  }

  function percentFromSliderValue(v) {
    const n = Math.max(0, Math.min(BLUR_SLIDER_MAX, Number(v) || 0));
    return Math.round((n / BLUR_SLIDER_MAX) * 100);
  }

  // ✅ Apply blur based on slider value (0..24), but map to pixel blur
  function applyBlur(sliderValue) {
    const n = Math.max(0, Math.min(BLUR_SLIDER_MAX, Number(sliderValue) || 0));
    const px = blurPxFromSliderValue(n);
    const pct = percentFromSliderValue(n);

    document.documentElement.style.setProperty('--bg-blur', `${px}px`);

    if (blurRange) blurRange.value = String(n);
    if (blurPercent) blurPercent.textContent = `${pct}%`;

    // Store slider value so preload can map the same way
    try {
      localStorage.setItem('helium_customBackgroundBlur', String(n));
    } catch (e) {}
  }

  // Command palette refs
  const commandPalette = document.getElementById('command-palette');
  const commandInput = document.getElementById('command-input');
  const paletteBackdrop = commandPalette.querySelector('.command-palette-backdrop');
  let paletteOpen = false;

  // When the palette opens while the clock is centered, temporarily move it to top-middle.
  let prevTimePositionBeforePalette = null;

  // Visible search refs
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');

  // Time/date refs
  const datetimeContainer = document.getElementById('datetime-container');
  const dateDisplay = document.getElementById('date-display');
  const timeDisplay = document.getElementById('time-display');

  // Header / logo refs
  const headerEl = document.getElementById('header');

  // Settings refs
  const bgLayer = document.getElementById('bg-layer');
  const settingsBtn = document.getElementById('settings-btn');
  const popover = document.getElementById('settings-popover');
  const uploadBtn = document.getElementById('upload-bg-btn');
  const resetBtn = document.getElementById('reset-bg-btn');
  const bgUpload = document.getElementById('bg-upload');
  const blurRange = document.getElementById('blur-range');
  const blurPercent = document.getElementById('blur-percent');

  const searchToggle = document.getElementById('search-toggle');
  const searchEngineSelect = document.getElementById('search-engine');
  const customSearchField = document.getElementById('custom-search-field');
  const customSearchUrlInput = document.getElementById('custom-search-url');
  const searchPlaceholderInput = document.getElementById('search-placeholder');
  const timePositionSelect = document.getElementById('time-position');
  const timeFormatSelect = document.getElementById('time-format');
  const clockToggle = document.getElementById('clock-toggle');

  // ✅ NEW: Logo settings refs
  const logoToggle = document.getElementById('logo-toggle');
  const logoPositionSelect = document.getElementById('logo-position');

  // Defaults (persisted)
  let searchEngine = 'google';
  let customSearchUrl = '';
  let searchPlaceholder = 'Search the web or enter a URL';
  let showSearch = true;
  let timePosition = 'top-middle';
  let timeFormat = '12'; // '12' or '24'
  let showClock = true;

  // ✅ NEW: Logo defaults
  let showLogo = true;
  let logoPosition = 'top-left';

  function getSearchUrl(engine, query) {
    const q = encodeURIComponent(query);

    // Broad set of engines + a "custom" option.
    switch (engine) {
      case 'bing':
        return `https://www.bing.com/search?q=${q}`;
      case 'duckduckgo':
        return `https://duckduckgo.com/?q=${q}`;
      case 'yahoo':
        return `https://search.yahoo.com/search?p=${q}`;
      case 'brave':
        return `https://search.brave.com/search?q=${q}`;
      case 'startpage':
        return `https://www.startpage.com/sp/search?query=${q}`;
      case 'ecosia':
        return `https://www.ecosia.org/search?q=${q}`;
      case 'qwant':
        return `https://www.qwant.com/?q=${q}&t=web`;
      case 'swisscows':
        return `https://swisscows.com/en/web?query=${q}`;
      case 'yandex':
        return `https://yandex.com/search/?text=${q}`;
      case 'baidu':
        return `https://www.baidu.com/s?wd=${q}`;
      case 'searxng':
        // Public instance (can be swapped via custom search URL if you prefer your own instance)
        return `https://searx.be/search?q=${q}`;
      case 'wikipedia':
        return `https://en.wikipedia.org/w/index.php?search=${q}`;
      case 'youtube':
        return `https://www.youtube.com/results?search_query=${q}`;
      case 'reddit':
        return `https://www.reddit.com/search/?q=${q}`;
      case 'amazon':
        return `https://www.amazon.com/s?k=${q}`;
      case 'custom': {
        const tpl = (customSearchUrl || '').trim();
        if (!tpl) return `https://www.google.com/search?q=${q}`;
        if (tpl.includes('{q}')) return tpl.split('{q}').join(q);
        // If user didn't include a placeholder, append the query.
        return tpl + q;
      }
      case 'google':
      default:
        return `https://www.google.com/search?q=${q}`;
    }
  }

  function setCustomSearchUI() {
    const isCustom = (searchEngineSelect?.value || searchEngine) === 'custom';
    if (customSearchField) customSearchField.classList.toggle('hidden', !isCustom);
    if (customSearchUrlInput) {
      customSearchUrlInput.disabled = !isCustom;
    }
  }

  function isURL(str) {
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    const domainPattern = /^([\da-z\.-]+)\.([a-z\.]{2,6})$/i;
    return urlPattern.test(str) || domainPattern.test(str);
  }

  function addProtocol(url) {
    if (!/^https?:\/\//i.test(url)) return 'https://' + url;
    return url;
  }

  function runSearch(query) {
    const trimmed = (query || '').trim();
    if (!trimmed) return;

    if (isURL(trimmed)) window.location.href = addProtocol(trimmed);
    else window.location.href = getSearchUrl(searchEngine, trimmed);
  }

  function applyBackgroundToLayer(dataUrl) {
    if (!bgLayer) return;

    if (!dataUrl) {
      bgLayer.style.backgroundImage = '';
      document.documentElement.classList.remove('has-preload-bg');
      document.documentElement.style.removeProperty('--preload-bg-image');
      try { localStorage.removeItem('helium_customBackground'); } catch (e) {}
      return;
    }

    bgLayer.style.backgroundImage = `url("${dataUrl}")`;
    bgLayer.style.backgroundSize = 'cover';
    bgLayer.style.backgroundPosition = 'center';
    bgLayer.style.backgroundRepeat = 'no-repeat';

    try {
      localStorage.setItem('helium_customBackground', dataUrl);
      document.documentElement.style.setProperty('--preload-bg-image', `url("${dataUrl}")`);
      document.documentElement.classList.add('has-preload-bg');
    } catch (e) {}
  }

  // ✅ Apply blur based on slider value (0..24), but map to stronger pixel blur
  function applyBlur(sliderValue) {
    const n = Math.max(0, Math.min(BLUR_SLIDER_MAX, Number(sliderValue) || 0));
    const px = blurPxFromSliderValue(n);
    const pct = percentFromSliderValue(n);

    document.documentElement.style.setProperty('--bg-blur', `${px}px`);

    if (blurRange) blurRange.value = String(n);
    if (blurPercent) blurPercent.textContent = `${pct}%`;

    // Store the slider value so preload can map the same way
    try {
      localStorage.setItem('helium_customBackgroundBlur', String(n));
    } catch (e) {}
  }

  function togglePopover(forceOpen = null) {
    if (!popover) return;
    const willOpen = forceOpen !== null ? forceOpen : popover.classList.contains('hidden');
    popover.classList.toggle('hidden', !willOpen);
    if (settingsBtn) settingsBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function applySearchVisibility(on) {
    showSearch = !!on;
    document.body.classList.toggle('search-hidden', !showSearch);

    const prevPos = timePosition;
    populateTimePositions(showSearch);

    if (timePosition !== prevPos) {
      applyTimePosition(timePosition);
      persist({ timePosition });
    }

    if (showSearch && timePosition === 'center') {
      timePosition = 'top-middle';
      applyTimePosition(timePosition);
      persist({ timePosition });
    }

    if (timePositionSelect) timePositionSelect.value = timePosition;
  }


  function applyClockVisibility(on) {
    showClock = !!on;
    document.body.classList.toggle('clock-hidden', !showClock);
    if (clockToggle) clockToggle.checked = showClock;
  }

  function applyTimePosition(pos) {
    if (!datetimeContainer) return;

    const classes = [
      'time-pos-top-left',
      'time-pos-top-right',
      'time-pos-bottom-left',
      'time-pos-bottom-right',
      'time-pos-top-middle',
      'time-pos-center'
    ];
    datetimeContainer.classList.remove(...classes);

    const map = {
      'top-left': 'time-pos-top-left',
      'top-right': 'time-pos-top-right',
      'bottom-left': 'time-pos-bottom-left',
      'bottom-right': 'time-pos-bottom-right',
      'top-middle': 'time-pos-top-middle',
      'center': 'time-pos-center'
    };

    datetimeContainer.classList.add(map[pos] || 'time-pos-top-middle');
  }

  function populateTimePositions(searchIsOn) {
    if (!timePositionSelect) return;

    const options = [
      { value: 'top-left', label: 'Top left' },
      { value: 'top-middle', label: 'Top middle' },
      { value: 'top-right', label: 'Top right' },
      { value: 'bottom-left', label: 'Bottom left' },
      { value: 'bottom-right', label: 'Bottom right' }
    ];

    if (!searchIsOn) options.splice(1, 0, { value: 'center', label: 'Center' });

    timePositionSelect.innerHTML = '';
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      timePositionSelect.appendChild(o);
    }

    const allowed = options.some(o => o.value === timePosition);
    if (!allowed) timePosition = searchIsOn ? 'top-middle' : 'center';

    timePositionSelect.value = timePosition;
  }

  // ✅ NEW: Logo position options (similar style to time positions)
  function populateLogoPositions() {
    if (!logoPositionSelect) return;

    const options = [
      { value: 'top-left', label: 'Top left' },
      { value: 'top-middle', label: 'Top middle' },
      { value: 'top-right', label: 'Top right' },
      { value: 'bottom-left', label: 'Bottom left' },
      { value: 'bottom-middle', label: 'Bottom middle' },
      { value: 'bottom-right', label: 'Bottom right' }
    ];

    logoPositionSelect.innerHTML = '';
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      logoPositionSelect.appendChild(o);
    }

    const allowed = options.some(o => o.value === logoPosition);
    if (!allowed) logoPosition = 'top-left';

    logoPositionSelect.value = logoPosition;
  }

  function applyLogoVisibility(on) {
    showLogo = !!on;
    document.body.classList.toggle('logo-hidden', !showLogo);
    if (logoToggle) logoToggle.checked = showLogo;
  }

  function applyLogoPosition(pos) {
    if (!headerEl) return;

    const classes = [
      'logo-pos-top-left',
      'logo-pos-top-middle',
      'logo-pos-top-right',
      'logo-pos-bottom-left',
      'logo-pos-bottom-middle',
      'logo-pos-bottom-right'
    ];
    headerEl.classList.remove(...classes);

    const map = {
      'top-left': 'logo-pos-top-left',
      'top-middle': 'logo-pos-top-middle',
      'top-right': 'logo-pos-top-right',
      'bottom-left': 'logo-pos-bottom-left',
      'bottom-middle': 'logo-pos-bottom-middle',
      'bottom-right': 'logo-pos-bottom-right'
    };

    headerEl.classList.add(map[pos] || 'logo-pos-top-left');
  }

  function persist(obj) {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.set(obj, () => {
      if (chrome.runtime?.lastError) console.warn('storage set error:', chrome.runtime.lastError);
    });
  }

  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      runSearch(searchInput.value);
    });
  }

  // Restore settings
  if (chrome?.storage?.local) {
    chrome.storage.local.get(
      [
        'customBackground',
        'customBackgroundBlur', // now treated as slider value (0..24)
        'searchEngine',
        'customSearchUrl',
        'searchPlaceholder',
        'showSearchBar',
        'timePosition',
        'timeFormat',
        'showClock',
        'showLogo',      // ✅ NEW
        'logoPosition'   // ✅ NEW
      ],
      (result) => {
        if (chrome.runtime?.lastError) {
          console.warn('storage get error:', chrome.runtime.lastError);
          revealUI();
          return;
        }

        applyBackgroundToLayer(result.customBackground || null);

        const rawBlur = result.customBackgroundBlur ?? 0;
        const blurSlider = Math.max(0, Math.min(BLUR_SLIDER_MAX, Number(rawBlur) || 0));
        applyBlur(blurSlider);

        if (result.searchEngine) searchEngine = result.searchEngine;
        if (typeof result.customSearchUrl === 'string') customSearchUrl = result.customSearchUrl;
        if (result.searchPlaceholder) searchPlaceholder = result.searchPlaceholder;

        if (typeof result.showSearchBar === 'boolean') showSearch = result.showSearchBar;
        if (result.timePosition) timePosition = result.timePosition;
        if (result.timeFormat) timeFormat = result.timeFormat;
        if (typeof result.showClock === 'boolean') showClock = result.showClock;

        // ✅ NEW: restore logo settings
        if (typeof result.showLogo === 'boolean') showLogo = result.showLogo;
        if (result.logoPosition) logoPosition = result.logoPosition;

        if (searchEngineSelect) searchEngineSelect.value = searchEngine;
        if (customSearchUrlInput) customSearchUrlInput.value = customSearchUrl;
        setCustomSearchUI();
        if (searchPlaceholderInput) searchPlaceholderInput.value = searchPlaceholder;

        if (searchInput) searchInput.placeholder = searchPlaceholder;
        if (commandInput) commandInput.placeholder = searchPlaceholder;

        if (searchToggle) searchToggle.checked = showSearch;
        applySearchVisibility(showSearch);

        applyTimePosition(timePosition);
        if (timePositionSelect) timePositionSelect.value = timePosition;

        if (timeFormatSelect) timeFormatSelect.value = timeFormat;

        if (clockToggle) clockToggle.checked = showClock;
        applyClockVisibility(showClock);

        // ✅ NEW: apply logo settings + UI
        populateLogoPositions();
        applyLogoPosition(logoPosition);
        applyLogoVisibility(showLogo);
        if (logoPositionSelect) logoPositionSelect.value = logoPosition;

        revealUI();
      }
    );
  } else {
    applyBlur(0);
    if (searchInput) searchInput.placeholder = searchPlaceholder;
    if (commandInput) commandInput.placeholder = searchPlaceholder;
    applySearchVisibility(showSearch);
    applyTimePosition(timePosition);
    if (timeFormatSelect) timeFormatSelect.value = timeFormat;

    // ✅ NEW: logo defaults without chrome storage
    populateLogoPositions();
    applyLogoPosition(logoPosition);
    applyLogoVisibility(showLogo);
    if (logoPositionSelect) logoPositionSelect.value = logoPosition;

    revealUI();
  }

  // Popover
  if (settingsBtn && popover) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover();
    });

    document.addEventListener('click', () => togglePopover(false));
    popover.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') togglePopover(false);
    });
  }

  // Background upload
  if (uploadBtn && bgUpload) uploadBtn.addEventListener('click', () => bgUpload.click());

  if (bgUpload) {
    bgUpload.addEventListener('change', () => {
      const file = bgUpload.files && bgUpload.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target.result;
        applyBackgroundToLayer(imageData);
        persist({ customBackground: imageData });
      };

      reader.readAsDataURL(file);
      bgUpload.value = '';
    });
  }

  // Reset
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      applyBackgroundToLayer(null);
      applyBlur(0);

      if (chrome?.storage?.local) {
        chrome.storage.local.remove(['customBackground', 'customBackgroundBlur'], () => {
          if (chrome.runtime?.lastError) console.warn('storage remove error:', chrome.runtime.lastError);
        });
      }
    });
  }

  // Blur slider
  if (blurRange) {
    blurRange.addEventListener('input', () => {
      const val = blurRange.value;
      applyBlur(val);
      persist({ customBackgroundBlur: Number(val) });
    });
  }

  // Search toggle
  if (searchToggle) {
    searchToggle.addEventListener('change', () => {
      applySearchVisibility(searchToggle.checked);
      persist({ showSearchBar: !!searchToggle.checked });
    });
  }

  // Clock toggle
  if (clockToggle) {
    clockToggle.addEventListener('change', () => {
      applyClockVisibility(clockToggle.checked);
      persist({ showClock: !!clockToggle.checked });
    });
  }

  // Search engine
  if (searchEngineSelect) {
    searchEngineSelect.addEventListener('change', () => {
      searchEngine = searchEngineSelect.value;
      persist({ searchEngine });
      setCustomSearchUI();
    });
  }

  // Custom search URL
  if (customSearchUrlInput) {
    customSearchUrlInput.addEventListener('input', () => {
      customSearchUrl = customSearchUrlInput.value || '';
      persist({ customSearchUrl });
    });
  }

  // Placeholder
  if (searchPlaceholderInput) {
    searchPlaceholderInput.addEventListener('input', () => {
      searchPlaceholder = searchPlaceholderInput.value || 'Search the web or enter a URL';
      if (searchInput) searchInput.placeholder = searchPlaceholder;
      if (commandInput) commandInput.placeholder = searchPlaceholder;
      persist({ searchPlaceholder });
    });
  }

  // Time position
  if (timePositionSelect) {
    populateTimePositions(showSearch);

    timePositionSelect.addEventListener('change', () => {
      const chosen = timePositionSelect.value;
      if (showSearch && chosen === 'center') timePosition = 'top-middle';
      else timePosition = chosen;

      applyTimePosition(timePosition);
      persist({ timePosition });
      timePositionSelect.value = timePosition;
    });
  }

  // Time format
  if (timeFormatSelect) {
    timeFormatSelect.addEventListener('change', () => {
      timeFormat = timeFormatSelect.value;
      persist({ timeFormat });
      updateDateTime();
    });
  }

  // ✅ NEW: Logo toggle
  if (logoToggle) {
    logoToggle.addEventListener('change', () => {
      applyLogoVisibility(logoToggle.checked);
      persist({ showLogo: !!logoToggle.checked });
    });
  }

  // ✅ NEW: Logo position
  if (logoPositionSelect) {
    populateLogoPositions();

    logoPositionSelect.addEventListener('change', () => {
      logoPosition = logoPositionSelect.value;
      applyLogoPosition(logoPosition);
      persist({ logoPosition });
      logoPositionSelect.value = logoPosition;
    });
  }

  // Date/time loop
  function updateDateTime() {
    const now = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (dateDisplay) dateDisplay.textContent = now.toLocaleDateString('en-US', dateOptions);

    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    let timeString = '';

    if (timeFormat === '24') {
      timeString =
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}`;
    } else {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;

      timeString =
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')} ${ampm}`;
    }

    if (timeDisplay) timeDisplay.textContent = timeString;
  }

  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Command palette
  function openPalette() {
    if (paletteOpen) return;
    paletteOpen = true;
    commandPalette.classList.remove('hidden');

    // If the clock is centered, lift it up to the top-middle while the palette is open.
    // (Only affects the session; we do NOT persist this.)
    if (showClock && timePosition === 'center') {
      prevTimePositionBeforePalette = timePosition;
      applyTimePosition('top-middle');
    }

    setTimeout(() => commandInput.focus(), 10);
  }

  function closePalette() {
    if (!paletteOpen) return;
    paletteOpen = false;
    commandPalette.classList.add('hidden');
    commandInput.value = '';

    // Restore clock position if we temporarily moved it.
    if (prevTimePositionBeforePalette) {
      applyTimePosition(prevTimePositionBeforePalette);
      prevTimePositionBeforePalette = null;
    }
  }

  function executePaletteCommand() {
    const query = commandInput.value.trim();
    if (!query) {
      closePalette();
      return;
    }
    runSearch(query);
  }

  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? e.metaKey : e.ctrlKey;

    if (modifierKey && e.key === 'k') {
      e.preventDefault();
      // If the visible search bar is enabled, Ctrl/Cmd+K should focus it.
      // Otherwise, use the command palette.
      if (showSearch && searchInput) {
        closePalette();
        searchInput.focus();
        searchInput.select();
      } else {
        paletteOpen ? closePalette() : openPalette();
      }
      return;
    }

    if (e.key === 'Escape' && paletteOpen) {
      e.preventDefault();
      closePalette();
      return;
    }

    // Esc also dismisses the visible search input if it's focused.
    if (e.key === 'Escape' && showSearch && document.activeElement === searchInput) {
      e.preventDefault();
      searchInput.value = '';
      searchInput.blur();
      return;
    }

    if (e.key === 'Enter' && paletteOpen) {
      e.preventDefault();
      executePaletteCommand();
      return;
    }

    if (!paletteOpen && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement === document.body) {
      const isPrintableKey = e.key.length === 1 && !e.key.match(/[\x00-\x1F\x7F]/);
      if (isPrintableKey) {
        e.preventDefault();

        // Unified behavior:
        // - If the visible search bar is enabled, just focus it and start typing there.
        // - If it's disabled, open the command palette and type into it.
        if (showSearch && searchInput) {
          searchInput.focus();
          searchInput.value = e.key;
          // Put caret at end
          requestAnimationFrame(() => {
            try { searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length); } catch (_) {}
          });
        } else {
          openPalette();
          commandInput.value = e.key;
          commandInput.focus();
        }
      }
    }
  });

  paletteBackdrop.addEventListener('click', () => closePalette());
});
