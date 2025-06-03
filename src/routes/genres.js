import express from 'express';
import User from '../models/User.js';            // 🔹 NEW
import { getUserSpotifyClient } from '../spotifyClient.js';

const router = express.Router();

router.get('/api/genre-stats', async (req, res) => {
  try {
    /* ── 1.  Authenticate ───────────────────────────────────────────── */
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = await User.findById(userId);    // 🔹 NEW (full doc)
    if (!user)  return res.status(401).json({ error: 'User not found' });

    const spotify = await getUserSpotifyClient(user); // pass full user

    /* ── 2.  Collect top-artist genres across 3 time windows ─────────── */
    const ranges   = ['short_term', 'medium_term', 'long_term'];
    const artists  = [];
    for (const r of ranges) {
      const top = await spotify.getMyTopArtists({ limit: 50, time_range: r });
      artists.push(...top.body.items);
    }

    /* ── 3.  Build frequency table ───────────────────────────────────── */
    const counts = {};
    artists.forEach(a =>
      a.genres.forEach(g => (counts[g] = (counts[g] || 0) + 1))
    );

    /* ── 4.  Compare with Spotify’s seed-genre list ──────────────────── */
    const seeds       = await spotify.getAvailableGenreSeeds();
    const seedGenres  = seeds.body.genres;

    const listened    = Object.keys(counts);
    const unlistened  = seedGenres.filter(g => !listened.includes(g));

    /* ── 5.  Return JSON ─────────────────────────────────────────────── */
    res.json({
      listened:  listened.sort((a, b) => counts[b] - counts[a]),
      histogram: counts,
      unlistened,
      coverage:  (listened.length / seedGenres.length).toFixed(2),
    });

  } catch (e) {
    console.error('[genre-stats]', e);
    res.status(500).json({ error: 'Failed to build genre stats' });
  }
});

export default router;
