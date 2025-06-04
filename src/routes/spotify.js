import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import User from '../models/User.js';
import { getUserSpotifyClient } from '../spotifyClient.js';

const router = express.Router();

/* ─────────── /spotify/search?q=&type= ─────────── */
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'artist' } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing search query' });

    const token = await getAccessToken();
    spotifyApi.setAccessToken(token);

    const result = await spotifyApi.search(q, [type]);

    if (type === 'artist') {
      const artists = result.body.artists.items.map(artist => ({
        id: artist.id,
        name: artist.name,
        images: artist.images, // Make sure to include the full images array
        image: artist.images?.[0]?.url || null,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers?.total
      }));
      return res.json(artists);
    }

    if (type === 'track') {
      const tracks = result.body.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => ({ id: a.id, name: a.name })),
        album: {
          id: track.album.id,
          name: track.album.name,
          images: track.album.images, // Make sure to include the full images array
          image: track.album.images?.[0]?.url || null
        },
        preview_url: track.preview_url,
        popularity: track.popularity
      }));
      return res.json({ tracks });
    }

    res.status(400).json({ error: 'Unsupported search type' });
  } catch (err) {
    console.error('Spotify search failed:', err);
    res.status(500).json({ error: 'Failed to search Spotify' });
  }
});

router.get('/top-artists', async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(req.session.userId);
    if (!user || !user.spotifyAccessToken) {
      return res.status(401).json({ error: 'Spotify not connected' });
    }

    // Get user's Spotify client with token refresh
    const spotify = await getUserSpotifyClient(user);
    
    const { time_range = 'medium_term', limit = 20 } = req.query;

    const result = await spotify.getMyTopArtists({
      time_range,
      limit: Math.min(Number(limit), 50),
    });

    const artists = result.body.items.map(artist => ({
      id: artist.id,
      name: artist.name,
      images: artist.images,
      image: artist.images?.[0]?.url || null,
      genres: artist.genres,
      popularity: artist.popularity,
      followers: artist.followers?.total,
      external_urls: artist.external_urls,
    }));

    res.json({ items: artists }); 
  } catch (err) {
    console.error('Spotify top artists fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch top artists' });
  }
});


export default router;