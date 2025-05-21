// src/spotifyClient.js
import SpotifyWebApi from 'spotify-web-api-node';

export function getSpotifyClient() {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials missing from environment');
  }

  const spotify = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  // ✅ TEMPORARY: Manually set your access token for testing (expires in 1 hour)
  spotify.setAccessToken("BQCCooB60E10GYLj8doFLaxQTLB2kW2SK8OAS-hIJNHKkQBfwKenoTr-ZUcVAmarJW-i4gUTmy6WGfBWE2zLhWYIsGRu91G1D_pd2zj6LcFNrMxLhI4F1gR3GIJ1LiiGxoz1L2NEOx8");

  return spotify;
}
