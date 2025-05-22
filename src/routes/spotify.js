import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import { v4 as uuid } from 'uuid';
import User from '../models/User.js';
import tokenStore from '../utils/tokenStore.js';

const router = express.Router();

function getSpotifyClient() {
  return new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });
}

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
];

// 🔐 Spotify Login
router.get('/spotify/login', (req, res) => {
  const spotifyApi = getSpotifyClient();

  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://project-music-and-memories-api.onrender.com/auth/spotify/callback'
    : 'http://127.0.0.1:8080/auth/spotify/callback';

  spotifyApi.setRedirectURI(redirectUri);

  const state = uuid();
  req.session.spotifyState = state;

  const authorizeURL = spotifyApi.createAuthorizeURL(SCOPES, state);
  res.redirect(authorizeURL);
});

// 🎧 Spotify Callback
router.get('/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.spotifyState) {
    return res.status(400).send('State mismatch');
  }

  const spotifyApi = getSpotifyClient();

  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://project-music-and-memories-api.onrender.com/auth/spotify/callback'
    : 'http://127.0.0.1:8080/auth/spotify/callback';

  spotifyApi.setRedirectURI(redirectUri);

  try {
    const { body } = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = body;

    spotifyApi.setAccessToken(access_token);
    const me = await spotifyApi.getMe();

    const user = await User.findOneAndUpdate(
      { spotifyId: me.body.id },
      {
        spotifyId: me.body.id,
        username: me.body.display_name,
        displayName: me.body.display_name,
        photo: me.body.images?.[0]?.url ?? '',
        email: me.body.email,
        country: me.body.country,
      },
      { upsert: true, new: true }
    );

    tokenStore.save(user._id.toString(), {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    });

    req.session.userId = user._id;

    const frontendRedirect = process.env.NODE_ENV === 'production'
      ? 'https://project-music-and-memories.onrender.com'
      : 'http://127.0.0.1:5173';

    res.redirect(frontendRedirect);
  } catch (e) {
    console.error("Spotify callback error:", e.body || e.message || e);
    res.status(500).send("Spotify authorization failed");
  }
});


// 🔍 Existing routes below this point

// Search artists by name
router.get('/artists/search', async (req, res) => {
  const { q } = req.query;
  const spotifyApi = getSpotifyClient();
  const data = await spotifyApi.searchArtists(q);
  res.json(data.body.artists.items);
});

// Get Spotify artist info by ID
router.get('/artists/spotify/:id', async (req, res) => {
  const spotifyApi = getSpotifyClient();
  const data = await spotifyApi.getArtist(req.params.id);
  res.json(data.body);
});

// Follow a custom artist (placeholder route)
router.post('/artists/:id/follow', async (req, res) => {
  const artistId = req.params.id;
  res.json({ message: `Following artist ${artistId}` });
});

export default router;
