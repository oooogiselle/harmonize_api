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
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q param' });

  try {
    const api = await getAppSpotify();
    const { body } = await api.searchArtists(q, { limit: 10 });

    const results = body.artists.items.map(a => ({
      id: a.id,
      name: a.name,
      image: a.images?.[0]?.url ?? null,
      genres: a.genres ?? [],
      popularity: a.popularity,
    }));

    res.json(results);
  } catch (err) {
    console.error('Spotify search error', err.body || err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
