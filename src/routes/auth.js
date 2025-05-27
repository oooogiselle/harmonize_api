import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import SpotifyWebApi from 'spotify-web-api-node';
import { v4 as uuid } from 'uuid';
import User from '../models/User.js';
import tokenStore from '../utils/tokenStore.js';

const router = express.Router();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  FRONTEND_BASE_URL,
} = process.env;

/* ───────── Spotify client builder ───────── */
function buildSpotify() {
  return new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri: SPOTIFY_REDIRECT_URI,
  });
}

/* ───────── STEP 1  /auth/spotify/login ───────── */
router.get('/spotify/login', (req, res) => {
  const state   = crypto.randomBytes(16).toString('hex');
  req.session.spotifyState = state;

  const spotify = buildSpotify();
  const authUrl = spotify.createAuthorizeURL(
    ['user-read-email',
     'user-read-private',
     'user-read-recently-played',
     'user-top-read'],
    state,
    /* show_dialog */ true
  );

  res.redirect(authUrl);
});

/* ───────── STEP 2  /auth/spotify/callback ───────── */
router.get('/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.spotifyState)
    return res.status(400).send('State mismatch');

  delete req.session.spotifyState;

  try {
    const spotify = buildSpotify();
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
    console.error('Spotify callback error:', err.body || err.message);
    res.status(500).send('OAuth failed');
  }
});

/* ───────── Fetch data  /auth/api/me/spotify ───────── */
router.get('/api/me/spotify', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const tokens = tokenStore.get(userId);
  if (!tokens) return res.status(403).json({ error: 'No token' });

  const spotify = buildSpotify();
  spotify.setAccessToken(tokens.access_token);
  spotify.setRefreshToken(tokens.refresh_token);

  try {
    const [profile, top] = await Promise.all([
      spotify.getMe(),
      spotify.getMyTopTracks({ limit: 10 }),
    ]);

    res.json({ profile: profile.body, top: top.body.items });
  } catch (err) {
    console.error(err.body || err.message);
    res.status(500).json({ error: 'Spotify API failed' });
  }
});

/* ───────── Register  /auth/register ───────── */
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password, accountType = 'user' } = req.body;
    if (!name || !username || !password)
      return res.status(400).json({ message: 'Missing fields' });

    const exists = await User.exists({ username });
    if (exists)
      return res.status(409).json({ message: 'Username already taken' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      displayName: name,
      username,
      email,
      password: hash,
      accountType,
    });

    res.status(201).json({ message: 'User registered', userId: user._id });
  } catch (err) {
    console.error('💥 Error in /register:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
