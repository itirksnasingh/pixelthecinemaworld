// RAWG GAME SEARCH
export const RAWG_API_KEY = "b9fac9a81e9741bbab7118789304c662";
const RAWG_BASE_URL = "https://api.rawg.io/api";
const RAWG_DEFAULT_IMAGE = "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80";

function buildRawgUrl(path, params = {}) {
  const url = new URL(`${RAWG_BASE_URL}${path}`);
  url.searchParams.set("key", RAWG_API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

async function fetchRawg(path, params) {
  const url = buildRawgUrl(path, params);
  const response = await fetch(url.href);
  if (!response.ok) {
    throw new Error(`RAWG request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeGame(game = {}) {
  return {
    id: game.id,
    title: game.name || "Untitled Game",
    year: (game.released || "").split("-")[0] || "N/A",
    poster: game.background_image || RAWG_DEFAULT_IMAGE,
    overview: game.description_raw?.slice(0, 280) || "A video game experience from RAWG.",
    genre: game.genres?.map((g) => g.name).join(", ") || "Game",
    mediaType: "game",
    source: "rawg",
  };
}

export async function searchGames(query, limit = 6) {
  if (!query?.trim()) return [];
  const data = await fetchRawg("/games", { search: query.trim(), page_size: limit });
  return (data.results || []).map((game) => ({
    ...normalizeGame(game),
    overview: game.short_description || "",
  }));
}

export async function fetchGameById(id) {
  if (!id) throw new Error("Missing RAWG game id");
  const data = await fetchRawg(`/games/${id}`);
  return normalizeGame(data);
}
