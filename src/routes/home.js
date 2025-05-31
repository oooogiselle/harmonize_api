import express from 'express';
import User from '../models/User.js';
import { getUserSpotifyClient } from '../spotifyClient.js';

const router = express.Router();

/* ───────── helpers ───────── */
const mapTrack = (track) => ({
  id:     track.id,
  name:   track.name,
  artists: track.artists.map((a) => a.name),
  album:   track.album.name,
  image:   track.album.images?.[0]?.url || null,
  preview: track.preview_url,
});

/* ------------------------------------------------------------------ */
/* GET /api/recommendations – personalised mixes                      */
/* ------------------------------------------------------------------ */
router.get('/api/recommendations', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    const spotify = await getUserSpotifyClient(user);

    /* strategy: take the user’s top 5 artists as seeds */
    const top = await spotify.getMyTopArtists({ limit: 5, time_range: 'medium_term' });
    const rec = await spotify.getRecommendations({
      seed_artists: top.body.items.map((a) => a.id),
      limit: 20,
    });

    res.json(rec.body.tracks.map(mapTrack));
  } catch (err) {
    console.error('recommendations error', err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/recent – recently played                                  */
/* ------------------------------------------------------------------ */
router.get('/api/recent', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    const spotify = await getUserSpotifyClient(user);
    const recent  = await spotify.getMyRecentlyPlayedTracks({ limit: 20 });

    res.json(recent.body.items.map((i) => mapTrack(i.track)));
  } catch (err) {
    console.error('recent error', err);
    res.status(500).json({ error: 'Failed to fetch recently-played tracks' });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/friends/activity – live friend feed                       */
/* ------------------------------------------------------------------ */
/* Requirements:                                                      *
 * 1. Add   following: [ObjectId]   to your User schema               *
 * 2. Each friend must have granted the scopes                        *
 *    `user-read-currently-playing user-read-playback-state`          */
/* ------------------------------------------------------------------ */
/* GET /api/friends/activity – placeholder version                    */
/* ------------------------------------------------------------------ */
router.get('/api/friends/activity', async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    if (!me) return res.status(401).json({ error: 'Not logged in' });

    // 🔸 TEMP: no following yet – send a fake user playing a fake song
    const placeholderActivity = [
      {
        userId: 'placeholder-id',
        name: 'Sample Friend',
        track: {
          id:     'fake-track-id',
          name:   'Lo-fi Chill Beats',
          artists: ['Lo-Fi Collective'],
          album:  'Vibes Vol. 3',
          image:  'https://i.scdn.co/image/ab67616d0000b273f3c6e1341c5e89e8a5e9e58e',
          preview: null,
        },
      },
    ];

    res.json(placeholderActivity); // will be replaced later
  } catch (err) {
    console.error('friend activity placeholder error', err);
    res.status(500).json({ error: 'Could not fetch friend activity' });
  }
});

export default router;
