import express from 'express';
import User from '../models/User.js';

const router = express.Router();

/* You can keep other routes like: */
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

// PATCH /api/me – update logged-in user
router.patch('/api/me', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  // whitelist the fields we allow people to change themselves
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

/* ───── USER SPOTIFY DATA ───── */
router.get('/api/me/spotify', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const user = await User.findById(userId);
  if (!user || !user.spotifyAccessToken)
    return res.status(403).json({ error: 'Spotify not connected' });

  const spotify = buildSpotify();
  spotify.setAccessToken(user.spotifyAccessToken);
  spotify.setRefreshToken(user.spotifyRefreshToken);

  try {
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

export default router;
