import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
dotenv.config();

const spotifyApi = new SpotifyWebApi({
  clientId:     process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

async function refreshToken () {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    const token = data.body.access_token;
    const expiresIn = data.body.expires_in;

    spotifyApi.setAccessToken(token);
    console.log('✓ Spotify token refreshed');

    setTimeout(refreshToken, (expiresIn - 60) * 1000);
  } catch (err) {
    console.error('✗ Spotify token refresh error:', err);
    setTimeout(refreshToken, 60 * 1000);
  }
}

refreshToken();

export default spotifyApi;
