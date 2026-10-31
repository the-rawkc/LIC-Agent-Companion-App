# LIC Agent Companion

A private, offline-first Progressive Web Application (PWA) designed specifically for a single LIC (Life Insurance Corporation of India) insurance agent in India. It transforms exported policy report PDFs (~1,600 records) into an organized, instant-search mobile workspace with zero mandatory recurring infrastructure costs.

---

## 🌟 Key Features

1. **Local-First & Zero Recurring Costs**:
   - Uses browser **IndexedDB (Dexie.js)** for on-device storage.
   - Operates completely offline once installed. No backend server or paid API required.

2. **High-Accuracy PDF Import Engine**:
   - Client-side extraction using **PDF.js (`pdfjs-dist`)**.
   - Backward-anchored token and coordinate-aware table row reconstruction designed specifically for standard LIC agent policy reports.
   - Zod schema validation: accurately distinguishes D.O.C., F.U.P., D.O.M., DOB, Plan/Term/PPT, Sum Assured (including ₹0 edge cases), and Premium Modes (`Single`, `NF`, `N/F`, `Half-Yearly`, `Quarterly`, `Yearly`).
   - Staged import preview with inline row editor, warning flags, duplicate detection (skip vs. update), and safe rollback.

3. **Global Instant Search**:
   - Instant search modal accessible from any screen via header bar or keyboard shortcut (`/` or `Ctrl+K`).
   - Partial, case-insensitive matching across Customer Names, Policy Numbers, Mobile Numbers, and Plan Codes.

4. **Multi-Policy Customer Management**:
   - Groups multiple policies under one customer profile without falsely assuming identical names are the same person.
   - Contact management with 1-tap **Phone Call** and direct **WhatsApp** links.
   - Safe customer merge tool with policy reassignment, note consolidation, and audit log.

5. **Premium & Maturity Tracking**:
   - Accurately tracks **First Unpaid Premium Date (F.U.P.)** as reported, without misrepresenting it as an official payment notice.
   - Agent-verified next due date overrides.
   - Upcoming maturities forecast (Next 7, 30, 90, 180 days).

6. **Interactive Reminders & Follow-ups**:
   - Scheduled reminders categorized by type: *Customer Follow-up*, *Verify Premium Due Date*, *Maturity Follow-up*, *Document Verification*, and *General*.
   - Quick one-tap checkmark completion and priority tags.

7. **Portfolio Analytics**:
   - Dynamic distribution charts: Top plans by volume, payment modes, commencement timeline, maturity schedule, and premium brackets.
   - Data quality audit highlighting ₹0 sum assured policies and missing DOBs.

8. **Military-Grade Data Privacy & Security**:
   - **Application PIN Lock**: Client-side PIN hashed with **PBKDF2-HMAC-SHA256** (100,000 iterations) using the **Web Crypto API**.
   - **Encrypted Backups**: Full database export encrypted with **AES-GCM 256-bit** using a user-chosen password.
   - **Spreadsheet Export**: One-tap CSV export compatible with Microsoft Excel and Google Sheets.
   - **Safe Restore**: Decrypts and previews backup contents before confirmation.

---

## 🏗️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router v7, Lucide React
- **Database**: IndexedDB with Dexie.js
- **PDF Extraction**: `pdfjs-dist` (local worker bundled for offline use)
- **Validation**: Zod
- **PWA / Offline**: `vite-plugin-pwa` (Service Worker with Workbox precaching)
- **Security / Crypto**: Web Crypto API (`crypto.subtle` AES-GCM + PBKDF2)
- **Testing**: Vitest, `@testing-library/react`, `fake-indexeddb`

---

## 🚀 Quick Start & Development

### 1. Prerequisites
- Node.js 18+ (tested on Node v24)
- npm 9+

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Run Automated Test Suite
```bash
npm run test
```

### 5. Build for Production
```bash
npm run build
```
The output will be placed in the `dist/` directory, complete with service worker and web manifest.

---

## 📱 Android Phone Installation (PWA)

1. Deploy the `dist/` folder to any free static HTTPS host (see below) or open the deployed URL in **Google Chrome** or **Brave** on Android.
2. Tap the three dots menu (**⋮**) in the top right of the browser.
3. Tap **"Add to Home Screen"** or **"Install App"**.
4. Confirm installation. The app will install as a standalone app on your Android home screen with the LIC Companion emblem, offline capability, and fullscreen experience.

---

## 🌐 Free HTTPS Deployment Options

Since this is a client-side, local-first Progressive Web App, it can be hosted on any free static hosting provider:

### Option A: Cloudflare Pages (Recommended - 100% Free Forever)
1. Push this repository to GitHub or GitLab.
2. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages**.
3. Connect your repository.
4. Set build settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Deploy. Cloudflare provides global CDN, free SSL (HTTPS), and zero bandwidth charges.

### Option B: Vercel (Free Hobby Tier)
1. Install Vercel CLI (`npm i -g vercel`) or connect repository on [vercel.com](https://vercel.com).
2. Set Framework Preset to `Vite`.
3. Output Directory: `dist`.
4. Deploy with HTTPS automatically configured.

### Option C: GitHub Pages
1. In `vite.config.ts`, set `base: '/<repo-name>/'`.
2. Configure GitHub Actions workflow to publish `dist/` to the `gh-pages` branch.

---

## 🔒 Security & Privacy Architecture

- **No Remote Telemetry**: Customer personal and financial records are NEVER uploaded to any third-party server or cloud database.
- **Client-Side PIN**: Hashed with a random salt via `PBKDF2-HMAC-SHA256` (100,000 rounds). The raw PIN is never stored.
- **Password-Protected Backups**: Encrypted using authenticated `AES-GCM` (256-bit key) with random IV and PBKDF2 key derivation.
- **Console Privacy**: Sensitive fields (names, phone numbers, policy numbers) are never dumped into console logs.
- **Private URLs**: Query parameters never contain unencrypted customer identifiers or personal records.

---

## 📋 Data Interpretation Rules Followed

1. **Policy Numbers**: Preserved as exact strings.
2. **Sum Assured**: Zero values are preserved as reported and flagged with an audit warning.
3. **F.U.P.**: Treated strictly as the First Unpaid Premium date recorded in the source report, not as a confirmed upcoming payment notice.
4. **Dates**: Parsed using strict format matchers. `00/00/0000` is converted to `null` to avoid erroneous date math.
5. **Report Date**: The reference report date (`29-10-2026`) is explicitly distinguished from the device's current date.
6. **No Phantom Data**: Missing customer phone numbers or addresses are never fabricated or guessed.

---

## 🧪 Automated Test Coverage

The test suite contains 21 unit and integration tests covering:
- PDF token parser & coordinate row reconstruction
- Complex customer names (containing S/O, D/O, initials, titles)
- Duplicate policy prevention and staged diffing
- Multi-policy customer grouping and safe customer merging
- AES-GCM password encryption and decryption validation
- CSV export formatting
- Import rollback mechanisms
