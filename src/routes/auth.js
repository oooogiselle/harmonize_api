import express from 'express';
import crypto from 'crypto';
import SpotifyWebApi from 'spotify-web-api-node';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
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

/* ───── LOGIN ───── */
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password)
      return res.status(400).json({ message: 'Missing credentials' });

    const user = await User.findOne({
      $or: [
        { username: usernameOrEmail.toLowerCase() },
        { email: usernameOrEmail.toLowerCase() },
      ],
    }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    req.session.userId = user._id;
    const { password: _pw, ...safeUser } = user.toObject();
    res.json(safeUser);
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───── LOGOUT ───── */
router.post('/logout', (req, res) => {
  req.session = null;
  res.sendStatus(204);
});

/* ───── REGISTER ───── */
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password, accountType = 'user' } = req.body;
    if (!name || !username || !password)
      return res.status(400).json({ message: 'Missing required fields' });

    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        ...(email ? [{ email: email.toLowerCase() }] : []),
      ],
    });

    if (existingUser)
      return res.status(409).json({ message: 'Username or email already taken' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      displayName: name,
      username: username.toLowerCase(),
      email: email?.toLowerCase(),
      password: hash,
      accountType,
    });

    res.status(201).json({ message: 'User registered', userId: user._id });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ message: `${field} already in use` });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───── SPOTIFY LOGIN ───── */
router.get('/spotify/login', (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.spotifyState = state;

    const spotify = buildSpotify();
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-top-read',
      'user-read-recently-played',
      'user-read-playback-state',
      'user-modify-playback-state',
    ];

    const url = spotify.createAuthorizeURL(scopes, state);
    res.redirect(url);
  } catch (err) {
    console.error('Spotify login error:', err);
    res.status(500).json({ error: 'Spotify login failed' });
  }
});

/* ───── SPOTIFY CALLBACK ───── */
router.get('/spotify/callback', async (req, res) => {
  const code = req.query.code;
  const api = buildSpotify();

  try {
    const { body } = await api.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = body;

    api.setAccessToken(access_token);
    api.setRefreshToken(refresh_token);

    const me = await api.getMe();
    const profile = me.body;

    let user = await User.findOne({ spotifyId: profile.id });

    if (!user) {
      user = await User.findOne({ email: profile.email });
      if (user) user.spotifyId = profile.id;
    }

    if (!user) {
      user = new User({
        spotifyId: profile.id,
        displayName: profile.display_name || 'Spotify User',
        email: profile.email,
        username: profile.id,
        accountType: 'user',
      });
    }

    user.spotifyAccessToken = access_token;
    user.spotifyRefreshToken = refresh_token;
    user.spotifyTokenExpiresAt = new Date(Date.now() + expires_in * 1000);
    await user.save();

    req.session.userId = user._id;
    res.redirect(`${FRONTEND_BASE_URL}/profile`);
  } catch (err) {
    console.error('[Spotify Callback Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Spotify authorization failed' });
  }
});

/* ───── USER SPOTIFY DATA ───── */
router.get('/api/me/spotify', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const user = await User.findById(userId);
  if (!user || !user.spotifyAccessToken)
    return res.status(403).json({ error: 'Spotify not connected' });

  const spotify = buildSpotify();
  spotify.setAccessToken(user.spotifyAccessToken);
  spotify.setRefreshToken(user.spotifyRefreshToken);

  try {
    const [profile, topTracks, topArtists, recent] = await Promise.all([
      spotify.getMe(),
      spotify.getMyTopTracks({ limit: 10 }),
      spotify.getMyTopArtists({ limit: 10 }),
      spotify.getMyRecentlyPlayedTracks({ limit: 10 }),
    ]);

    res.json({
      profile: profile.body,
      top: topTracks.body.items,
      top_artists: topArtists.body.items,
      recent: recent.body.items,
    });
  } catch (err) {
    console.error('[Spotify API Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Spotify API failed' });
  }
});

export default router;
