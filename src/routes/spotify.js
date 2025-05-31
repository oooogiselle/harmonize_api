import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import tokenStore from '../utils/tokenStore.js';
import { getAccessToken, spotifyApi } from '../spotifyClient.js';

const router = express.Router();

router.get('/refresh', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const user = await User.findById(userId);
  if (!user || !user.spotifyRefreshToken) {
    return res.status(403).json({ error: 'No token' });
  }
    if (!tokens) return res.status(403).json({ error: 'No token' });

  const api = new SpotifyWebApi({
    clientId:     process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  api.setRefreshToken(tokens.refresh_token);
  try {
    const { body } = await api.refreshAccessToken();
    tokens.access_token  = body.access_token;
    tokens.expires_at    = Date.now() + body.expires_in * 1000;
    user.spotifyAccessToken = body.access_token;
    user.spotifyTokenExpiresAt = new Date(Date.now() + body.expires_in * 1000);
    await user.save();

    res.json({ access_token: body.access_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'refresh failed' });
  }
});

async function getAppSpotify() {
  const api = new SpotifyWebApi({
    clientId:     process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });
  const { body } = await api.clientCredentialsGrant();
  api.setAccessToken(body.access_token);
  return api;
}

/* ------------- NEW: /spotify/search?q=artist name ------------- */
router.get('/search', async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q || !type) return res.status(400).json({ error: 'Missing q or type' });

    // Refresh token
    const token = await getAccessToken();
    spotifyApi.setAccessToken(token);

    // Call Spotify API
    const result = await spotifyApi.search(q, [type]);

    // Wrap response so frontend can access `.artists.items`
    res.json({ artists: result.body.artists });
  } catch (err) {
    console.error('Spotify search failed:', err);
    res.status(500).json({ error: 'Failed to search Spotify' });
  }
});

export default router;
