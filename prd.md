# Time Converter — Product Requirements Document

## Overview

A single-page website where developers can paste a timestamp in any common format, instantly see it parsed, and convert it to other formats and timezones.

## Problem

Developers constantly deal with timestamps in different formats (Unix epochs, ISO 8601, RFC 2822, etc.) across logs, APIs, and databases. Converting between formats and timezones currently requires juggling multiple tools, writing throwaway code, or searching Stack Overflow.

## Goals

- Accept any common timestamp format as input and auto-detect it
- Show the parsed result in multiple output formats simultaneously
- Let users convert to any timezone
- Zero setup — works entirely in the browser, no backend needed
- Fast, clean, developer-friendly UI

## Non-Goals

- User accounts or saved history
- Date/time math (e.g. "add 3 hours")
- Bulk/batch conversion
- Mobile-first design (desktop-first, but should be responsive)

---

## Supported Input Formats

The parser should auto-detect and handle at least:

| Format | Example |
|---|---|
| Unix seconds | `1700000000` |
| Unix milliseconds | `1700000000000` |
| Unix negative (pre-1970) | `-86400` |
| ISO 8601 | `2024-01-15T10:30:00Z` |
| ISO 8601 with offset | `2024-01-15T10:30:00+02:00` |
| RFC 2822 | `Mon, 15 Jan 2024 10:30:00 +0000` |
| SQL / datetime | `2024-01-15 10:30:00` |
| Short date (YYYY-MM-DD) | `2024-01-15` |
| Short date (YYYYMMDD) | `20240115` |
| Compact ISO 8601 | `20240115T103000` |
| Slash date (US/EU) | `01/15/2024`, `15/01/2024` |
| Slash date with time | `01/15/2024 10:30`, `15/01/2024 10:30:00` |
| Dot date (DD.MM.YYYY) | `15.01.2024`, `15.01.2024 10:30` |
| Dash date (DD-MM-YYYY) | `15-01-2024`, `15-01-2024 10:30:00` |
| Asian date (YYYY/MM/DD) | `2024/01/15`, `2024/01/15 10:30` |
| Named date | `15 Jan 2024`, `January 15, 2024` |
| Time only | `10:30`, `10:30:00`, `2:30 PM` |
| Relative keywords | `now`, `today`, `yesterday`, `tomorrow` (case-insensitive) |

### Ambiguity Rules

- **Slash-separated dates** (e.g. `01/02/2024`): default to US format (MM/DD/YYYY). A contextual toggle appears below the input when a slash-date is detected ("Parsed as MM/DD — click to switch"). Persist the preference.
- **Timestamps without timezone info** (e.g. `2024-01-15 10:30:00`): assume UTC.
- **Unrecognized input**: gray out all output rows (keep them visible with placeholder dashes) rather than clearing them. No error banner — just a subtle "unrecognized format" note below the input.

---

## Output Formats

Once a timestamp is parsed, display all of the following simultaneously:

| Label | Example | Notes |
|---|---|---|
| Unix (s) | `1705312200` | |
| Unix (ms) | `1705312200000` | |
| ISO 8601 | `2024-01-15T10:30:00.000Z` | Always UTC |
| ISO 8601 (offset) | `2024-01-15T12:30:00.000+02:00` | Reflects selected timezone |
| RFC 2822 | `Mon, 15 Jan 2024 10:30:00 +0000` | |
| SQL datetime | `2024-01-15 10:30:00` | |
| Relative | `2 months ago` | Static, computed once at parse time |
| Human-readable | `Wednesday, January 15, 2024 10:30:00 AM` | Reflects selected timezone |

Each output row has a **copy button** that copies the **value only** (no label).
Copy buttons show brief "Copied!" feedback.

---

## Timezone Conversion

- Default to the user's local timezone (auto-detected) and display it
- Single timezone selector — all offset-aware outputs reflect the chosen timezone
- **Searchable dropdown** with fuzzy matching, optimized for keyboard navigation (arrow keys, type-ahead, first result auto-highlighted)
- Supports searching by common abbreviations (e.g. `AEDT`, `PST`, `CET`, `JST`)
- Dropdown opens only when the user starts typing, not on focus
- Show UTC offset alongside timezone name: `Europe/Helsinki (UTC+2)`
- Persist last-used timezone in localStorage

