import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import { getAccessToken, spotifyApi } from '../spotifyClient.js';

const router = express.Router();

/* ─────────── /spotify/search?q=&type= ─────────── */
router.get('/search', async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q || !type) return res.status(400).json({ error: 'Missing q or type' });

    // Use app credentials flow
    const token = await getAccessToken();
    spotifyApi.setAccessToken(token);

    const result = await spotifyApi.search(q, [type]);

    // Standardize shape for frontend
    res.json({ artists: result.body.artists });
  } catch (err) {
    console.error('Spotify search failed:', err);
    res.status(500).json({ error: 'Failed to search Spotify' });
  }
});

export default router;
