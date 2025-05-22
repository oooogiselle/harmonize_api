// routes/me.js
import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import tokenStore from '../utils/tokenStore.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/api/me/spotify', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const tokens = tokenStore.get(userId);
  if (!tokens) return res.status(403).json({ error: 'No Spotify tokens found' });

  const spotifyApi = new SpotifyWebApi({
    clientId:     process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri:  process.env.SPOTIFY_REDIRECT_URI,
  });

  spotifyApi.setAccessToken(tokens.access_token);
  spotifyApi.setRefreshToken(tokens.refresh_token);

  try {
    const [profile, topTracks] = await Promise.all([
      spotifyApi.getMe(),
      spotifyApi.getMyTopTracks({ limit: 10 }),
    ]);

    res.json({
      profile: profile.body,
      top:     topTracks.body.items,
    });
  } catch (err) {
    console.error('Spotify fetch error:', err.body || err.message);
    res.status(500).json({ error: 'Spotify API call failed' });
  }
});

export default router;
