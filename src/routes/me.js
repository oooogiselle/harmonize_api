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
/* ───────── SPOTIFY RECOMMENDATIONS WORKAROUND ───────── */
/* Replace your current /api/recommendations endpoint with this */

router.get('/api/recommendations', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);
    console.log('🎯 Generating recommendations using workaround...');

    // Strategy 1: Get user's top artists and find related artists
    const [topArtists, topTracks, recentTracks] = await Promise.all([
      spotify.getMyTopArtists({ limit: 10, time_range: 'medium_term' }),
      spotify.getMyTopTracks({ limit: 15, time_range: 'medium_term' }),
      spotify.getMyRecentlyPlayedTracks({ limit: 10 })
    ]);

    const recommendations = [];
    const usedTrackIds = new Set();
    
    // Add user's existing tracks to avoid duplicates
    topTracks.body.items?.forEach(track => usedTrackIds.add(track.id));
    recentTracks.body.items?.forEach(item => usedTrackIds.add(item.track.id));

    console.log(`📊 Found ${topArtists.body.items?.length || 0} top artists`);

    // Method 1: Related Artists -> Top Tracks
    for (const artist of topArtists.body.items?.slice(0, 4) || []) {
      try {
        console.log(`🔍 Finding related artists for ${artist.name}`);
        const related = await spotify.getArtistRelatedArtists(artist.id);
        
        for (const relatedArtist of related.body.artists?.slice(0, 3) || []) {
          try {
            const artistTopTracks = await spotify.getArtistTopTracks(relatedArtist.id, 'US');
            
            for (const track of artistTopTracks.body.tracks?.slice(0, 2) || []) {
              if (!usedTrackIds.has(track.id) && recommendations.length < 15) {
                recommendations.push({
                  ...mapTrack(track),
                  recommendation_reason: `Because you listen to ${artist.name}`
                });
                usedTrackIds.add(track.id);
              }
            }
          } catch (err) {
            console.log(`⚠️ Failed to get top tracks for ${relatedArtist.name}`);
          }
        }
      } catch (err) {
        console.log(`⚠️ Failed to get related artists for ${artist.name}`);
      }
    }

    // Method 2: Artists from user's tracks -> More albums
    const artistsFromTracks = new Set();
    topTracks.body.items?.forEach(track => {
      track.artists?.forEach(artist => artistsFromTracks.add(artist.id));
    });

    console.log(`🎵 Exploring albums from ${artistsFromTracks.size} artists`);
    
    for (const artistId of Array.from(artistsFromTracks).slice(0, 3)) {
      try {
        const albums = await spotify.getArtistAlbums(artistId, { 
          include_groups: 'album,single', 
          limit: 3,
          market: 'US'
        });
        
        for (const album of albums.body.items?.slice(0, 2) || []) {
          try {
            const albumTracks = await spotify.getAlbumTracks(album.id, { limit: 3 });
            
            for (const track of albumTracks.body.items || []) {
              if (!usedTrackIds.has(track.id) && recommendations.length < 20) {
                // Get full track info since album tracks don't have complete data
                try {
                  const fullTrack = await spotify.getTrack(track.id);
                  recommendations.push({
                    ...mapTrack(fullTrack.body),
                    recommendation_reason: `From ${album.name}`
                  });
                  usedTrackIds.add(track.id);
                } catch (err) {
                  console.log(`⚠️ Failed to get full track info for ${track.id}`);
                }
              }
            }
          } catch (err) {
            console.log(`⚠️ Failed to get tracks from album ${album.id}`);
          }
        }
      } catch (err) {
        console.log(`⚠️ Failed to get albums for artist ${artistId}`);
      }
    }

    // Method 3: Featured Playlists (if we still need more tracks)
    if (recommendations.length < 15) {
      console.log('🎧 Adding tracks from featured playlists...');
      try {
        const featured = await spotify.getFeaturedPlaylists({ limit: 5, country: 'US' });
        
        for (const playlist of featured.body.playlists?.items?.slice(0, 2) || []) {
          try {
            const playlistTracks = await spotify.getPlaylistTracks(playlist.id, { 
              limit: 5,
              fields: 'items(track(id,name,artists,album,preview_url,external_urls))'
            });
            
            for (const item of playlistTracks.body.items || []) {
              if (item.track && !usedTrackIds.has(item.track.id) && recommendations.length < 20) {
                recommendations.push({
                  ...mapTrack(item.track),
                  recommendation_reason: `From "${playlist.name}" playlist`
                });
                usedTrackIds.add(item.track.id);
              }
            }
          } catch (err) {
            console.log(`⚠️ Failed to get tracks from playlist ${playlist.id}`);
          }
        }
      } catch (err) {
        console.log('⚠️ Failed to get featured playlists');
      }
    }

    // Shuffle and limit results
    const finalRecommendations = recommendations
      .sort(() => Math.random() - 0.5)
      .slice(0, 20);

    console.log(`✅ Generated ${finalRecommendations.length} recommendations`);
    
    res.json(finalRecommendations);

  } catch (error) {
    console.error('❌ Recommendations workaround error:', error);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: error.message 
    });
  }
});

