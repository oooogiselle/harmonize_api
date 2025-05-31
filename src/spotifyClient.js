import SpotifyWebApi from 'spotify-web-api-node';

/* ───── singleton client ───── */
const spotifyApi = new SpotifyWebApi({
  clientId:     process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

/* ───── get an app‑only access‑token (client‑credentials flow) ───── */
export async function getAccessToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  return data.body.access_token;          // expires in ~3600 s
}

/* ───── helper that returns a ready‑to‑use client ─────
   - refreshes the access‑token if needed
   - returns the shared spotifyApi instance                */
export async function getSpotifyClient() {
  const token = await getAccessToken();
  spotifyApi.setAccessToken(token);
  return spotifyApi;
}

/* default/common export in case other files import it directly */
export { spotifyApi };