---

## UI / UX

### Layout

```
┌──────────────────────────────────────────────┐
│  Time Converter                   [☀/🌙]     │
├──────────────────────────────────────────────┤
│                                              │
│  [ Paste your timestamp here...           ]  │
│                                              │
│  Detected: ISO 8601          Timezone: [v]   │
│                                              │
│  ┌─ Output ────────────────────────────────┐ │
│  │ Unix (s)      1705312200       [copy]   │ │
│  │ Unix (ms)     1705312200000    [copy]   │ │
│  │ ISO 8601      2024-01-15T...   [copy]   │ │
│  │ ISO 8601 +tz  2024-01-15T...   [copy]   │ │
│  │ RFC 2822      Mon, 15 Jan...   [copy]   │ │
│  │ SQL           2024-01-15 10... [copy]   │ │
│  │ Relative      2 months ago     [copy]   │ │
│  │ Human         Wednesday, ...   [copy]   │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  [Now]                                       │
└──────────────────────────────────────────────┘
```

### Input Field

- Single-line `<input type="text">` — long values scroll horizontally
- Auto-focused on page load with `now` pre-filled and text selected (Ctrl+V replaces immediately)
- Conversion triggers on every keystroke (debounced ~150ms)
- No submit button

### Buttons

- **"Now"** — inserts current time as ISO 8601 UTC (e.g. `2024-01-15T10:30:00.000Z`)

### Error State

- Output rows stay visible but grayed out with `—` dashes
- Subtle "unrecognized format" note appears below the input
- No red banners or modals

### Theme

- **Dark theme by default** (developer audience)
- Auto-detect OS preference via `prefers-color-scheme`
- Manual toggle overrides OS preference
- Persist theme choice in localStorage

### Keyboard Shortcuts

- `Ctrl/Cmd + V` anywhere on the page auto-focuses input and pastes
- `Escape` clears the input

---

## Persistence (localStorage)

The following preferences persist across sessions:

| Key | Value |
|---|---|
| `theme` | `dark` / `light` |
| `dateFormat` | `us` / `eu` |
| `timezone` | IANA timezone string |

---

## Technical Approach

### File Structure

```
index.html      — markup, meta tags, structured data
style.css       — all styles, CSS custom properties for theming
app.js          — parsing, formatting, UI logic
robots.txt      — crawler directives
sitemap.xml     — sitemap for search engines
```

No build step. No bundler. No framework. No external dependencies.

### Key Technical Decisions

- Use the browser's `Intl.DateTimeFormat` API for timezone-aware formatting
- Use `Intl.supportedValuesOf('timeZone')` to populate the timezone list
- Relative time calculated manually (no library) — static, computed once at parse time
- Timestamp parsing via regex-based format detection (no `Date.parse` — it's unreliable)
- Clipboard API (`navigator.clipboard.writeText()`) for copy functionality

### Hosting

- **GitHub Pages** — deploy from `main` branch
- Static files only, no server-side logic

---

## SEO & Sharing

- SVG favicon (clock icon)
- Open Graph meta tags: `og:title`, `og:description`, `og:type`, `og:url`, `og:site_name`
- Twitter Card meta tags: `twitter:card`, `twitter:title`, `twitter:description`
- JSON-LD structured data (`WebApplication` schema)
- Canonical URL, theme-color meta tag
- `robots.txt` and `sitemap.xml`
- Below-the-fold content section with supported formats, features, and usage instructions

---

## Success Criteria

- A developer can paste any common timestamp and get results in under 1 second
- All output formats are correct and copy-pasteable
- Works in Chrome, Firefox, and Safari (latest versions)
- Lighthouse performance score > 95
- Lighthouse SEO score = 100

---

## Monetization

- Consider a single unobtrusive ad unit (e.g. Google AdSense) once traffic justifies it
- Alternative: "Buy me a coffee" / donation link for lower traffic levels

---

## Future Ideas (Out of Scope for V1)

- Shareable URLs with the timestamp encoded in the hash
