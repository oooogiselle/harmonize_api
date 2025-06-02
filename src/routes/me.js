import express from 'express';
import User from '../models/User.js';
import { getUserSpotifyClient } from '../spotifyClient.js';
import mapTrack from '../utils/mapTrack.js';

const router = express.Router();

/* ───────── GET /api/me/spotify – Profile, Top Songs, Top Artists, Recently Played ───────── */
router.get('/api/me/spotify', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);

    const [profile, topTracks, topArtists, recent] = await Promise.all([
      spotify.getMe(),
      spotify.getMyTopTracks({ limit: 10 }),
      spotify.getMyTopArtists({ limit: 10 }),
      spotify.getMyRecentlyPlayedTracks({ limit: 10 }),
    ]);

    res.json({
      profile: profile.body,
      top: topTracks.body.items?.map(mapTrack) ?? [],
      top_artists: topArtists.body.items?.map((artist) => ({
        id: artist.id,
        name: artist.name,
        image: artist.images?.[0]?.url ?? null,
        genres: artist.genres ?? [],
      })) ?? [],
      recent: recent.body.items?.map((item) => mapTrack(item.track)) ?? [],
    });
  } catch (err) {
    console.error('[Spotify API Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Spotify API failed' });
  }
});

/* ───────── GET /api/recommendations – Personalized mixes ───────── */
router.get('/api/recommendations', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);
    if (!spotify) return res.status(403).json({ error: 'Spotify authorisation failed' });

    /* ---------- 1. Build seeds ---------- */
    let seedArtists = [];
    let seedTracks  = [];

    try {
      const topA = await spotify.getMyTopArtists({ limit: 5, time_range: 'medium_term' });
      seedArtists = topA.body.items.map((a) => a.id);
    } catch (e) {
      console.warn('[Spotify] top-artists failed:', e.statusCode, e.message);
    }

    try {
      const topT = await spotify.getMyTopTracks({ limit: 10, time_range: 'medium_term' });
      seedTracks = topT.body.items.map((t) => t.id);
    } catch (e) {
      console.warn('[Spotify] top-tracks failed:', e.statusCode, e.message);
    }

    if (seedArtists.length === 0 && seedTracks.length === 0)
      return res.status(204).json([]); // nothing to seed yet

    /* ---------- 2. First attempt: artist IDs ---------- */
    const paramsA = {
      seed_artists: seedArtists.slice(0, 5), // Spotify allows max 5 total seeds
      limit: 20,
    };

    try {
      const recA = await spotify.getRecommendations(paramsA);
      return res.json(recA.body.tracks.map(mapTrack));
    } catch (e) {
      /* 404 here means the artist IDs don't work for recommendations */
      console.warn('[Spotify] recs with artists failed:', e.statusCode, e.message);
    }

    /* ---------- 3. Second attempt: mix of artist + track IDs ---------- */
    const paramsB = {
      seed_artists: seedArtists.slice(0, 3),        // keep ≤3
      seed_tracks:  seedTracks.slice(0, 5),         // fill the rest
      limit: 20,
    };

    try {
      const recB = await spotify.getRecommendations(paramsB);
      return res.json(recB.body.tracks.map(mapTrack));
    } catch (e) {
      console.error('[Spotify] recs with tracks failed:', e.statusCode, e.message);
      return res.status(204).json([]);              // still no luck—tell client “none yet”
    }
  } catch (err) {
    console.error('[Recommendations Route Error]', err);
    return res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});




/* ───────── GET /api/recent – Recently played tracks ───────── */
router.get('/api/recent', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);
    const recent = await spotify.getMyRecentlyPlayedTracks({ limit: 20 });

    res.json(recent.body.items?.map((item) => mapTrack(item.track)) ?? []);
  } catch (err) {
    console.error('[Recently Played Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Failed to fetch recently-played tracks' });
  }
});

/* ───────── GET /api/friends/activity – Placeholder version ───────── */
router.get('/api/friends/activity', async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    if (!me) return res.status(401).json({ error: 'Not logged in' });

    const placeholderActivity = [
      {
        userId: 'placeholder-id',
        name: 'Sample Friend',
        track: {
          id: 'fake-track-id',
          name: 'Lo-fi Chill Beats',
          artists: ['Lo-Fi Collective'],
          album: 'Vibes Vol. 3',
          image: 'https://i.scdn.co/image/ab67616d0000b273f3c6e1341c5e89e8a5e9e58e',
          preview: null,
        },
      },
    ];

    res.json(placeholderActivity);
  } catch (err) {
    console.error('[Friend Activity Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Could not fetch friend activity' });
  }
});

export default router;
