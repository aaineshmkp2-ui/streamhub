# StreamHub (Render version)

Same site as before — real TMDB-powered movie/TV discovery, browsing, search,
detail pages, trailers, cast photos, watchlist, ratings — just packaged as a
Node/Express app instead of Cloudflare Pages Functions, so it runs on Render.

## Get a free TMDB API key

1. Sign up at https://www.themoviedb.org/signup
2. Request a key at https://www.themoviedb.org/settings/api (free, instant)
3. Copy the **API Key (v3 auth)**

## Deploy on Render

1. Push this folder to a GitHub repo (Render also needs Git — but its GitHub
   connection tends to be simpler to set up than Cloudflare's; if it also
   struggles, use the "Deploy from a Git URL" option or Render's own CLI).
2. In the Render dashboard: **New → Web Service → connect your repo**.
3. Render should auto-detect the settings from `render.yaml`. If not, set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Under **Environment → Environment Variables**, add:
   - `TMDB_API_KEY` = your key from above
5. Click **Create Web Service**. Render builds and deploys — you'll get a
   `*.onrender.com` URL.

Note: Render's free tier spins the service down after ~15 minutes of no
traffic, so the first request after a while will be slow (~30s cold start)
while it wakes back up. That's a Render free-tier limitation, not a bug in
the app — fine for demos/client previews, worth knowing before you rely on
it for production traffic.

## Run it locally first (optional)

```bash
npm install
export TMDB_API_KEY=your_key_here   # on Windows: set TMDB_API_KEY=your_key_here
npm start
```

Open http://localhost:10000

## Customizing

Same as before — edit `public/config.js` for branding/rows, and the
`:root` variables at the top of `public/style.css` for colors.

## Project structure

```
streamhub-render/
├── server.js        # Express server: serves the frontend + proxies TMDB
├── package.json
├── render.yaml       # Render Blueprint (auto-config)
├── public/           # same frontend as the Cloudflare version
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── config.js
└── README.md
```
