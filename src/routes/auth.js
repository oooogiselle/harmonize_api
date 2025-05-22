//  ── deps:  npm i spotify-web-api-node uuid cookie-session dotenv
import express from "express";
import SpotifyWebApi from "spotify-web-api-node";
import { v4 as uuid } from "uuid";
import User from "../models/User.js";
import tokenStore from "../utils/tokenStore.js";

const router = express.Router();

function buildSpotify() {
  return new SpotifyWebApi({
    clientId:     process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri:  process.env.SPOTIFY_REDIRECT_URI,
  });
}

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
];

/* ── 1. /auth/spotify/login  →  redirect to Spotify ─────────────────────── */
router.get("/spotify/login", (req, res) => {
  const spotifyApi = buildSpotify(); // <- defined above with redirectUri

  const state = uuid();
  req.session.spotifyState = state;

  const authorizeURL = spotifyApi.createAuthorizeURL(SCOPES, state);
  console.log("🔗 Redirecting to Spotify:", authorizeURL); // <-- ADD THIS

  res.redirect(authorizeURL);
});

router.get("/spotify/callback", async (req, res, next) => {
  const { code, state } = req.query;
  if (state !== req.session.spotifyState) return res.status(400).send("State mismatch");

  const spotifyApi = buildSpotify();

  try {
    const { body } = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = body;

    spotifyApi.setAccessToken(access_token);
    const me = await spotifyApi.getMe();

    const user = await User.findOneAndUpdate(
      { spotifyId: me.body.id },
      {
        spotifyId:   me.body.id,
        username:    me.body.display_name,
        displayName: me.body.display_name,
        photo:       me.body.images?.[0]?.url ?? "",
        email:       me.body.email,
        country:     me.body.country,
      },
      { upsert: true, new: true }
    );

    tokenStore.save(user._id.toString(), {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    });

    req.session.userId = user._id;
    res.redirect('http://127.0.0.1:5173/');
  } catch (e) {
    console.error("Spotify callback error:", e.body || e.message || e);
    res.status(500).send("Spotify authorization failed");
  }
});



router.get("/me/spotify", async (req, res) => {
  const uid = req.session.userId;
  if (!uid) return res.status(401).json({ error: "Not signed in" });

  const tokens = tokenStore.get(uid);
  if (!tokens) return res.status(401).json({ error: "No token" });

  const spotifyApi = buildSpotify();
  spotifyApi.setAccessToken(tokens.access_token);
  spotifyApi.setRefreshToken(tokens.refresh_token);

  /* refresh automatically if needed */
  if (Date.now() >= tokens.expires_at) {
    const { body } = await spotifyApi.refreshAccessToken();
    tokens.access_token = body.access_token;
    tokens.expires_at   = Date.now() + body.expires_in * 1000;
    tokenStore.save(uid, tokens);
    spotifyApi.setAccessToken(body.access_token);
  }

  const [top, recent, profile, top_artists] = await Promise.all([
    spotifyApi.getMyTopTracks({ limit: 10 }),
    spotifyApi.getMyRecentlyPlayedTracks({ limit: 20 }),
    spotifyApi.getMe(),
    spotifyApi.getMyTopArtists({ limit: 10 }),
  ]);
  res.json({
    profile : profile.body,
    top     : top.body.items,
    recent  : recent.body.items,
    top_artists : top_artists.body.items,
  });
});

export default router;
