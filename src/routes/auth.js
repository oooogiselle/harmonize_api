import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import { v4 as uuid } from 'uuid';
import tokenStore from '../utils/tokenStore.js';

const router = express.Router();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  FRONTEND_BASE_URL,
} = process.env;

/* helper to build a Spotify API client */
function buildSpotify() {
  return new SpotifyWebApi({
    clientId:     SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri:  SPOTIFY_REDIRECT_URI,
  });
}

/* ───────── STEP 1  /login ───────── */
router.get('/login', (req, res) => {
  const spotify   = buildSpotify();
  const state     = uuid();
  req.session.spotifyState = state;           // <‑‑ save in cookie

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

/* ───────── STEP 2  /spotify/callback ───────── */
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

    // save tokens in memory (for demo) keyed by spotify id
    tokenStore.save(me.id, {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    });

    req.session.userId = me.id;      // <-- save who is logged‑in
    res.redirect(`${FRONTEND_BASE_URL}/dashboard`);
  } catch (err) {
    console.error('callback error', err.body || err.message);
    res.status(500).send('OAuth failed');
  }
});

/* ───────── Dashboard data  /api/me/spotify ───────── */
router.get('/api/me/spotify', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const tokens = tokenStore.get(userId);
  if (!tokens)  return res.status(403).json({ error: 'No token' });

  const spotify = buildSpotify();
  spotify.setAccessToken(tokens.access_token);
  spotify.setRefreshToken(tokens.refresh_token);

  try {
    const [ profile, top ] = await Promise.all([
      spotify.getMe(),
      spotify.getMyTopTracks({ limit: 10 }),
    ]);

    res.json({ profile: profile.body, top: top.body.items });
  } catch (err) {
    console.error(err.body || err.message);
    res.status(500).json({ error: 'Spotify API failed' });
  }
});

// routes/auth.js

router.post('/register', async (req, res) => {
  try {
    const { name, username, password, accountType = 'user' } = req.body;
    if (!name || !username || !password) {
      console.error('Missing fields:', req.body);
      return res.status(400).json({ message: 'Missing fields' });
    }

    const exists = await User.exists({ username });
    if (exists) {
      console.warn('Username already taken:', username);
      return res.status(409).json({ message: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      username,
      password: passwordHash,
      accountType,
    });

    res.status(201).json({ message: 'User registered', userId: user._id });
  } catch (err) {
    console.error('Error in /register:', err); // 🛑 LOG THIS
    res.status(500).json({ message: 'Internal server error' });
  }
});


export default router;
