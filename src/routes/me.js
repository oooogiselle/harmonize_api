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

  let remaining = MAX_SEEDS;
  const take    = (arr) => arr.splice(0, Math.min(arr.length, remaining));
  const pickedArtists = take([...artists]);
  remaining -= pickedArtists.length;
  const pickedTracks  = take([...tracks]);
  remaining -= pickedTracks.length;
  const pickedGenres  = take([...genres]);

  return {
    seed_artists: pickedArtists.length ? pickedArtists : undefined,
    seed_tracks : pickedTracks.length  ? pickedTracks  : undefined,
    seed_genres : pickedGenres.length ? pickedGenres : undefined,
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

/* ───────── GET /api/recommendations with DEBUG LOGGING ───────── */
router.get('/api/recommendations', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);

    /* 1. build seed lists -------------------------------------------------- */
    let seedArtists = [];
    let seedTracks  = [];
    let seedGenres  = [];

    // DEBUG: Check if we can get top artists
    console.log('🎵 Fetching top artists...');
    try {
      const topA = await spotify.getMyTopArtists({ limit: 5, time_range: 'medium_term' });
      seedArtists = topA.body.items.map((a) => a.id);
      seedGenres  = [...new Set(topA.body.items.flatMap((a) => a.genres))];
      console.log('✅ Top artists found:', seedArtists.length);
      console.log('✅ Genres found:', seedGenres.length);
    } catch (e) {
      console.error('❌ Top artists failed:', e.statusCode, e.message);
      console.error('Full error:', inspect(e.body ?? e));
    }

    // DEBUG: Check if we can get top tracks
    console.log('🎵 Fetching top tracks...');
    try {
      const topT = await spotify.getMyTopTracks({ limit: 5, time_range: 'medium_term' });
      seedTracks = topT.body.items.map((t) => t.id);
      console.log('✅ Top tracks found:', seedTracks.length);
    } catch (e) {
      console.error('❌ Top tracks failed:', e.statusCode, e.message);
      console.error('Full error:', inspect(e.body ?? e));
    }

    // DEBUG: Log what seeds we have
    console.log('📊 Seeds summary:');
    console.log('  - Artists:', seedArtists.length, seedArtists.slice(0, 2));
    console.log('  - Tracks:', seedTracks.length, seedTracks.slice(0, 2));
    console.log('  - Genres:', seedGenres.length, seedGenres.slice(0, 5));

    const baseSeeds = trimSeeds({ artists: seedArtists, tracks: seedTracks, genres: seedGenres });
    
    // DEBUG: Check what trimSeeds returned
    console.log('🔧 Base seeds result:', baseSeeds);
    
    if (!baseSeeds) {
      console.log('❌ No base seeds - returning 204');
      return res.status(204).json([]);  // nothing to recommend yet
    }

    /* 2. main recommendation call ---------------------------------------- */
    console.log('🎯 Making recommendation call with seeds:', baseSeeds);
    try {
      const rec = await spotify.getRecommendations(baseSeeds);
      console.log('✅ Recommendations success! Found:', rec.body.tracks.length, 'tracks');
      return res.json(rec.body.tracks.map(mapTrack));
    } catch (e) {
      console.error('❌ Recs attempt 1 failed:', e.statusCode, e.message);
      console.error('Full error:', inspect(e.body ?? e));
    }

    /* 3. fallback: random genre seeds ------------------------------------ */
    console.log('🔄 Trying fallback with random genres...');
    try {
      const allGenres  = (await spotify.getAvailableGenreSeeds()).body.genres;
      console.log('📝 Available genres:', allGenres.length);
      const genreSeeds = trimSeeds({ genres: allGenres.slice(0, 5) });
      console.log('🎲 Using genre seeds:', genreSeeds);
      const rec        = await spotify.getRecommendations(genreSeeds);
      console.log('✅ Fallback success! Found:', rec.body.tracks.length, 'tracks');
      return res.json(rec.body.tracks.map(mapTrack));
    } catch (e) {
      console.error('❌ Fallback failed:', e.statusCode, e.message);
      console.error('Full error:', inspect(e.body ?? e));
      return res.status(204).json([]);
    }
  } catch (err) {
    console.error('[Recommendations Route Error]', inspect(err));
    res.status(500).json({ error: 'Failed to fetch recommendations' });
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
