export default function mapTrack(track) {
  if (!track || !track.album || !track.artists) {
    return {
      id: track?.id ?? 'unknown',
      name: track?.name ?? 'Unknown Title',
      artists: ['Unknown Artist'],
      album: 'Unknown Album',
      image: null,
      preview: null,
    };
  }

  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => a.name),
    album: track.album.name,
    image: track.album.images?.[0]?.url || null,
    preview: track.preview_url,
  };
}
