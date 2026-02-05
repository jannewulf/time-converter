(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────

  let currentDate = null;
  let currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let dateFormat = 'us';
  let theme = null; // resolved in initTheme
  let relativeTimer = null;
  let debounceTimer = null;
  let highlightedIndex = -1;
  let filteredTimezones = [];
  let allTimezones = [];

  // ── DOM refs ────────────────────────────────────────────

  const $ = (id) => document.getElementById(id);
  const input = $('timestamp-input');
  const feedback = $('input-feedback');
  const detectedEl = $('detected-format');
  const outputSection = $('output-section');
  const tzSearch = $('tz-search');
  const tzList = $('tz-list');
  const tzDropdown = $('tz-dropdown');
  const themeToggle = $('theme-toggle');
  const dateFormatToggle = $('date-format-toggle');
  const nowBtn = $('now-btn');
  const clearBtn = $('clear-btn');

  const outputs = {
    'unix-s': $('out-unix-s'),
    'unix-ms': $('out-unix-ms'),
    iso: $('out-iso'),
    'iso-tz': $('out-iso-tz'),
    rfc: $('out-rfc'),
    sql: $('out-sql'),
    relative: $('out-relative'),
    human: $('out-human'),
  };

  // ── Init ────────────────────────────────────────────────

  function init() {
    loadPreferences();
    initTheme();
    populateTimezones();
    setupListeners();
    startRelativeTimer();
    grayOut();
  }

  // ── Preferences ─────────────────────────────────────────

  function loadPreferences() {
    const saved = localStorage.getItem('tc_timezone');
    if (saved) currentTimezone = saved;

    const savedFmt = localStorage.getItem('tc_dateFormat');
    if (savedFmt === 'eu' || savedFmt === 'us') dateFormat = savedFmt;

    dateFormatToggle.textContent = dateFormat === 'us' ? 'MM/DD' : 'DD/MM';
  }

  function savePref(key, value) {
    localStorage.setItem('tc_' + key, value);
  }

  // ── Theme ───────────────────────────────────────────────

  function initTheme() {
    const saved = localStorage.getItem('tc_theme');
    if (saved) {
      theme = saved;
    } else {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    savePref('theme', theme);
  }

  // ── Timezone list ───────────────────────────────────────

  function populateTimezones() {
    try {
      allTimezones = Intl.supportedValuesOf('timeZone');
    } catch {
      // Fallback for older browsers
      allTimezones = [
        'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
        'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Helsinki',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
      ];
    }
    tzSearch.value = formatTzDisplay(currentTimezone);
    filteredTimezones = allTimezones;
  }

  function formatTzDisplay(tz) {
    const offset = getUTCOffsetString(new Date(), tz);
    return tz + ' (UTC' + offset + ')';
  }

  function getUTCOffsetString(date, tz) {
    const parts = getPartsInTz(date, tz);
    const localMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const utcMs = Date.UTC(
      date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
      date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()
    );
    const diffMin = Math.round((localMs - utcMs) / 60000);
    if (diffMin === 0) return '+0';
    const sign = diffMin > 0 ? '+' : '-';
    const absMin = Math.abs(diffMin);
    const h = Math.floor(absMin / 60);
    const m = absMin % 60;
    return sign + h + (m ? ':' + String(m).padStart(2, '0') : '');
  }

  function renderTzList() {
    tzList.innerHTML = '';
    highlightedIndex = -1;
    filteredTimezones.forEach((tz, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.textContent = formatTzDisplay(tz);
      if (tz === currentTimezone) li.classList.add('selected');
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectTimezone(tz);
      });
      li.addEventListener('mouseenter', () => {
        setHighlight(i);
      });
      tzList.appendChild(li);
    });
  }

  function openTzDropdown() {
    filteredTimezones = allTimezones;
    renderTzList();
    tzList.classList.add('open');
    tzSearch.setAttribute('aria-expanded', 'true');
    tzSearch.select();
  }

  function closeTzDropdown() {
    tzList.classList.remove('open');
    tzSearch.setAttribute('aria-expanded', 'false');
    tzSearch.value = formatTzDisplay(currentTimezone);
    highlightedIndex = -1;
  }

  function selectTimezone(tz) {
    currentTimezone = tz;
    savePref('timezone', tz);
    closeTzDropdown();
    if (currentDate) updateOutputs();
  }

  function filterTimezones(query) {
    const q = query.toLowerCase();
    filteredTimezones = allTimezones.filter((tz) => tz.toLowerCase().includes(q));
    renderTzList();
  }

  function setHighlight(index) {
    const items = tzList.children;
    if (highlightedIndex >= 0 && highlightedIndex < items.length) {
      items[highlightedIndex].classList.remove('highlighted');
    }
    highlightedIndex = index;
    if (index >= 0 && index < items.length) {
      items[index].classList.add('highlighted');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  // ── Parsing ─────────────────────────────────────────────

  const FORMATS = [
    { name: 'Unix (ms)', test: /^-?\d{13,}$/, parse: (s) => new Date(parseInt(s, 10)) },
    { name: 'Unix (s)', test: /^-?\d{1,12}$/, parse: (s) => new Date(parseInt(s, 10) * 1000) },
    {
      name: 'ISO 8601',
      test: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/i,
      parse: parseISO,
    },
    {
      name: 'RFC 2822',
      test: /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}(:\d{2})?\s*([+-]\d{4}|[A-Z]{2,4})?$/,
      parse: parseRFC2822,
    },
    {
      name: 'SQL datetime',
      test: /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/,
      parse: (s) => new Date(s.replace(' ', 'T') + 'Z'),
    },
    {
      name: 'Date (YYYY-MM-DD)',
      test: /^\d{4}-\d{2}-\d{2}$/,
      parse: (s) => new Date(s + 'T00:00:00Z'),
    },
    {
      name: dateFormat === 'us' ? 'Date (MM/DD/YYYY)' : 'Date (DD/MM/YYYY)',
      test: /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      parse: parseSlashDate,
    },
    {
      name: 'Date (DD Mon YYYY)',
      test: /^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/,
      parse: (s) => {
        const d = new Date(s + ' UTC');
        return isNaN(d.getTime()) ? null : d;
      },
    },
  ];

  function parseTimestamp(input) {
    const trimmed = input.trim();
    if (!trimmed) return { date: null, format: null };

    for (const fmt of FORMATS) {
      // Refresh the slash-date format name dynamically
      if (fmt.test.source.includes('\\/')) {
        fmt.name = dateFormat === 'us' ? 'Date (MM/DD/YYYY)' : 'Date (DD/MM/YYYY)';
      }
      if (fmt.test.test(trimmed)) {
        const d = fmt.parse(trimmed);
        if (d && !isNaN(d.getTime())) {
          return { date: d, format: fmt.name };
        }
      }
    }
    return { date: null, format: null };
  }

  function parseISO(s) {
    // If no timezone indicator, assume UTC
    const hasOffset = /Z|[+-]\d{2}:\d{2}$/i.test(s);
    const str = hasOffset ? s : s + 'Z';
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function parseRFC2822(s) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function parseSlashDate(s) {
    const parts = s.split('/');
    let month, day, year;
    if (dateFormat === 'us') {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }
    year = parseInt(parts[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    return isNaN(d.getTime()) ? null : d;
  }

  // ── Timezone helpers ────────────────────────────────────

  function getPartsInTz(date, tz) {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const p = {};
    f.formatToParts(date).forEach((part) => {
      if (part.type !== 'literal') p[part.type] = part.value;
    });
    return {
      year: parseInt(p.year, 10),
      month: parseInt(p.month, 10),
      day: parseInt(p.day, 10),
      hour: parseInt(p.hour, 10) % 24,
      minute: parseInt(p.minute, 10),
      second: parseInt(p.second, 10),
    };
  }

  function getOffsetMinutes(date, tz) {
    const parts = getPartsInTz(date, tz);
    const localMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const utcMs = Date.UTC(
      date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
      date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()
    );
    return Math.round((localMs - utcMs) / 60000);
  }

  function formatOffsetHHMM(minutes) {
    const sign = minutes >= 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const h = String(Math.floor(abs / 60)).padStart(2, '0');
    const m = String(abs % 60).padStart(2, '0');
    return sign + h + ':' + m;
  }

  // ── Output formatters ──────────────────────────────────

  function formatUnixS(date) {
    return String(Math.floor(date.getTime() / 1000));
  }

  function formatUnixMs(date) {
    return String(date.getTime());
  }

  function formatISO(date) {
    return date.toISOString();
  }

  function formatISOWithOffset(date, tz) {
    const parts = getPartsInTz(date, tz);
    const ms = date.getTime() % 1000;
    const offset = formatOffsetHHMM(getOffsetMinutes(date, tz));
    return (
      String(parts.year).padStart(4, '0') + '-' +
      String(parts.month).padStart(2, '0') + '-' +
      String(parts.day).padStart(2, '0') + 'T' +
      String(parts.hour).padStart(2, '0') + ':' +
      String(parts.minute).padStart(2, '0') + ':' +
      String(parts.second).padStart(2, '0') + '.' +
      String(ms).padStart(3, '0') +
      offset
    );
  }

  const RFC_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const RFC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatRFC2822(date, tz) {
    const parts = getPartsInTz(date, tz);
    const offsetMin = getOffsetMinutes(date, tz);
    // Build a temp date in that timezone to get the day-of-week
    const tempDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
    const dow = RFC_DAYS[tempDate.getUTCDay()];
    const mon = RFC_MONTHS[parts.month - 1];
    const sign = offsetMin >= 0 ? '+' : '-';
    const absOff = Math.abs(offsetMin);
    const offH = String(Math.floor(absOff / 60)).padStart(2, '0');
    const offM = String(absOff % 60).padStart(2, '0');
    return (
      dow + ', ' +
      String(parts.day).padStart(2, '0') + ' ' +
      mon + ' ' +
      parts.year + ' ' +
      String(parts.hour).padStart(2, '0') + ':' +
      String(parts.minute).padStart(2, '0') + ':' +
      String(parts.second).padStart(2, '0') + ' ' +
      sign + offH + offM
    );
  }

  function formatSQL(date, tz) {
    const parts = getPartsInTz(date, tz);
    return (
      String(parts.year).padStart(4, '0') + '-' +
      String(parts.month).padStart(2, '0') + '-' +
      String(parts.day).padStart(2, '0') + ' ' +
      String(parts.hour).padStart(2, '0') + ':' +
      String(parts.minute).padStart(2, '0') + ':' +
      String(parts.second).padStart(2, '0')
    );
  }

  function formatRelative(date) {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const absDiff = Math.abs(diffMs);
    const future = diffMs < 0;

    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30.44);
    const years = Math.floor(days / 365.25);

    let str;
    if (seconds < 5) str = 'just now';
    else if (seconds < 60) str = seconds + ' seconds';
    else if (minutes === 1) str = '1 minute';
    else if (minutes < 60) str = minutes + ' minutes';
    else if (hours === 1) str = '1 hour';
    else if (hours < 24) str = hours + ' hours';
    else if (days === 1) str = '1 day';
    else if (days < 30) str = days + ' days';
    else if (months === 1) str = '1 month';
    else if (months < 12) str = months + ' months';
    else if (years === 1) str = '1 year';
    else str = years + ' years';

    if (str === 'just now') return str;
    return future ? 'in ' + str : str + ' ago';
  }

  function formatHuman(date, tz) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  }

  // ── UI updates ──────────────────────────────────────────

  function updateOutputs() {
    if (!currentDate) {
      grayOut();
      return;
    }
    outputSection.classList.remove('inactive');
    outputs['unix-s'].textContent = formatUnixS(currentDate);
    outputs['unix-ms'].textContent = formatUnixMs(currentDate);
    outputs.iso.textContent = formatISO(currentDate);
    outputs['iso-tz'].textContent = formatISOWithOffset(currentDate, currentTimezone);
    outputs.rfc.textContent = formatRFC2822(currentDate, currentTimezone);
    outputs.sql.textContent = formatSQL(currentDate, currentTimezone);
    outputs.relative.textContent = formatRelative(currentDate);
    outputs.human.textContent = formatHuman(currentDate, currentTimezone);
  }

  function grayOut() {
    outputSection.classList.add('inactive');
    Object.values(outputs).forEach((el) => {
      el.textContent = '\u2014';
    });
  }

  function onInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const val = input.value;
      if (!val.trim()) {
        currentDate = null;
        detectedEl.textContent = '\u2014';
        feedback.textContent = '';
        grayOut();
        return;
      }
      const result = parseTimestamp(val);
      if (result.date) {
        currentDate = result.date;
        detectedEl.textContent = result.format;
        feedback.textContent = '';
        updateOutputs();
      } else {
        currentDate = null;
        detectedEl.textContent = '\u2014';
        feedback.textContent = 'Unrecognized format';
        grayOut();
      }
    }, 150);
  }

  // ── Copy ────────────────────────────────────────────────

  function copyValue(button) {
    const targetId = button.getAttribute('data-target');
    const el = document.getElementById(targetId);
    if (!el || el.textContent === '\u2014') return;

    navigator.clipboard.writeText(el.textContent).then(() => {
      button.textContent = 'Copied!';
      button.classList.add('copied');
      setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('copied');
      }, 1200);
    });
  }

  // ── Relative timer ──────────────────────────────────────

  function startRelativeTimer() {
    relativeTimer = setInterval(() => {
      if (currentDate) {
        outputs.relative.textContent = formatRelative(currentDate);
      }
    }, 30000);
  }

  // ── Event listeners ─────────────────────────────────────

  function setupListeners() {
    // Input
    input.addEventListener('input', onInput);

    // Copy buttons
    outputSection.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn');
      if (btn) copyValue(btn);
    });

    // Now / Clear
    nowBtn.addEventListener('click', () => {
      input.value = new Date().toISOString();
      onInput();
      input.focus();
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      currentDate = null;
      detectedEl.textContent = '\u2014';
      feedback.textContent = '';
      grayOut();
      input.focus();
    });

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Date format toggle
    dateFormatToggle.addEventListener('click', () => {
      dateFormat = dateFormat === 'us' ? 'eu' : 'us';
      dateFormatToggle.textContent = dateFormat === 'us' ? 'MM/DD' : 'DD/MM';
      savePref('dateFormat', dateFormat);
      // Re-parse if there's input
      if (input.value.trim()) onInput();
    });

    // Timezone dropdown
    tzSearch.addEventListener('focus', openTzDropdown);

    tzSearch.addEventListener('input', () => {
      filterTimezones(tzSearch.value);
    });

    tzSearch.addEventListener('blur', () => {
      // Delay to allow click on list item
      setTimeout(closeTzDropdown, 150);
    });

    tzSearch.addEventListener('keydown', (e) => {
      const items = tzList.children;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(Math.min(highlightedIndex + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(Math.max(highlightedIndex - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredTimezones.length) {
          selectTimezone(filteredTimezones[highlightedIndex]);
        }
      } else if (e.key === 'Escape') {
        closeTzDropdown();
        tzSearch.blur();
      }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape to clear (when not in tz dropdown)
      if (e.key === 'Escape' && document.activeElement !== tzSearch) {
        input.value = '';
        currentDate = null;
        detectedEl.textContent = '\u2014';
        feedback.textContent = '';
        grayOut();
        input.focus();
      }

      // Ctrl/Cmd + V: focus input (browser handles the paste)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (document.activeElement !== input && document.activeElement !== tzSearch) {
          input.focus();
          // Allow default paste to happen into the now-focused input
        }
      }
    });
  }

  // ── Boot ────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', init);
})();
