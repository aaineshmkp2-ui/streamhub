// Edit this file to customize branding without touching app.js
window.SITE_CONFIG = {
  siteName: "StreamHub",
  accentColor: "#e50914",     // primary accent (buttons, highlights)
  bgColor: "#0a0a0a",         // page background
  defaultRegion: "US",        // used for "Where to Watch" provider lookups (ISO country code)
  heroCount: 6,                // how many titles rotate in the hero banner
  rows: [
    // Each row: { title, source, params }
    // source: "trending" | "discover"
    { title: "Trending Now", source: "trending", params: { type: "all", window: "week" } },
    { title: "Popular Movies", source: "discover", params: { type: "movie", sort_by: "popularity.desc" } },
    { title: "Popular TV Shows", source: "discover", params: { type: "tv", sort_by: "popularity.desc" } },
    { title: "Top Rated Movies", source: "discover", params: { type: "movie", sort_by: "vote_average.desc", min_votes: "1000" } },
    { title: "Action & Adventure", source: "discover", params: { type: "movie", genreName: "Action" } },
    { title: "Comedies", source: "discover", params: { type: "movie", genreName: "Comedy" } },
    { title: "Sci-Fi & Fantasy", source: "discover", params: { type: "tv", genreName: "Sci-Fi & Fantasy" } },
    { title: "Acclaimed Dramas", source: "discover", params: { type: "tv", genreName: "Drama", sort_by: "vote_average.desc" } },
  ],
};
