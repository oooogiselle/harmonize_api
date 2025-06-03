import express from 'express';
import { getUserSpotifyClient } from '../spotifyClient.js';
const router = express.Router();

router.get('/api/genre-stats', async (req, res) => {
  try {
    // 🔧 FIXED: pull user ID from session
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const spotify = await getUserSpotifyClient({ id: userId });

    // 1) collect top artists across 3 windows
    const ranges = ['short_term', 'medium_term', 'long_term'];
    const artists = [];
    for (const r of ranges) {
      const top = await spotify.getMyTopArtists({ limit: 50, time_range: r });
      artists.push(...top.body.items);
    }

    // 2) frequency table
    const counts = {};
    artists.forEach(a =>
      a.genres.forEach(g => (counts[g] = (counts[g] || 0) + 1))
    );

    // 3) canonical seed list
    const seeds = await spotify.getAvailableGenreSeeds();
    const seedGenres = seeds.body.genres;

    // 4) partition
    const listened   = Object.keys(counts);
    const unlistened = seedGenres.filter(g => !listened.includes(g));

    // ✅ return JSON (make sure frontend gets content-type: application/json)
    res.json({
      listened:  listened.sort((a, b) => counts[b] - counts[a]),
      histogram: counts,
      unlistened,
      coverage:  (listened.length / seedGenres.length).toFixed(2)
    });

  } catch (e) {
    console.error('[genre-stats]', e);
    res.status(500).json({ error: 'Failed to build genre stats' });
  }
});

export default router;
