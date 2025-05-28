import express from 'express';
import crypto from 'crypto';
import SpotifyWebApi from 'spotify-web-api-node';
import { v4 as uuid } from 'uuid';
import User from '../models/User.js';
import tokenStore from '../utils/tokenStore.js';
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

/* ───── LOGIN: /auth/login ───── */
router.post('/login', async (req, res) => {
  try {
    console.log('Login request body:', req.body);
    const { usernameOrEmail, password } = req.body;       
    
    if (!usernameOrEmail || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ message: 'Missing credentials' });
    }

    console.log('Looking for user with:', usernameOrEmail);
    const user = await User.findOne({
      $or: [{ username: usernameOrEmail.toLowerCase() }, { email: usernameOrEmail.toLowerCase() }],
    }).select('+password');  
    
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    console.log('User found, checking password');
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('Password mismatch');
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    req.session.userId = user._id;

    const { password: _omit, ...safeUser } = user.toObject();
    console.log('Login successful for user:', safeUser.username);
    res.json(safeUser);
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───── LOGOUT: /auth/logout ───── */
router.post('/logout', (req, res) => {
  req.session = null;
  res.sendStatus(204);
});

/* ───── SPOTIFY LOGIN: /auth/spotify/login ───── */
router.get('/spotify/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.spotifyState = state;

  const spotify = buildSpotify();
  const scopes = ['user-read-private', 'user-read-email', 'user-top-read', 'user-read-recently-played'];
  const authorizeURL = spotify.createAuthorizeURL(scopes, state);

  res.redirect(authorizeURL);
});

/* ───── SPOTIFY CALLBACK: /auth/spotify/callback ───── */
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

/* ───── Rich Spotify Data: /auth/api/me/spotify ───── */
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

/* ───── REGISTER: /auth/register ───── */
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    const { name, username, email, password, accountType = 'user' } = req.body;
    
    if (!name || !username || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check for existing users
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        ...(email ? [{ email: email.toLowerCase() }] : [])
      ]
    });

    if (existingUser) {
      console.log('User already exists');
      return res.status(409).json({ message: 'Username or email already taken' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      displayName: name,
      username: username.toLowerCase(),
      email: email ? email.toLowerCase() : undefined,
      password: hash,
      accountType,
    });

    console.log('User created successfully:', user.username);
    return res.status(201).json({ 
      message: 'User registered successfully', 
      userId: user._id 
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      const dupField = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ message: `${dupField} already in use` });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;