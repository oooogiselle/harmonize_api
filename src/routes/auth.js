import crypto      from 'crypto';
import qs          from 'querystring';
import axios       from 'axios';
import express     from 'express';

const router = express.Router();

// ── 1.  LOGIN:  redirect user to Spotify ───────────────
router.get('/spotify/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');  // (a) generate once
  req.session.oauthState = state;                        // (b) remember

  const scope = [
    'user-read-email',
    'user-top-read',
  ].join(' ');

  const params = qs.stringify({
    response_type : 'code',
    client_id     : process.env.SPOTIFY_CLIENT_ID,
    redirect_uri  : process.env.SPOTIFY_REDIRECT_URI,
    scope,
    state,                                             // (c) **same value**
    show_dialog    : true,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// ── 2.  CALLBACK:  verify state, exchange code ────────
router.get('/spotify/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('State mismatch');
  }
  delete req.session.oauthState;                        // (d) one‑time use

  try {
    const token = await axios.post(
      'https://accounts.spotify.com/api/token',
      qs.stringify({
        grant_type   : 'authorization_code',
        code,
        redirect_uri : process.env.SPOTIFY_REDIRECT_URI,
        client_id    : process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Success – store tokens on the user or in session, then redirect
    req.session.spotify = token.data;                   // access_token, etc.
    res.redirect(process.env.FRONTEND_URL + '/dashboard');
  } catch (err) {
    console.error('Spotify token exchange failed:', err.response?.data || err);
    res.status(500).send('Spotify auth failed');
  }
});

export default router;
