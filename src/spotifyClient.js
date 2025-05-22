
import SpotifyWebApi from 'spotify-web-api-node';

let cachedToken     = null;
let tokenExpiresAt  = 0;


export async function getSpotifyClient() {
  const spotify = new SpotifyWebApi({
    clientId:     process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  const now = Date.now();

  if (!cachedToken || now >= tokenExpiresAt) {
    const { body } = await spotify.clientCredentialsGrant();
    cachedToken    = body.access_token;
    tokenExpiresAt = now + (body.expires_in * 1000) - 60_000; // renew 1 min early
  }

  spotify.setAccessToken(cachedToken);
  return spotify;
}
