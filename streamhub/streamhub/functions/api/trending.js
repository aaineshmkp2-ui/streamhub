import { tmdbFetch, json, errorJson } from "./_utils.js";

// GET /api/trending?type=all|movie|tv&window=day|week
export async function onRequestGet({ request, env }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const win = searchParams.get("window") || "week";
    const data = await tmdbFetch(env, `/trending/${type}/${win}`);
    return json(data);
  } catch (e) {
    return errorJson(e.message);
  }
}
