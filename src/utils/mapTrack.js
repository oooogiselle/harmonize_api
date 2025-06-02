// server/utils/mapTrack.js
export default function mapTrack(track = {}) {
  const image =
    track.album?.images?.[0]?.url || // Spotify structure
    track.image ||                   // already normalized
    track.cover ||                   // custom uploads
    null;                            // fallback

  return {
    id:      track.id ?? crypto.randomUUID(),
    name:    track.name ?? 'Unknown Title',
    artists: track.artists ?? [],
    album:   track.album ?? {},
    image,
    preview: track.preview_url ?? track.preview ?? null,
  };
}
