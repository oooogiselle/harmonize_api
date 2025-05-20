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

// routes/spotify.js - add a new route
router.get('/track-analytics/:id', async (req, res) => {
  try {
    // Get track data
    const data = await spotify.getTrack(req.params.id);
    const track = data.body;
    
    // Get audio features which includes additional metrics
    const features = await spotify.getAudioFeaturesForTrack(req.params.id);
    
    // Calculate estimated streams based on popularity and other factors
    // This is still an estimation as Spotify doesn't expose actual stream counts via API
    const estimatedStreams = calculateStreams(track.popularity, features.body);
    
    res.json({
      ...track,
      estimatedStreams
    });
  } catch (err) {
    res.status(500).json({ msg: 'Spotify error', err });
  }
});

// Helper function to estimate streams
function calculateStreams(popularity, features) {
  // More sophisticated algorithm could consider:
  // - Track age
  // - Artist popularity
  // - Genre popularity
  // - Audio features like danceability
  
  const baseStreams = popularity * 150000;
  const modifier = (features.danceability + features.energy) / 2;
  return Math.floor(baseStreams * (0.8 + modifier * 0.4));
}

export default router;
