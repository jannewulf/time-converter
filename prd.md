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
| Short date | `2024-01-15`, `01/15/2024`, `15 Jan 2024` |

### Ambiguity Rules

- **Slash-separated dates** (e.g. `01/02/2024`): default to US format (MM/DD/YYYY). Provide a setting to switch to EU (DD/MM/YYYY). Persist the preference.
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
| Relative | `2 months ago` | Live-updates every ~30s |
| Human-readable | `Wednesday, January 15, 2024 10:30:00 AM` | Reflects selected timezone |

Each output row has a **copy button** that copies the **value only** (no label).
Copy buttons show brief "Copied!" feedback.

---

## Timezone Conversion

- Default to the user's local timezone (auto-detected) and display it
- Single timezone selector — all offset-aware outputs reflect the chosen timezone
- **Searchable dropdown**, optimized for keyboard navigation (arrow keys, type-ahead)
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
│  [Now]  [Clear]                              │
└──────────────────────────────────────────────┘
```

### Input Field

- Single-line `<input type="text">` — long values scroll horizontally
- Conversion triggers on every keystroke (debounced ~150ms)
- No submit button

### Buttons

- **"Now"** — inserts current time as ISO 8601 UTC (e.g. `2024-01-15T10:30:00.000Z`)
- **"Clear"** — resets input field and grays out output rows

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
index.html      — markup and meta tags
style.css       — all styles, CSS custom properties for theming
app.js          — parsing, formatting, UI logic
```

No build step. No bundler. No framework. No external dependencies.

### Key Technical Decisions

- Use the browser's `Intl.DateTimeFormat` API for timezone-aware formatting
- Use `Intl.supportedValuesOf('timeZone')` to populate the timezone list
- Relative time calculated manually (no library) — refresh via `setInterval` every 30s
- Timestamp parsing via regex-based format detection (no `Date.parse` — it's unreliable)
- Clipboard API (`navigator.clipboard.writeText()`) for copy functionality

### Hosting

- **GitHub Pages** — deploy from `main` branch
- Static files only, no server-side logic

---

## Meta & Sharing

- SVG favicon (clock icon)
- Open Graph meta tags: `og:title`, `og:description`, `og:image`
- Basic preview card for Slack/Twitter/Discord link sharing

---

## Success Criteria

- A developer can paste any common timestamp and get results in under 1 second
- All output formats are correct and copy-pasteable
- Works in Chrome, Firefox, and Safari (latest versions)
- Lighthouse performance score > 95

---

## Future Ideas (Out of Scope for V1)

- Shareable URLs with the timestamp encoded in the hash
- Batch mode for converting multiple timestamps
- Date/time arithmetic ("add 2 hours")
- Browser extension for converting timestamps on any page
- Customizable output format templates
