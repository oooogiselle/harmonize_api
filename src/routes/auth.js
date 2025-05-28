import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import { v4 as uuid } from 'uuid';
import tokenStore from '../utils/tokenStore.js';
import User from '../models/User.js';

const router = express.Router();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  FRONTEND_BASE_URL,
} = process.env;

function buildSpotify() {
  return new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri: SPOTIFY_REDIRECT_URI,
  });
}

/* ───── STEP 1: /login ───── */
router.get('/login', (req, res) => {
  const spotify = buildSpotify();
  const state = uuid();
  req.session.spotifyState = state;

  const url = spotify.createAuthorizeURL(
    [
      'user-read-email',
      'user-read-private',
      'user-read-recently-played',
      'user-top-read',
    ],
    state,
  );
  res.redirect(url);
});

/* ───── STEP 2: /spotify/callback ───── */
router.get('/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.spotifyState)
    return res.status(400).send('State mismatch');

  const spotify = buildSpotify();

  try {
    const { body } = await spotify.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = body;

    spotify.setAccessToken(access_token);
    const { body: me } = await spotify.getMe();

    tokenStore.save(me.id, {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    });

    req.session.userId = me.id;
    res.redirect(`${FRONTEND_BASE_URL}/dashboard`);
  } catch (err) {
    console.error('callback error', err.body || err.message);
    res.status(500).send('OAuth failed');
  }
});

/* ───── Rich Spotify Data: /api/me/spotify ───── */
router.get('/api/me/spotify', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const tokens = tokenStore.get(userId);
  if (!tokens) return res.status(403).json({ error: 'No token' });

  const spotify = buildSpotify();
  spotify.setAccessToken(tokens.access_token);
  spotify.setRefreshToken(tokens.refresh_token);

  try {
    const [profile, topTracks, topArtists, recentlyPlayed] = await Promise.all([
      spotify.getMe(),
      spotify.getMyTopTracks({ limit: 10 }),
      spotify.getMyTopArtists({ limit: 10 }),
      spotify.getMyRecentlyPlayedTracks({ limit: 10 }),
    ]);

    res.json({
      profile: profile.body,
      top: topTracks.body.items,
      top_artists: topArtists.body.items,
      recent: recentlyPlayed.body.items,
    });
  } catch (err) {
    console.error('Spotify API failed:', err.body || err.message);
    res.status(500).json({ error: 'Spotify API failed' });
  }
});

/* ───── Register: POST /auth/register ───── */
router.post('/auth/register', async (req, res) => {
  const { username, email, password, accountType } = req.body;

  if (!username || !email || !password || !accountType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const newUser = await User.create({
      username,
      email,
      password,
      role: accountType,
    });
    res.status(201).json({ message: 'User registered', user: newUser });
  } catch (err) {
    console.error('Registration failed:', err);
    res.status(400).json({ error: 'Registration failed', details: err });
  }
});

export default router;
