
import express       from 'express';
import querystring   from 'querystring';
import crypto        from 'crypto';
import axios         from 'axios';
import dotenv        from 'dotenv';

dotenv.config();
const router = express.Router();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  FRONTEND_BASE_URL = 'http://localhost:5173',
} = process.env;

/* scopes needed for your app */
const scope = [
  'user-read-email',
  'user-read-private',
  'user-read-recently-played',
  'user-top-read',
].join(' ');

// ───────────── STEP 1 – send user to Spotify ─────────────
router.get('/auth', (_req, res) => {
  const state = crypto.randomUUID();

  const params = querystring.stringify({
    response_type: 'code',
    client_id:     SPOTIFY_CLIENT_ID,
    scope,
    redirect_uri:  SPOTIFY_REDIRECT_URI,
    state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// ───────────── STEP 2 – Spotify callback ─────────────
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  SPOTIFY_REDIRECT_URI,
        client_id:     SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    // (Optional) persist the tokens in session / DB here
    req.session.access_token  = data.access_token;
    req.session.refresh_token = data.refresh_token;

    // ↩ back to the front‑end
    res.redirect(`${FRONTEND_BASE_URL}/dashboard`);
  } catch (err) {
    console.error('Spotify token exchange failed', err.response?.data || err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ───────────── Helper to refresh a token ─────────────
router.get('/refresh', async (req, res) => {
  try {
    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type:    'refresh_token',
        refresh_token: req.session.refresh_token,
        client_id:     SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    req.session.access_token = data.access_token;
    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('Failed to refresh token', err.response?.data || err);
    res.status(500).json({ error: 'Could not refresh token' });
  }
});

export default router;