/* ───────── Genre-based Discovery (Alternative approach) ───────── */
router.get('/api/discover/:method', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);
    const { method } = req.params;
    let tracks = [];

    switch (method) {
      case 'new-releases':
        console.log('🆕 Getting new releases...');
        const newReleases = await spotify.getNewReleases({ limit: 20, country: 'US' });
        
        for (const album of newReleases.body.albums?.items?.slice(0, 10) || []) {
          try {
            const albumTracks = await spotify.getAlbumTracks(album.id, { limit: 2 });
            for (const track of albumTracks.body.items?.slice(0, 1) || []) {
              const fullTrack = await spotify.getTrack(track.id);
              tracks.push(mapTrack(fullTrack.body));
            }
          } catch (err) {
            console.log(`Failed to get tracks from new release ${album.id}`);
          }
        }
        break;

      case 'categories':
        console.log('🏷️ Getting category playlists...');
        const categories = await spotify.getCategories({ limit: 5, country: 'US' });
        
        for (const category of categories.body.categories?.items || []) {
          try {
            const categoryPlaylists = await spotify.getCategoryPlaylists(category.id, { limit: 2 });
            
            for (const playlist of categoryPlaylists.body.playlists?.items || []) {
              try {
                const playlistTracks = await spotify.getPlaylistTracks(playlist.id, { limit: 3 });
                for (const item of playlistTracks.body.items || []) {
                  if (item.track && tracks.length < 20) {
                    tracks.push({
                      ...mapTrack(item.track),
                      category: category.name
                    });
                  }
                }
              } catch (err) {
                console.log(`Failed to get tracks from playlist ${playlist.id}`);
              }
            }
          } catch (err) {
            console.log(`Failed to get playlists for category ${category.id}`);
          }
        }
        break;

      case 'featured':
        console.log('⭐ Getting featured playlists...');
        const featured = await spotify.getFeaturedPlaylists({ limit: 10, country: 'US' });
        
        for (const playlist of featured.body.playlists?.items || []) {
          try {
            const playlistTracks = await spotify.getPlaylistTracks(playlist.id, { limit: 3 });
            for (const item of playlistTracks.body.items || []) {
              if (item.track && tracks.length < 20) {
                tracks.push({
                  ...mapTrack(item.track),
                  playlist: playlist.name
                });
              }
            }
          } catch (err) {
            console.log(`Failed to get tracks from featured playlist ${playlist.id}`);
          }
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid discovery method' });
    }

    // Shuffle results
    const shuffledTracks = tracks
      .sort(() => Math.random() - 0.5)
      .slice(0, 20);

    res.json({
      method,
      tracks: shuffledTracks,
      count: shuffledTracks.length
    });

  } catch (error) {
    console.error(`❌ Discovery method ${req.params.method} error:`, error);
    res.status(500).json({ 
      error: 'Failed to discover music',
      details: error.message 
    });
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
