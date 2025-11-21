// TMDB API
export const TMDB_API_KEY = "496d3c3a14530d3bc46fcbca05396637";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500";

const DEFAULT_POSTER = "https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg";

async function fetchFromTMDB(endpoint, searchParams = {}) {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.href);
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeEntry(entry = {}) {
  const title = entry.title || entry.name || entry.original_title || entry.original_name || "Untitled";
  const year = (entry.release_date || entry.first_air_date || "").split("-")[0] || "N/A";
  const poster = entry.poster_path ? `${TMDB_IMG_BASE}${entry.poster_path}` : DEFAULT_POSTER;
  const overview = entry.overview || "No overview available.";
  const genres = entry.genres?.map((g) => g.name) || [];

  return {
    id: entry.id,
    title,
    year,
    poster,
    overview,
    genre: genres.length
      ? genres
          .map((g) => (typeof g === "string" ? g : g?.name))
          .filter(Boolean)
          .join(", ")
      : "Unknown",
    mediaType: entry.media_type || (entry.first_air_date ? "tv" : "movie"),
    source: "tmdb",
  };
}

export async function searchTitles(query) {
  if (!query?.trim()) {
    throw new Error("Please enter a title");
  }

  const searchData = await fetchFromTMDB("/search/multi", { query: query.trim(), include_adult: "false" });
  const matches = (searchData.results || []).filter((item) => ["movie", "tv"].includes(item.media_type));
  if (!matches.length) {
    throw new Error("No movies or shows found");
  }
  return matches.map((item) => normalizeEntry(item));
}

export async function fetchById(id, type) {
  if (!id || !type) {
    throw new Error("Missing TMDB id or type");
  }
  const safeType = type === "tv" ? "tv" : "movie";
  const details = await fetchFromTMDB(`/${safeType}/${id}`);
  return normalizeEntry({ ...details, media_type: safeType });
}
