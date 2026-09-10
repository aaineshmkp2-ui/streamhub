import { tmdbFetch, json, errorJson } from "./_utils.js";

// GET /api/genres  -> combined movie + tv genre list, deduped by name
export async function onRequestGet({ env }) {
  try {
    const [movieGenres, tvGenres] = await Promise.all([
      tmdbFetch(env, "/genre/movie/list"),
      tmdbFetch(env, "/genre/tv/list"),
    ]);
    const map = new Map();
    [...movieGenres.genres, ...tvGenres.genres].forEach((g) => map.set(g.name, g.id));
    const merged = Array.from(map, ([name, id]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return json({ genres: merged });
  } catch (e) {
    return errorJson(e.message);
  }
}
