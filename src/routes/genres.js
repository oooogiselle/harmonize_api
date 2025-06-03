import express from 'express';
import User from '../models/User.js';
import { getUserSpotifyClient } from '../spotifyClient.js';

const router = express.Router();

/* Static list: the last known /available-genre-seeds output (May 2025) */
const FALLBACK_SEEDS = [
  'acoustic','afrobeat','alt-rock','alternative','ambient','anime','black-metal',
  'bluegrass','blues','bossanova','brazil','breakbeat','british','cantopop',
  'chicago-house','children','chill','classical','club','comedy','country',
  'dance','dancehall','death-metal','deep-house','detroit-techno','disco',
  'disney','drum-and-bass','dub','dubstep','edm','electro','electronic','emo',
  'folk','forro','french','funk','garage','german','gospel','goth','grindcore',
  'groove','grunge','guitar','happy','hard-rock','hardcore','hardstyle','heavy-metal',
  'hip-hop','holidays','honky-tonk','house','idm','indian','indie','indie-pop',
  'industrial','iranian','j-dance','j-idol','j-pop','j-rock','jazz','k-pop',
  'kids','latin','latino','malay','mandopop','metal','metal-misc','metalcore',
  'minimal-techno','movies','mpb','new-age','new-release','opera','pagode',
  'party','philippines-opm','piano','pop','pop-film','post-dubstep','power-pop',
  'progressive-house','psych-rock','punk','punk-rock','r-n-b','rainy-day',
  'reggae','reggaeton','road-trip','rock','rock-n-roll','rockabilly','romance',
  'sad','salsa','samba','sertanejo','show-tunes','singer-songwriter','ska',
  'sleep','songwriter','soul','soundtracks','spanish','study','summer','swedish',
  'synth-pop','tango','techno','trance','trip-hop','turkish','work-out','world-music'
];

router.get('/api/genre-stats', async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user    = await User.findById(userId);
    const spotify = await getUserSpotifyClient(user);

    /* 1️⃣ Top artists across 3 windows */
    const ranges  = ['short_term','medium_term','long_term'];
    const artists = [];
    for (const r of ranges) {
      const top = await spotify.getMyTopArtists({ limit: 50, time_range: r });
      artists.push(...top.body.items);
    }

    /* 2️⃣ Frequency table */
    const counts = {};
    artists.forEach(a => a.genres.forEach(
      g => (counts[g] = (counts[g] || 0) + 1)
    ));

    /* 3️⃣ Seed-genre list with graceful fallback */
    let seedGenres = FALLBACK_SEEDS;
    try {
      const seedsRes  = await spotify.getAvailableGenreSeeds();
      if (Array.isArray(seedsRes?.body?.genres) && seedsRes.body.genres.length) {
        seedGenres = seedsRes.body.genres;
      }
    } catch (e) {
      console.warn('[genre-stats] seed list 404 - using fallback');
    }

    /* 4️⃣ Partition */
    const listened   = Object.keys(counts);
    const unlistened = seedGenres.filter(g => !listened.includes(g));

    /* 5️⃣ Respond */
    res.json({
      listened:  listened.sort((a,b) => counts[b]-counts[a]),
      histogram: counts,
      unlistened,
      coverage:  (listened.length / seedGenres.length).toFixed(2)
    });

  } catch (e) {
    console.error('[genre-stats]', e);
    res.status(500).json({ error: 'Failed to build genre stats' });
  }
});

router.get('/api/genre-timeline', async (req, res) => {
  try {
    const userId = req.session?.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const spotify = await getUserSpotifyClient(user);
    const ranges = ['short_term', 'medium_term', 'long_term'];
    const timeline = {};

    for (const range of ranges) {
      const top = await spotify.getMyTopArtists({ limit: 50, time_range: range });
      const genreCounts = {};

      top.body.items.forEach(artist => {
        artist.genres.forEach(g => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      });

      timeline[range] = genreCounts;
    }

    res.json(timeline);
  } catch (err) {
    console.error('[genre-timeline]', err);
    res.status(500).json({ error: 'Failed to build genre timeline' });
  }
});


export default router;
