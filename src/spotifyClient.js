import SpotifyWebApi from 'spotify-web-api-node';
import User from './models/User.js';

/* ───── add this helper ───── */
export async function getAccessToken() {
  const client = new SpotifyWebApi({
    clientId:     process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  const { body } = await client.clientCredentialsGrant();
  return body.access_token;
}

/* ───── singleton client (app credentials) ───── */
const spotifyApi = new SpotifyWebApi({
  clientId:     process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

export async function getSpotifyClient() {
  const token = await getAccessToken();         // now works
  spotifyApi.setAccessToken(token);
  return spotifyApi;
}

/* ───── per-user client with token refresh ───── */
export async function getUserSpotifyClient(user) {
  const client = new SpotifyWebApi({
    clientId:     process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri:  process.env.SPOTIFY_REDIRECT_URI,
  });

  client.setAccessToken(user.spotifyAccessToken);
  client.setRefreshToken(user.spotifyRefreshToken);

  const expired =
    !user.spotifyTokenExpiresAt || new Date() >= user.spotifyTokenExpiresAt;

  if (expired) {
    const data = await client.refreshAccessToken();
    client.setAccessToken(data.body.access_token);

    user.spotifyAccessToken    = data.body.access_token;
    user.spotifyTokenExpiresAt = new Date(
      Date.now() + data.body.expires_in * 1000
    );
    await user.save();
  }

  return client;
}

export { spotifyApi };
