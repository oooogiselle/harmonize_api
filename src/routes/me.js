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

/* ───────── GET /api/recommendations with ENHANCED DEBUG LOGGING ───────── */
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
      
      // DEBUG: Log actual artist details
      console.log('🎤 Artist details:');
      topA.body.items.forEach((artist, i) => {
        console.log(`  ${i+1}. ${artist.name} (${artist.id}) - genres: ${artist.genres.join(', ')}`);
      });
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
      
      // DEBUG: Log actual track details
      console.log('🎶 Track details:');
      topT.body.items.forEach((track, i) => {
        console.log(`  ${i+1}. ${track.name} by ${track.artists.map(a => a.name).join(', ')} (${track.id})`);
      });
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

    /* 1.5. Validate seeds before making API call -------------------------- */
    console.log('🔍 Validating seed IDs...');
    
    // Check if artist IDs exist
    if (baseSeeds.seed_artists && baseSeeds.seed_artists.length > 0) {
      try {
        console.log('🎤 Checking artist IDs:', baseSeeds.seed_artists);
        const artistCheck = await spotify.getArtists(baseSeeds.seed_artists);
        const validArtists = artistCheck.body.artists.filter(a => a !== null);
        console.log(`✅ Valid artists: ${validArtists.length}/${baseSeeds.seed_artists.length}`);
        if (validArtists.length < baseSeeds.seed_artists.length) {
          console.log('⚠️ Some artist IDs are invalid!');
          baseSeeds.seed_artists = validArtists.map(a => a.id);
        }
      } catch (e) {
        console.error('❌ Artist validation failed:', e.statusCode, e.message);
        // Remove artist seeds if validation fails
        delete baseSeeds.seed_artists;
      }
    }

    // Check if track IDs exist
    if (baseSeeds.seed_tracks && baseSeeds.seed_tracks.length > 0) {
      try {
        console.log('🎶 Checking track IDs:', baseSeeds.seed_tracks);
        const trackCheck = await spotify.getTracks(baseSeeds.seed_tracks);
        const validTracks = trackCheck.body.tracks.filter(t => t !== null);
        console.log(`✅ Valid tracks: ${validTracks.length}/${baseSeeds.seed_tracks.length}`);
        if (validTracks.length < baseSeeds.seed_tracks.length) {
          console.log('⚠️ Some track IDs are invalid!');
          baseSeeds.seed_tracks = validTracks.map(t => t.id);
        }
      } catch (e) {
        console.error('❌ Track validation failed:', e.statusCode, e.message);
        // Remove track seeds if validation fails
        delete baseSeeds.seed_tracks;
      }
    }

    console.log('🔧 Validated seeds:', baseSeeds);

    /* 2. main recommendation call ---------------------------------------- */
    console.log('🎯 Making recommendation call with validated seeds:', baseSeeds);
    try {
      const rec = await spotify.getRecommendations(baseSeeds);
      console.log('✅ Recommendations success! Found:', rec.body.tracks.length, 'tracks');
      return res.json(rec.body.tracks.map(mapTrack));
    } catch (e) {
      console.error('❌ Recs attempt 1 failed:', e.statusCode, e.message);
      console.error('Error body:', JSON.stringify(e.body, null, 2));
      
      // Log the actual request URL if possible
      if (e.request) {
        console.error('Request URL:', e.request.uri || 'N/A');
        console.error('Request method:', e.request.method || 'N/A');
      }
      
      // Try to get more details about the error
      if (e.body && e.body.error) {
        console.error('Spotify error details:', e.body.error);
      }
    }

    /* 3. fallback: simple genre-only seeds -------------------------------- */
    console.log('🔄 Trying fallback with simple genre seeds...');
    try {
      // Use just a few common genres that should definitely exist
      const simpleGenres = ['pop', 'rock', 'hip-hop'];
      const genreSeeds = { 
        seed_genres: simpleGenres.slice(0, 2), // Just use 2 genres
        market: 'from_token',
        limit: 20 
      };
      console.log('🎲 Using simple genre seeds:', genreSeeds);
      const rec = await spotify.getRecommendations(genreSeeds);
      console.log('✅ Simple fallback success! Found:', rec.body.tracks.length, 'tracks');
      return res.json(rec.body.tracks.map(mapTrack));
    } catch (e) {
      console.error('❌ Simple fallback failed:', e.statusCode, e.message);
      console.error('Simple fallback error body:', JSON.stringify(e.body, null, 2));
    }

    /* 4. last resort: get available genres and use those ----------------- */
    console.log('🔄 Trying last resort with Spotify\'s available genres...');
    try {
      const allGenres = await spotify.getAvailableGenreSeeds();
      console.log('📝 Available genres:', allGenres.body.genres.length);
      const genreSeeds = { 
        seed_genres: allGenres.body.genres.slice(0, 2), // Just use first 2 available genres
        market: 'from_token',
        limit: 20 
      };
      console.log('🎲 Using available genre seeds:', genreSeeds);
      const rec = await spotify.getRecommendations(genreSeeds);
      console.log('✅ Last resort success! Found:', rec.body.tracks.length, 'tracks');
      return res.json(rec.body.tracks.map(mapTrack));
    } catch (e) {
      console.error('❌ Last resort failed:', e.statusCode, e.message);
      console.error('Last resort error body:', JSON.stringify(e.body, null, 2));
      return res.status(500).json({ error: 'All recommendation attempts failed' });
    }
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
