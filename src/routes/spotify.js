import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import { getAccessToken, spotifyApi } from '../spotifyClient.js';

const router = express.Router();

/* ─────────── /spotify/search?q=&type= ─────────── */
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'artist' } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing search query' });

    const token = await getAccessToken();
    spotifyApi.setAccessToken(token);

    const result = await spotifyApi.search(q, [type]);

    if (type === 'artist') {
      const artists = result.body.artists.items.map(artist => ({
        id: artist.id,
        name: artist.name,
        images: artist.images, // Make sure to include the full images array
        image: artist.images?.[0]?.url || null,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers?.total
      }));
      return res.json(artists);
    }

    if (type === 'track') {
      const tracks = result.body.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => ({ id: a.id, name: a.name })),
        album: {
          id: track.album.id,
          name: track.album.name,
          images: track.album.images, // Make sure to include the full images array
          image: track.album.images?.[0]?.url || null
        },
        preview_url: track.preview_url,
        popularity: track.popularity
      }));
      return res.json({ tracks });
    }

    res.status(400).json({ error: 'Unsupported search type' });
  } catch (err) {
    console.error('Spotify search failed:', err);
    res.status(500).json({ error: 'Failed to search Spotify' });
  }
});

export default router;