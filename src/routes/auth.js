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
      'user-modify-playback-state'
    ];
    
    const authorizeURL = spotify.createAuthorizeURL(scopes, state);
    console.log('Redirecting to Spotify auth URL:', authorizeURL);
    
    res.redirect(authorizeURL);
  } catch (err) {
    console.error('Spotify login error:', err);
    res.status(500).json({ error: 'Failed to initiate Spotify login' });
  }
});

router.get('/spotify/callback', async (req, res) => {
  const code = req.query.code;

  const api = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  });

  try {
    console.log('[Callback] Received code:', code);

    const { body } = await api.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = body;

    api.setAccessToken(access_token);
    api.setRefreshToken(refresh_token);

    const me = await api.getMe();
    console.log('[Callback] Spotify profile:', me.body);

    // 🧠 Step 1: Check if user exists by Spotify ID
    let user = await User.findOne({ spotifyId: me.body.id });

    // 🔍 Step 2: If not found, try matching by email
    if (!user) {
      user = await User.findOne({ email: me.body.email });
      if (user) {
        console.log('[Callback] Matched user by email:', user._id);
        user.spotifyId = me.body.id;
      }
    }

    // 🆕 Step 3: Create if still no match
    if (!user) {
      user = await User.create({
        spotifyId: me.body.id,
        displayName: me.body.display_name || 'Spotify User',
        email: me.body.email,
        username: me.body.id, // fallback
        accountType: 'user',
      });
      console.log('[Callback] Created new user:', user._id);
    }

    // 💾 Step 4: Save tokens and session
    user.spotifyAccessToken = access_token;
    user.spotifyRefreshToken = refresh_token;
    user.spotifyTokenExpiresAt = new Date(Date.now() + expires_in * 1000);
    await user.save();

    req.session.userId = user._id;
    console.log('[Callback] Session userId set:', user._id);

    res.redirect(`${process.env.FRONTEND_BASE_URL}/profile`);
  } catch (err) {
    console.error('[Callback] Spotify authorization failed:', err.body || err.message || err);
    res.status(500).json({ error: 'Spotify authorization failed' });
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