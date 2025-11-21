// MUSICBRAINZ SEARCH
const MUSIC_BASE_URL = "https://musicbrainz.org/ws/2";
const MUSIC_HEADERS = {
  "User-Agent": "PIXELQuiz/1.0 (localhost)",
};
const MUSIC_DEFAULT_IMAGE = "https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=600&q=80";

function musicUrl(path, params = {}) {
  const url = new URL(`${MUSIC_BASE_URL}${path}`);
  url.searchParams.set("fmt", "json");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

async function fetchMusic(path, params) {
  const url = musicUrl(path, params);
  const response = await fetch(url.href, { headers: MUSIC_HEADERS });
  if (!response.ok) {
    throw new Error(`MusicBrainz request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeRecording(recording = {}) {
  const firstRelease = recording["first-release-date"] || recording.releases?.[0]?.date || "";
  const year = firstRelease.split("-")[0] || "N/A";
  const mainArtist = recording["artist-credit"]?.[0]?.name || recording.artist?.name || "Unknown artist";
  return {
    id: recording.id,
    title: recording.title || "Untitled Song",
    year,
    poster: MUSIC_DEFAULT_IMAGE,
    overview: `Song by ${mainArtist}${year !== "N/A" ? ` released around ${year}` : ""}.`,
    genre: recording.disambiguation || "Song",
    mediaType: "song",
    source: "music",
    subType: "recording",
  };
}

function normalizeArtist(artist = {}) {
  const beginYear = artist["life-span"]?.begin?.split("-")[0] || "N/A";
  return {
    id: artist.id,
    title: artist.name || "Unknown Artist",
    year: beginYear,
    poster: MUSIC_DEFAULT_IMAGE,
    overview: artist.disambiguation || artist.type || "Performer from MusicBrainz.",
    genre: artist.type || "Artist",
    mediaType: "artist",
    source: "music",
    subType: "artist",
  };
}

export async function searchMusic(query, limit = 5) {
  if (!query?.trim()) return [];
  const [recordings, artists] = await Promise.all([
    fetchMusic("/recording/", { query: query.trim(), limit }),
    fetchMusic("/artist/", { query: query.trim(), limit }),
  ]);

  const recordingResults = (recordings.recordings || []).map(normalizeRecording);
  const artistResults = (artists.artists || []).map(normalizeArtist);
  return [...recordingResults, ...artistResults];
}

export async function fetchRecordingById(id) {
  if (!id) throw new Error("Missing MusicBrainz recording id");
  const data = await fetchMusic(`/recording/${id}`, { inc: "artists+releases" });
  return normalizeRecording(data);
}

export async function fetchArtistById(id) {
  if (!id) throw new Error("Missing MusicBrainz artist id");
  const data = await fetchMusic(`/artist/${id}`, { inc: "genres+tags" });
  return normalizeArtist({
    ...data,
    disambiguation: data.disambiguation || data.genres?.[0]?.name || data.tags?.[0]?.name,
  });
}
