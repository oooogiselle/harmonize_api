import express from 'express';
import { getSpotifyClient } from '../spotifyClient.js';
import Artist from '../models/Artist.js';

const router = express.Router();

/* ---------- Middleware: Inject your Spotify client with pre-set token ---------- */
async function ensureToken(req, res, next) {
  try {
    const spotify = getSpotifyClient();

    // ✅ Just attach the instance with your hardcoded token
    req.spotify = spotify;
    next();
  } catch (e) {
    console.error('Spotify auth failed:', e);
    res.status(500).json({ error: 'Spotify auth failed' });
  }
}

/* ---------- /artists/search?query=... ---------- */
router.get('/artists/search', ensureToken, async (req, res) => {
  const q = req.query.query;
  if (!q) return res.status(400).json({ error: 'query required' });

  try {
    const { body } = await req.spotify.searchArtists(q, { limit: 10, market: 'US' });
    const out = body.artists.items.map(a => ({
      id:    a.id,
      name:  a.name,
      image: a.images[0]?.url ?? null,
    }));
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Spotify search failed' });
  }
});

/* ---------- /artists/spotify/:id ---------- */
router.get('/artists/spotify/:id', ensureToken, async (req, res) => {
  const { id } = req.params;
  const spotify = req.spotify;

  try {
    const { body: art } = await spotify.getArtist(id);
    const { body: { tracks } } = await spotify.getArtistTopTracks(id, 'US');

    const topTracks = tracks.map(t => ({
      id: t.id,
      name: t.name,
      popularity: t.popularity,
      album: {
        name: t.album.name,
        images: t.album.images,
      }
    }));

    let albums = [];
    let next = null;
    do {
      const { body } = next
        ? await spotify.getGeneric(next)
        : await spotify.getArtistAlbums(id, {
            include_groups: 'album,single',
            limit: 50,
            market: 'US',
          });
      albums = albums.concat(body.items);
      next = body.next;
    } while (next);

    const seen = new Set();
    const cleanAlbums = albums
      .filter(a => {
        const key = a.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(a => ({
        id: a.id,
        name: a.name,
        year: a.release_date.split('-')[0],
        images: a.images,
      }));

    const payload = {
      spotifyId: id,
      artistName: art.name,
      profilePic: art.images[0]?.url ?? null,
      topTracks,
      albums: cleanAlbums,
      bio: '',
      followers: [],
    };

    await Artist.findOneAndUpdate({ spotifyId: id }, payload, { upsert: true, new: true });
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Spotify artist fetch failed' });
  }
});

/** ---------- /spotify/recent ---------- */
router.get('/recent', ensureToken, async (req, res) => {
  try {
    const data = await req.spotify.getMyRecentlyPlayedTracks({ limit: 10 });
    res.json(data.body.items);
  } catch (err) {
    console.error('Error fetching recent tracks:', err);
    res.status(500).json({ msg: 'Spotify error', err });
  }
});

/** ---------- /spotify/top-artists ---------- */
router.get('/top-artists', ensureToken, async (req, res) => {
  try {
    const data = await req.spotify.getMyTopArtists({ limit: 10 });
    res.json(data.body.items);
  } catch (err) {
    console.error('Error fetching top artists:', err);
    res.status(500).json({ msg: 'Spotify error', err });
  }
});

export default router;
