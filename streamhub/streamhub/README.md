# StreamHub

A real, working movie/TV discovery site — Netflix-style browsing, search, detail pages,
trailers, cast photos, "where to watch" links, profiles, watchlist and ratings —
powered by live data from [TMDB](https://www.themoviedb.org).

No fake data: everything you see (posters, cast photos, descriptions, ratings) comes
from TMDB's real catalog of hundreds of thousands of movies and TV shows.

## How it's built

- **Frontend**: plain HTML/CSS/JS in `/public` — no build step required.
- **Backend**: Cloudflare Pages Functions in `/functions/api` — these proxy requests to
  TMDB so your API key is never exposed in the browser.
- **Data storage**: profiles, watchlist, ratings and viewing progress are saved in the
  visitor's own browser (`localStorage`). There's no database, so this data is
  per-device, not synced across devices. See "Optional upgrades" below if you want
  real accounts that sync everywhere.

## 1. Get a free TMDB API key

1. Create an account at https://www.themoviedb.org/signup
2. Go to https://www.themoviedb.org/settings/api and request an API key (choose
   "Developer", it's free and instant for non-commercial-scale use).
3. Copy the **API Key (v3 auth)** value.

## 2. Run it locally (optional, for testing before you deploy)

```bash
npm install -g wrangler
cd streamhub
wrangler pages dev public --binding TMDB_API_KEY=YOUR_KEY_HERE
```

Open the URL it prints (usually http://localhost:8788).

## 3. Deploy to Cloudflare Pages

**Option A — via the Cloudflare dashboard (easiest, no CLI needed):**

1. Push this folder to a GitHub repo.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Pick your repo. Build settings:
   - Framework preset: `None`
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. Under **Settings → Environment variables**, add:
   - `TMDB_API_KEY` = your key from step 1 (set for both Production and Preview)
5. Deploy. Cloudflare automatically picks up everything in `/functions` as your API.

**Option B — via Wrangler CLI:**

```bash
cd streamhub
wrangler pages deploy public --project-name=streamhub
wrangler pages secret put TMDB_API_KEY --project-name=streamhub
```

That's it — your site is live on a `*.pages.dev` URL, and you can attach a custom
domain under **Custom domains** in the Pages project settings.

## Customizing

Open `public/config.js` — no need to touch the app logic:

- `siteName` — brand name shown in the nav and browser tab
- `heroCount` — how many titles rotate in the top banner
- `rows` — the home page sections; add/remove/reorder rows, or point them at any
  TMDB genre by name
- `defaultRegion` — ISO country code used for "Where to Watch" provider links

Colors/theme live in `public/style.css` at the top (`:root` CSS variables) —
change `--red`, `--bg`, etc.

## Project structure

```
streamhub/
├── public/                 # static frontend (what gets deployed)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── config.js           # <- customize branding/rows here
├── functions/api/          # Cloudflare Pages Functions (serverless backend)
│   ├── _utils.js           # shared TMDB fetch helper
│   ├── trending.js         # GET /api/trending
│   ├── discover.js         # GET /api/discover
│   ├── search.js           # GET /api/search
│   ├── details.js          # GET /api/details
│   └── genres.js           # GET /api/genres
└── README.md
```

## What's real vs. what's simulated

- **Real**: all movie/TV data, posters, backdrops, cast + their real photos,
  trailers (embedded from YouTube via TMDB's video links), ratings, "where to
  watch" provider logos and links.
- **Simulated for demo purposes**: pressing "Play Trailer" nudges a "Continue
  Watching" progress bar — there's no actual video streaming, since this app
  is a discovery/companion site, not a rights-holder for video content itself.
  If you want in-app playback, that requires licensing agreements with studios
  or a legal streaming/VOD partner API — happy to help you scope that separately.

## Optional upgrades (not included, ask if you want these built)

- **Real user accounts** synced across devices — needs an auth provider
  (e.g. Cloudflare Access, Clerk, or a custom flow) + a database
  (Cloudflare D1 or KV) instead of localStorage.
- **Server-rendered pages** for SEO (currently client-rendered).
- **Payment/subscription gating** if you want a paywall.
- **Multi-region "where to watch"** auto-detected from the visitor's location.
