// StreamHub — Express server for Render.
// Serves the static frontend and proxies TMDB requests so the API key
// never reaches the browser.

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbFetch(pathname, params = {}) {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not set. Add it in Render > Environment.");
  }
  const url = new URL(`${TMDB_BASE}${pathname}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", params.language || "en-US");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ---------- API routes ----------
app.get("/api/trending", async (req, res) => {
  try {
    const type = req.query.type || "all";
    const win = req.query.window || "week";
    res.json(await tmdbFetch(`/trending/${type}/${win}`));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/discover", async (req, res) => {
  try {
    const type = req.query.type === "tv" ? "tv" : "movie";
    const params = {
      sort_by: req.query.sort_by || "popularity.desc",
      page: req.query.page || "1",
      with_genres: req.query.genre || undefined,
      "vote_count.gte": req.query.min_votes || "50",
    };
    if (req.query.year) {
      params[type === "tv" ? "first_air_date_year" : "primary_release_year"] = req.query.year;
    }
    res.json(await tmdbFetch(`/discover/${type}`, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    if (!q.trim()) return res.json({ results: [] });
    const data = await tmdbFetch("/search/multi", {
      query: q,
      page: req.query.page || "1",
      include_adult: "false",
    });
    data.results = (data.results || []).filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/details", async (req, res) => {
  try {
    const type = req.query.type === "tv" ? "tv" : "movie";
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    res.json(await tmdbFetch(`/${type}/${id}`, { append_to_response: "credits,videos,similar,watch/providers" }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/genres", async (req, res) => {
  try {
    const [movieGenres, tvGenres] = await Promise.all([
      tmdbFetch("/genre/movie/list"),
      tmdbFetch("/genre/tv/list"),
    ]);
    const map = new Map();
    [...movieGenres.genres, ...tvGenres.genres].forEach((g) => map.set(g.name, g.id));
    const merged = Array.from(map, ([name, id]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ genres: merged });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Static frontend ----------
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`StreamHub running on port ${PORT}`);
});
