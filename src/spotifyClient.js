import SpotifyWebApi from 'spotify-web-api-node';

const spotifyApi = new SpotifyWebApi({
  clientId:     process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

export async function getAccessToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    return data.body.access_token;
  } catch (err) {
    console.error('Failed to get Spotify access token:', err);
    throw err;
  }
}

export { spotifyApi };
