import express from 'express';
import User from '../models/User.js';
import { getUserSpotifyClient } from '../spotifyClient.js';
import mapTrack from '../utils/mapTrack.js';

const router = express.Router();

/* ───────── GET /api/me/spotify – Profile, Top Songs, Top Artists, Recently Played ───────── */
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
      profile: profile.body,
      top: topTracks.body.items?.map(mapTrack) ?? [],
      top_artists: topArtists.body.items?.map((artist) => ({
        id: artist.id,
        name: artist.name,
        image: artist.images?.[0]?.url ?? null,
        genres: artist.genres ?? [],
      })) ?? [],
      recent: recent.body.items?.map((item) => mapTrack(item.track)) ?? [],
    });
  } catch (err) {
    console.error('[Spotify API Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Spotify API failed' });
  }
});

/* helpers -------------------------------------------------------------- */
const MAX_SEEDS = 5;

function trimSeeds({ artists = [], tracks = [], genres = [] }) {
  // drop empties first
  if (!artists.length && !tracks.length && !genres.length) return null;

  // keep total ≤ 5
  let remaining = MAX_SEEDS;
  const pickedArtists = artists.slice(0, Math.min(artists.length, remaining));
  remaining -= pickedArtists.length;

  const pickedTracks  = tracks.slice(0, Math.min(tracks.length, remaining));
  remaining -= pickedTracks.length;

  const pickedGenres  = genres.slice(0, Math.min(genres.length, remaining));

  return {
    seed_artists: pickedArtists.length ? pickedArtists : undefined,
    seed_tracks : pickedTracks.length  ? pickedTracks  : undefined,
    seed_genres : pickedGenres.length ? pickedGenres : undefined,
    market      : 'from_token',
    limit       : 20,
  };
}

/* ───────── GET /api/recommendations ───────── */
router.get('/api/recommendations', async (req, res) => {
  try {
    /* 1. gather seeds exactly as before … */
    // … seedArtists, seedTracks, seedGenres are filled here …

    const baseSeeds = trimSeeds({
      artists: seedArtists,
      tracks : seedTracks,
      genres : seedGenres,
    });
    if (!baseSeeds) return res.status(204).json([]);

    /* first attempt --------------------------------------------------- */
    try {
      const rec = await spotify.getRecommendations(baseSeeds);
      return res.json(rec.body.tracks.map(mapTrack));
    } catch (e) {
      console.warn('[Spotify] recs attempt 1 failed:',
                   e.statusCode, JSON.stringify(e.body || e));
    }

    /* fall-back: genre seeds only ------------------------------------ */
    try {
      const allGenres   = (await spotify.getAvailableGenreSeeds()).body.genres;
      const genreSeeds  = trimSeeds({ genres: allGenres.slice(0, 5) });
      const rec         = await spotify.getRecommendations(genreSeeds);
      return res.json(rec.body.tracks.map(mapTrack));
    } catch (e) {
      console.error('[Spotify] recs fallback failed:',
                    e.statusCode, JSON.stringify(e.body || e));
      return res.status(204).json([]);
    }
  } catch (err) {
    console.error('[Recommendations Route Error]', err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/* ───────── GET /api/recent – Recently played tracks ───────── */
router.get('/api/recent', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    if (!user.spotifyAccessToken || !user.spotifyRefreshToken)
      return res.status(403).json({ error: 'Spotify not connected' });

    const spotify = await getUserSpotifyClient(user);
    const recent = await spotify.getMyRecentlyPlayedTracks({ limit: 20 });

    res.json(recent.body.items?.map((item) => mapTrack(item.track)) ?? []);
  } catch (err) {
    console.error('[Recently Played Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Failed to fetch recently-played tracks' });
  }
});

/* ───────── GET /api/friends/activity – Placeholder version ───────── */
router.get('/api/friends/activity', async (req, res) => {
  try {
    const me = await User.findById(req.session.userId);
    if (!me) return res.status(401).json({ error: 'Not logged in' });

    const placeholderActivity = [
      {
        userId: 'placeholder-id',
        name: 'Sample Friend',
        track: {
          id: 'fake-track-id',
          name: 'Lo-fi Chill Beats',
          artists: ['Lo-Fi Collective'],
          album: 'Vibes Vol. 3',
          image: 'https://i.scdn.co/image/ab67616d0000b273f3c6e1341c5e89e8a5e9e58e',
          preview: null,
        },
      },
    ];

    res.json(placeholderActivity);
  } catch (err) {
    console.error('[Friend Activity Error]', err.body || err.message || err);
    res.status(500).json({ error: 'Could not fetch friend activity' });
  }
});

export default router;
