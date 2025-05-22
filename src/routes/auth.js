//  ── deps:  npm i spotify-web-api-node uuid cookie-session dotenv
import express        from 'express';
import SpotifyWebApi  from 'spotify-web-api-node';
import { v4 as uuid } from 'uuid';
import dotenv         from 'dotenv';

import User       from '../models/User.js';
import tokenStore from '../utils/tokenStore.js';

dotenv.config();
const router = express.Router();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  FRONTEND_BASE_URL = 'http://localhost:5173',
} = process.env;

function buildSpotify() {
  return new SpotifyWebApi({
    clientId:     SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri:  SPOTIFY_REDIRECT_URI,
  });
}

// ─────────────  login (step 1) ─────────────
router.get('/login', (_req, res) => {
  const spotifyApi  = buildSpotify();
  const state       = uuid();
  const authorizeURL = spotifyApi.createAuthorizeURL(
    [
      'user-read-email',
      'user-read-private',
      'user-read-recently-played',
      'user-top-read',
    ],
    state,
  );

  _req.session.spotifyState = state;
  res.redirect(authorizeURL);
});

// ─────────────  Spotify callback (step 2) ─────────────
router.get('/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.spotifyState)
    return res.status(400).send('State mismatch');

  const spotifyApi = buildSpotify();

  try {
    const { body } = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = body;

    spotifyApi.setAccessToken(access_token);
    const { body: me } = await spotifyApi.getMe();

    const user = await User.findOneAndUpdate(
      { spotifyId: me.id },
      {
        spotifyId:    me.id,
        username:     me.display_name,
        displayName:  me.display_name,
        photo:        me.images?.[0]?.url ?? '',
        email:        me.email,
        country:      me.country,
      },
      { upsert: true, new: true },
    );

    tokenStore.save(user._id.toString(), {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    });

    req.session.userId = user._id;
    res.redirect(`${FRONTEND_BASE_URL}/dashboard`);
  } catch (e) {
    console.error('Spotify callback error:', e.body || e.message || e);
    res.status(500).send('Spotify authorization failed');
  }
});

export default router;
