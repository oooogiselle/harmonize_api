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

/* ───────── user profile ───────── */
router.get('/api/me', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  try {
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Failed to get user info', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/api/me', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { displayName, bio, avatar } = req.body;

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { displayName, bio, avatar },
      { new: true, runValidators: true }
    ).select('-password');
    res.json(updated);
  } catch (err) {
    console.error('Failed to update profile', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ───────── Spotify Profile & Stats ───────── */
router.get('/api/me/spotify', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  try {
    const user = await User.findById(userId);
    if (!user || !user.spotifyAccessToken)
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
      top: topTracks.body.items,
      top_artists: topArtists.body.items,
      recent: recent.body.items,
    });
  } catch (err) {
    console.error('[Spotify API Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Spotify API failed' });
  }
});

/* ───────── Personalized Recommendations ───────── */
router.get('/api/recommendations', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    const spotify = await getUserSpotifyClient(user);

    const top = await spotify.getMyTopArtists({ limit: 5, time_range: 'medium_term' });

    if (top.body.items.length === 0) {
      return res.status(400).json({ error: 'Not enough listening data for recommendations' });
    }

    const rec = await spotify.getRecommendations({
      seed_artists: top.body.items.map((a) => a.id),
      limit: 20,
    });

    res.json(rec.body.tracks.map(mapTrack));
  } catch (err) {
    console.error('recommendations error', err.body || err.message || err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/* ───────── Recently Played ───────── */
router.get('/api/recent', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    const spotify = await getUserSpotifyClient(user);
    const recent = await spotify.getMyRecentlyPlayedTracks({ limit: 20 });

    res.json(recent.body.items.map((i) => mapTrack(i.track)));
  } catch (err) {
    console.error('recent error', err.body || err.message || err);
    res.status(500).json({ error: 'Failed to fetch recently-played tracks' });
  }
});

/* ───────── Friend Feed (placeholder) ───────── */
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
    console.error('friend activity placeholder error', err);
    res.status(500).json({ error: 'Could not fetch friend activity' });
  }
});

export default router;
