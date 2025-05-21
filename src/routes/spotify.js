import express from 'express';
import { getSpotifyClient } from '../spotifyClient.js';
import Artist from '../models/Artist.js';

const router = express.Router();

/* ── middleware: attaches fresh spotify client + token ─────────────── */
async function ensureToken(req, res, next) {
  try {
    const spotify = getSpotifyClient();

    if (spotify.getAccessToken() && !spotify.isAccessTokenExpired()) {
      req.spotify = spotify;
      return next();
    }
    const { body } = await spotify.clientCredentialsGrant();
    spotify.setAccessToken(body.access_token);
    req.spotify = spotify;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Spotify auth failed' });
  }
}

/* ── SEARCH ────────────────────────────────────────────────────────── */
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

/* ── FULL IMPORT & CACHE ───────────────────────────────────────────── */
router.get('/artists/spotify/:id', ensureToken, async (req, res) => {
  const { id }    = req.params;
  const spotify   = req.spotify;

  try {
    /* profile */
    const { body: art } = await spotify.getArtist(id);

    /* top tracks */
    const { body: { tracks } } = await spotify.getArtistTopTracks(id, 'US');
    const topTracks = tracks.map(t => ({
      id:   t.id,
      name: t.name,
      popularity: t.popularity,
      album: { name: t.album.name, images: t.album.images }
    }));


    let albums = [];
    let offset = 0;
    let page;
    do {
      page = await spotify.getArtistAlbums(id, {
        include_groups: 'album,single',
        limit: 50,
        market: 'US',
        offset,
      });
      albums = albums.concat(page.body.items);
      offset += 50;
    } while (page.body.next);

    /* dedupe by lowercase name */
    const seen  = new Set();
    const clean = albums
      .filter(a => {
        const key = a.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(a => ({
        id:   a.id,
        name: a.name,
        year: a.release_date.split('-')[0],
        images: a.images,
      }));

    const payload = {
      spotifyId:  id,
      artistName: art.name,
      profilePic: art.images[0]?.url ?? null,
      topTracks,
      albums:     clean,
      bio:        '',
      followers:  [],
    };

    /* cache in Mongo */
    await Artist.findOneAndUpdate({ spotifyId: id }, payload, { upsert: true, new: true });

    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Spotify artist fetch failed' });
  }
});

/* ── FOLLOW / UNFOLLOW TOGGLE ────────────────────────────────────────
   Expects header  x-user-id: <currentUserId>
   (Front-end can keep hard-coded ID or add this header later.)
───────────────────────────────────────────────────────────────────── */
router.patch('/artists/:id/follow', async (req, res) => {
  const { id }   = req.params;                        // Spotify artist ID
  const userId   = req.get('x-user-id') || '682bf5ec57acfd1e97d85d8e'; // fallback demo ID

  try {
    const artist = await Artist.findOne({ spotifyId: id });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const idx = artist.followers.indexOf(userId);
    if (idx === -1) {
      artist.followers.push(userId);                  // follow
    } else {
      artist.followers.splice(idx, 1);                // unfollow
    }
    await artist.save();
    res.json({ followers: artist.followers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Follow update failed' });
  }
});

export default router;
