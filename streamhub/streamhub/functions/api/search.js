import { tmdbFetch, json, errorJson } from "./_utils.js";

// GET /api/search?q=matrix&page=1
export async function onRequestGet({ request, env }) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    if (!q.trim()) return json({ results: [] });
    const data = await tmdbFetch(env, "/search/multi", {
      query: q,
      page: searchParams.get("page") || "1",
      include_adult: "false",
    });
    data.results = (data.results || []).filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
    return json(data);
  } catch (e) {
    return errorJson(e.message);
  }
}
