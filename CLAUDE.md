# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A mobile-first single-page web app for managing product outbound orders ("出库商品"). Built with vanilla HTML/CSS/JavaScript, no framework dependencies. Supports both Supabase cloud sync and localStorage fallback.

## Project Structure

```
前端/
├── index.html          # Main entry point
├── css/
│   └── style.css       # Styles (mobile card layout)
├── js/
│   └── app.js          # Business logic (products, search, cart, checkout, data sync)
├── package.json        # Playwright dependencies only
└── screenshot.mjs      # Playwright screenshot script
```

## Common Commands

### Start local dev server
```bash
cd 前端
python3 -m http.server 8081
```
Then open `http://localhost:8081/index.html`

### Run E2E tests (Playwright)
```bash
npx playwright test
```

### Take screenshot for QA
```bash
node screenshot.mjs
```
Requires server running on `http://localhost:8081`

## Architecture

### Single-file vanilla JS app (`js/app.js`)

The app follows a modular function structure organized by sections:

1. **CONFIG** — Supabase URL/key at the top of `app.js`. Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` to enable cloud sync.

2. **PRODUCTS** — Hardcoded product array (~150 items) with fields: `id`, `name`, `category`, `price`. Categories: 彩妆, 护肤口服, 洗护, 周边, 院线.

3. **State** — Single `state` object: `{ activeCategory, searchQuery, cart: {}, submitting }`

4. **DOM caching** — `cacheDom()` runs once at init, stores references to avoid repeated `querySelector`.

5. **Rendering** — `renderTabs()` and `renderProducts()` rebuild innerHTML from state. Products re-render on every state change (category switch, search, quantity change).

6. **Search** — Debounced input (200ms), filters by name and product ID.

7. **Cart/Quantity** — `updateQty(id, delta)` mutates `state.cart`, triggers `updateCheckout()` + `renderProducts()`. Supports +/- buttons and direct number input.

8. **Checkout Modal** — Bottom sheet style. Shows order items list, requires applicant name and remark. Validates before submit.

9. **Data Layer** — `saveToSupabase(order)` falls back to `saveToLocalStorage(order)` when Supabase is unconfigured. `subscribeToOrders(callback)` connects to Supabase Realtime WebSocket for multi-device sync notifications.

### CSS Architecture (`css/style.css`)

- CSS custom properties for theming (primary: `#f86f52`, accent: `#e8c591`)
- Three sticky positioned elements: topbar, search-bar, tab-bar
- Fixed bottom checkout bar
- Modal slides up from bottom
- Responsive: max-width 600px centered on desktop

## Key Notes

- All console.log statements are development-only; remove before production
- Supabase credentials are hardcoded in CONFIG — should be externalized for production
- No build step required — runs directly in browser
- Playwright is the only dev dependency, used for E2E testing