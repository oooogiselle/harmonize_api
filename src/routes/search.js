// used for searching a Spotify track when creating a music post
import express from 'express';
import fetch from 'node-fetch';
import { getSpotifyAccessToken } from '../utils/spotifyToken.js';

const router = express.Router();

router.get('/spotify', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const token = await getSpotifyAccessToken();

    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await searchRes.json();

    const tracks = (data.tracks.items || []).map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      cover: track.album.images[0]?.url,
      preview_url: track.preview_url,
      duration_ms: track.duration_ms,
    }));

    res.json({ tracks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Spotify search failed' });
  }
});

export default router;