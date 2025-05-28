import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import { v4 as uuid } from 'uuid';
import tokenStore from '../utils/tokenStore.js';
import User from '../models/User.js';
import bcrypt from 'bcrypt';

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

/* ───── STEP 1: /spotify/login ───── */
router.get('/spotify/login', (req, res) => {
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

/* ───────── Register  /auth/register ───────── */
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password, accountType = 'user' } = req.body;
    if (!name || !username || !password)
      return res.status(400).json({ message: 'Missing fields' });

    // ── pre‑flight uniqueness check ──
    const taken = await User.exists({ $or: [ { username }, { email } ] });
    if (taken)
      return res.status(409).json({ message: 'Username or e‑mail already taken' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      displayName : name,
      username    : username.toLowerCase(),
      email       : email?.toLowerCase(),
      password    : hash,
      accountType,
      spotifyId   : null, 
    });

    return res.status(201).json({ message: 'User registered', userId: user._id });
  } catch (err) {
    if (err.code === 11000) {
      const dupField = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ message: `${dupField} already in use` });
    }
    console.error('💥 /register failed:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
