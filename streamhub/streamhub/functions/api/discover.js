import { tmdbFetch, json, errorJson } from "./_utils.js";

// GET /api/discover?type=movie|tv&genre=28&sort_by=popularity.desc&page=1&year=2024
export async function onRequestGet({ request, env }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") === "tv" ? "tv" : "movie";
    const params = {
      sort_by: searchParams.get("sort_by") || "popularity.desc",
      page: searchParams.get("page") || "1",
      with_genres: searchParams.get("genre") || undefined,
      "vote_count.gte": searchParams.get("min_votes") || "50",
    };
    const year = searchParams.get("year");
    if (year) {
      params[type === "tv" ? "first_air_date_year" : "primary_release_year"] = year;
    }
    const data = await tmdbFetch(env, `/discover/${type}`, params);
    return json(data);
  } catch (e) {
    return errorJson(e.message);
  }
}
