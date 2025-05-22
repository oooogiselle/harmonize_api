import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import tokenStore from '../utils/tokenStore.js';

const router = express.Router();

router.get('/refresh', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const tokens = tokenStore.get(userId);
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
    tokenStore.save(userId, tokens);
    res.json({ access_token: body.access_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'refresh failed' });
  }
});

export default router;
