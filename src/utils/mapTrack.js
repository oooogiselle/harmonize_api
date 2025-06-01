export default function mapTrack(track) {
  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => a.name),
    album: track.album.name,
    image: track.album.images?.[0]?.url || null,
    preview: track.preview_url,
  };
}
