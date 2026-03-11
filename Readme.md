# CreateCV v3.0 — Production-Ready ATS Resume Builder

> Professional bilingual (Arabic + English) ATS resume builder with live preview, AI analysis, PDF export, and share links.

## Project Structure

```
createcv/
├── public/                  # Static assets served by Express
│   ├── index.html           # Main HTML (semantic, accessible)
│   ├── styles/
│   │   └── main.css         # Full stylesheet with dark mode & RTL
│   ├── assets/              # og-image.png, apple-touch-icon.png
│   └── favicon.svg
│
├── src/                     # ES Module frontend source
│   ├── main.js              # App entry point — wires modules together
│   └── modules/
│       ├── utils.js         # escapeHtml, debounce, uid, $id, $qs, $all
│       ├── i18n.js          # All translations (en + ar), t(), setLang()
│       ├── storage.js       # localStorage save/load/clear, autosave
│       ├── ui.js            # Toast, confirm dialog, modal helpers, focus trap
│       ├── form.js          # Dynamic card creation with data-field attributes
│       ├── preview.js       # Live resume preview renderer
│       ├── ats.js           # ATS score calculator (pure function)
│       ├── pdf.js           # Lazy html2pdf export
│       ├── ai.js            # AI panel — client only sends resumeData, no prompt
│       └── share.js         # Share link encode/decode
│
├── server/
│   └── server.js            # Hardened Express server
│       ├── Helmet (security headers + CSP)
│       ├── CORS (locked to ALLOWED_ORIGINS env var)
│       ├── Rate limiting (60 req/min global, 5 req/min for AI)
│       ├── Server-side prompt construction (prevents prompt injection)
│       ├── Input sanitization (Zod-style manual validation)
│       └── Graceful error handling
│
├── .env.example             # Environment variable template
├── .gitignore
└── package.json             # express, helmet, express-rate-limit, cors
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY

# 3. Run development server
npm run dev
# → http://localhost:3001

# 4. Run production
NODE_ENV=production npm start
```

## Key Improvements in v3.0

### Security
- `helmet.js` adds Content-Security-Policy, X-Frame-Options, and other headers
- Rate limiting: 5 AI requests/IP/minute, 60 general requests/IP/minute
- CORS locked to environment-defined origins
- **Prompt is built server-side** — client can never inject arbitrary AI prompts
- Request body size limited to 64kb (tightened from 512kb)
- Input sanitization with per-field max lengths and type validation

### Code Quality
- Split from 1498-line monolith into 10 focused ES modules
- `data-field` attributes replace fragile positional index access (`fields[0]`)
- Single keyboard handler instead of duplicate `keydown` listeners
- Custom confirm dialog replaces native `confirm()`
- `location.reload()` replaced with programmatic state reset
- All i18n in one object — `shareI18n` merged into main `i18n`
- Autosave decoupled from preview rendering (5s vs 120ms)

### Accessibility
- Dynamic card labels have proper `for`/`id` associations via `uid()`
- Focus trap implemented in all modals (AI panel, Share, Confirm)
- `aria-live="polite"` on AI result panel
- `aria-expanded` on mobile preview toggle
- `aria-required` on required fields

### UX
- Mobile preview toggle button (hidden on desktop, shown below 1200px)
- "Currently working here" checkbox for Experience and Education
- Project URL field with link rendering in preview
- ATS score color managed by CSS classes — not inline JS styles

### Performance
- `type="module"` on script tag — parsed/executed after HTML (no render-blocking)
- Toast uses CSS transitions instead of keyframe animations
- Autosave runs every 5s, not on every keypress

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | No | — | Enables real AI analysis. Without it, demo mode is used. |
| `PORT` | No | 3001 | Server port |
| `ALLOWED_ORIGINS` | Yes (prod) | `http://localhost:3001` | Comma-separated list of allowed CORS origins |
| `NODE_ENV` | No | `development` | Set to `production` for production |

## Deployment (Recommended)

**Option A — Vercel (easiest)**
```bash
# Move to Next.js for full Vercel support (recommended future migration)
```

**Option B — VPS with PM2**
```bash
npm install -g pm2
NODE_ENV=production pm2 start server/server.js --name createcv -i max
pm2 save
pm2 startup
```

**Option C — Docker**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "server/server.js"]
```

## Roadmap (Phase 2)

- [ ] Multiple resume storage (localStorage-based, no backend needed)
- [ ] Job Description ATS keyword matching
- [ ] "Currently working here" → auto-fill "Present" ✅ (done)
- [ ] Visual template picker with thumbnails
- [ ] Dark mode toggle (system preference auto-detected) ✅ (done)
- [ ] User authentication (Supabase Auth)
- [ ] Cover letter AI generator
- [ ] Drag-and-drop section reordering (Sortable.js)
- [ ] Migration to Next.js + Supabase for SaaS tier