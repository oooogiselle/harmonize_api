// src/utils/refreshToken.js
import SpotifyWebApi from 'spotify-web-api-node';
import User from '../models/User.js';

export async function refreshAccessTokenForUser(user) {
  const spotify = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  });

  spotify.setRefreshToken(user.spotifyRefreshToken);

  const data = await spotify.refreshAccessToken();
  user.spotifyAccessToken = data.body.access_token;
  await user.save();

  spotify.setAccessToken(data.body.access_token);
  return spotify;
}
