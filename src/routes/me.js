/* src/routes/me.js
   ------------------------------------------------------------------ */
import express from 'express';
import util    from 'util';
import User    from '../models/User.js';
import { getUserSpotifyClient } from '../spotifyClient.js';
import mapTrack from '../utils/mapTrack.js';

const router = express.Router();

/* ───────── helpers ───────── */
const inspect = (obj) => util.inspect(obj, { depth: 3, colors: false });
const MAX_SEEDS = 5;

function trimSeeds({ artists = [], tracks = [], genres = [] }) {
  if (!artists.length && !tracks.length && !genres.length) return null;

  // Try to distribute seeds evenly across types
  const totalTypes = [artists, tracks, genres].filter(arr => arr.length > 0).length;
  const seedsPerType = Math.floor(MAX_SEEDS / totalTypes);
  const remainder = MAX_SEEDS % totalTypes;

  let pickedArtists = [];
  let pickedTracks = [];
  let pickedGenres = [];
  let extraSeeds = remainder;

  // Distribute evenly first
  if (artists.length > 0) {
    const take = Math.min(seedsPerType + (extraSeeds > 0 ? 1 : 0), artists.length);
    pickedArtists = artists.slice(0, take);
    if (extraSeeds > 0) extraSeeds--;
  }

  if (tracks.length > 0) {
    const take = Math.min(seedsPerType + (extraSeeds > 0 ? 1 : 0), tracks.length);
    pickedTracks = tracks.slice(0, take);
    if (extraSeeds > 0) extraSeeds--;
  }

  if (genres.length > 0) {
    const take = Math.min(seedsPerType + (extraSeeds > 0 ? 1 : 0), genres.length);
    pickedGenres = genres.slice(0, take);
  }

  // Fill remaining slots if we have space
  const used = pickedArtists.length + pickedTracks.length + pickedGenres.length;
  let remaining = MAX_SEEDS - used;

  // Add more artists if we have room
  if (remaining > 0 && pickedArtists.length < artists.length) {
    const canAdd = Math.min(remaining, artists.length - pickedArtists.length);
    pickedArtists = artists.slice(0, pickedArtists.length + canAdd);
    remaining -= canAdd;
  }

  // Add more tracks if we have room
  if (remaining > 0 && pickedTracks.length < tracks.length) {
    const canAdd = Math.min(remaining, tracks.length - pickedTracks.length);
    pickedTracks = tracks.slice(0, pickedTracks.length + canAdd);
    remaining -= canAdd;
  }

  // Add more genres if we have room
  if (remaining > 0 && pickedGenres.length < genres.length) {
    const canAdd = Math.min(remaining, genres.length - pickedGenres.length);
    pickedGenres = genres.slice(0, pickedGenres.length + canAdd);
  }

  console.log('🔧 trimSeeds distribution:');
  console.log('  - Input: artists:', artists.length, 'tracks:', tracks.length, 'genres:', genres.length);
  console.log('  - Output: artists:', pickedArtists.length, 'tracks:', pickedTracks.length, 'genres:', pickedGenres.length);

  return {
    seed_artists: pickedArtists.length ? pickedArtists : undefined,
    seed_tracks : pickedTracks.length  ? pickedTracks  : undefined,
    seed_genres : pickedGenres.length  ? pickedGenres  : undefined,
    market      : 'from_token',
    limit       : 20,
  };
}

/* ───────── GET /api/me/spotify – profile + tops + recent ───────── */
router.get('/api/me/spotify', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);

    const [profile, topTracks, topArtists, recent] = await Promise.all([
      spotify.getMe(),
      spotify.getMyTopTracks({ limit: 10 }),
      spotify.getMyTopArtists({ limit: 10 }),
      spotify.getMyRecentlyPlayedTracks({ limit: 10 }),
    ]);

    res.json({
      profile : profile.body,
      top     : topTracks .body.items?.map(mapTrack) ?? [],
      top_artists: topArtists.body.items?.map((a) => ({
        id     : a.id,
        name   : a.name,
        image  : a.images?.[0]?.url ?? null,
        genres : a.genres ?? [],
      })) ?? [],
      recent  : recent.body.items?.map((i) => mapTrack(i.track)) ?? [],
    });
  } catch (err) {
    console.error('[Spotify /me Error]', inspect(err.body ?? err));
    res.status(500).json({ error: 'Spotify API failed' });
  }
});

