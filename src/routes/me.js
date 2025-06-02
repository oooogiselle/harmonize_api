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

    /* 1️⃣  Try top artists */
    let seedArtists = [];
    try {
      const topA = await spotify.getMyTopArtists({ limit: 5, time_range: 'medium_term' });
      seedArtists = topA.body.items.map(a => a.id);
    } catch (e) {
      console.warn('[Spotify] getMyTopArtists failed:', e.statusCode, e.message);
      if (e.statusCode === 401 || e.statusCode === 403)
        return res.status(403).json({ error: 'Spotify authorisation failed' });
    }

    /* 2️⃣  Fallback → top tracks */
    if (seedArtists.length === 0) {
      try {
        const topT = await spotify.getMyTopTracks({ limit: 5, time_range: 'medium_term' });
        seedArtists = [
          ...new Set(topT.body.items.flatMap(t => t.artists.map(a => a.id)))
        ].slice(0, 5);
      } catch (e) {
        console.warn('[Spotify] getMyTopTracks failed:', e.statusCode, e.message);
      }
    }

    if (seedArtists.length === 0) return res.status(204).json([]); // nothing to seed

    /* 3️⃣  Fetch recs */
    let rec;
    try {
      rec = await spotify.getRecommendations({ seed_artists: seedArtists, limit: 20 });
    } catch (e) {
      console.error('[Spotify] getRecommendations failed:', e.statusCode, e.message);
      return res.status(204).json([]); // Spotify sometimes 400s if it can’t create recs
    }

    return res.json(rec.body.tracks.map(mapTrack));
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
