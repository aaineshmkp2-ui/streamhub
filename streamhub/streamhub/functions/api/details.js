import { tmdbFetch, json, errorJson } from "./_utils.js";

// GET /api/details?type=movie|tv&id=603
export async function onRequestGet({ request, env }) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") === "tv" ? "tv" : "movie";
    const id = searchParams.get("id");
    if (!id) return errorJson("Missing id", 400);
    const data = await tmdbFetch(env, `/${type}/${id}`, {
      append_to_response: "credits,videos,similar,watch/providers",
    });
    return json(data);
  } catch (e) {
    return errorJson(e.message);
  }
}
