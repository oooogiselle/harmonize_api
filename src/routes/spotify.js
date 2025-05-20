import { Router } from 'express';
import spotify from '../spotifyClient.js';

const router = Router();

/** GET /spotify/search?q=tame+impala&type=artist,album,track,playlist */
router.get('/search', async (req, res) => {
  const { q, type = 'artist' } = req.query;
  if (!q) return res.status(400).json({ msg: 'query param “q” required' });
  try {
    const data = await spotify.search(q, type.split(','));
    res.json(data.body);
  } catch (err) {
    res.status(500).json({ msg: 'Spotify error', err });
  }
});

/** GET /spotify/artist/:id */
router.get('/artist/:id', async (req,res) => {
  try {
    const data = await spotify.getArtist(req.params.id);           // Get‑Artist endpoint :contentReference[oaicite:5]{index=5}
    res.json(data.body);
  } catch (err) { res.status(500).json({ msg:'Spotify error', err }); }
});

router.get('/artist/:id/albums', async (req,res) => {
  try {
    const data = await spotify.getArtistAlbums(req.params.id, { limit:50 });
    res.json(data.body);
  } catch (err) { res.status(500).json({ msg:'Spotify error', err }); }
});

/** GET /spotify/album/:id */
router.get('/album/:id', async (req,res) => {
  try {
    const data = await spotify.getAlbum(req.params.id);
    res.json(data.body);
  } catch (err) { res.status(500).json({ msg:'Spotify error', err }); }
});

/** GET /spotify/track/:id */
router.get('/track/:id', async (req,res) => {
  try {
    const data = await spotify.getTrack(req.params.id);
    res.json(data.body);
  } catch (err) { res.status(500).json({ msg:'Spotify error', err }); }
});

/** GET /spotify/playlist/:id */
router.get('/playlist/:id', async (req,res) => {
  try {
    const data = await spotify.getPlaylist(req.params.id);
    res.json(data.body);
  } catch (err) { res.status(500).json({ msg:'Spotify error', err }); }
});

export default router;