/* ───────── GET /api/recommendations with AUTH DEBUG ───────── */
router.get('/api/recommendations', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    console.log('🔐 Debug: User has tokens:', {
      hasAccessToken: !!user.spotifyAccessToken,
      hasRefreshToken: !!user.spotifyRefreshToken,
      accessTokenLength: user.spotifyAccessToken?.length || 0,
      refreshTokenLength: user.spotifyRefreshToken?.length || 0
    });

    const spotify = await getUserSpotifyClient(user);
    
    // DEBUG: Test basic authentication first
    console.log('🔐 Testing basic authentication...');
    try {
      const me = await spotify.getMe();
      console.log('✅ Auth test passed! User:', me.body.display_name, '(', me.body.id, ')');
      console.log('✅ Country:', me.body.country, 'Product:', me.body.product);
    } catch (e) {
      console.error('❌ Auth test FAILED:', e.statusCode, e.message);
      console.error('Auth error body:', JSON.stringify(e.body, null, 2));
      return res.status(401).json({ error: 'Spotify authentication failed' });
    }

    // DEBUG: Test if we can access user's library
    console.log('🔐 Testing library access...');
    try {
      const playlists = await spotify.getUserPlaylists({ limit: 1 });
      console.log('✅ Library access OK! User has', playlists.body.total, 'playlists');
    } catch (e) {
      console.error('❌ Library access failed:', e.statusCode, e.message);
      console.error('Library error body:', JSON.stringify(e.body, null, 2));
    }

    // DEBUG: Try the simplest possible recommendation call
    console.log('🔐 Testing simplest recommendation call...');
    try {
      // Just one genre, no other parameters
      const simpleRec = await spotify.getRecommendations({
        seed_genres: ['pop'],
        limit: 1
      });
      console.log('✅ Simple rec call SUCCESS!');
      return res.json(simpleRec.body.tracks.map(mapTrack));
    } catch (e) {
      console.error('❌ Simple rec call failed:', e.statusCode, e.message);
      console.error('Simple rec error body:', JSON.stringify(e.body, null, 2));
      console.error('Simple rec headers:', e.headers);
      
      // Debug the request details
      console.error('🔍 Request debugging:');
      console.error('  - Status code:', e.statusCode);
      console.error('  - Error type:', typeof e);
      console.error('  - Error keys:', Object.keys(e));
      
      if (e.request) {
        console.error('  - Request URI:', e.request.uri);
        console.error('  - Request method:', e.request.method);
        console.error('  - Request headers:', JSON.stringify(e.request.headers, null, 2));
      }
    }

    // DEBUG: Test available genres endpoint specifically
    console.log('🔐 Testing available genres endpoint...');
    try {
      const genres = await spotify.getAvailableGenreSeeds();
      console.log('✅ Available genres call SUCCESS! Found', genres.body.genres.length, 'genres');
      console.log('First few genres:', genres.body.genres.slice(0, 10));
    } catch (e) {
      console.error('❌ Available genres failed:', e.statusCode, e.message);
      console.error('Genres error body:', JSON.stringify(e.body, null, 2));
    }

    // DEBUG: Check token expiration
    console.log('🔐 Checking token status...');
    try {
      // Try to refresh token to see if that helps
      console.log('🔄 Attempting token refresh...');
      const refreshResult = await spotify.refreshAccessToken();
      console.log('✅ Token refresh successful!');
      
      // Update user's token in database
      user.spotifyAccessToken = refreshResult.body.access_token;
      if (refreshResult.body.refresh_token) {
        user.spotifyRefreshToken = refreshResult.body.refresh_token;
      }
      await user.save();
      
      // Try recommendation again with fresh token
      console.log('🔄 Retrying recommendation with fresh token...');
      const retryRec = await spotify.getRecommendations({
        seed_genres: ['pop'],
        limit: 1
      });
      console.log('✅ Retry with fresh token SUCCESS!');
      return res.json(retryRec.body.tracks.map(mapTrack));
      
    } catch (e) {
      console.error('❌ Token refresh failed:', e.statusCode, e.message);
      console.error('Refresh error body:', JSON.stringify(e.body, null, 2));
    }

    // If we get here, everything failed
    console.error('❌ All debugging attempts failed');
    return res.status(500).json({ 
      error: 'Spotify API unavailable',
      details: 'All authentication and API tests failed'
    });

  } catch (error) {
    console.error('❌ Outer catch - unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ───────── GET /api/recent – 20 most-recent plays ───────── */
router.get('/api/recent', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);
    const recent  = await spotify.getMyRecentlyPlayedTracks({ limit: 20 });
    res.json(recent.body.items?.map((i) => mapTrack(i.track)) ?? []);
  } catch (err) {
    console.error('[Recently Played Error]', inspect(err.body ?? err));
    res.status(500).json({ error: 'Failed to fetch recently-played tracks' });
  }
});

/* ───────── placeholder friend-activity feed ───────── */
router.get('/api/friends/activity', async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    if (!me) return res.status(401).json({ error: 'Not logged in' });

    res.json([
      {
        userId: 'placeholder-id',
        name  : 'Sample Friend',
        track : {
          id     : 'fake-track-id',
          name   : 'Lo-fi Chill Beats',
          artists: ['Lo-Fi Collective'],
          album  : 'Vibes Vol. 3',
          image  : 'https://i.scdn.co/image/ab67616d0000b273f3c6e1341c5e89e8a5e9e58e',
          preview: null,
        },
      },
    ]);
  } catch (err) {
    console.error('[Friend Activity Error]', inspect(err.body ?? err));
    res.status(500).json({ error: 'Could not fetch friend activity' });
  }
});

export default router;
