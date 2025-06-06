import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import User from '../models/User.js';
import Friend from '../models/Friend.js';
import { getUserSpotifyClient } from '../spotifyClient.js';

const router = express.Router();

// Add this function at the top of your file
async function getAccessToken() {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });
  
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    return data.body.access_token;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    throw error;
  }
}

/* ─────────── /spotify/search?q=&type= ─────────── */
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'artist' } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing search query' });

    // Create a new Spotify API instance for each request
    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    const token = await getAccessToken();
    spotifyApi.setAccessToken(token);

    const result = await spotifyApi.search(q, [type], { limit: 10 });

    if (type === 'artist') {
      const artists = result.body.artists.items.map(artist => ({
        id: artist.id,
        name: artist.name,
        images: artist.images,
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
          images: track.album.images,
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
    res.status(500).json({ error: 'Failed to search Spotify', details: err.message });
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

// ─────────── GET Spotify data for a friend by userId ───────────
router.get('/user/:id', async (req, res) => {
  try {
    const friend = await User.findById(req.params.id);
    if (!friend || !friend.spotifyAccessToken || !friend.spotifyRefreshToken) {
      return res.status(404).json({ error: 'Spotify not connected for this user' });
    }

    const spotify = await getUserSpotifyClient(friend);

    const [topTracks, topArtists] = await Promise.all([
      spotify.getMyTopTracks({ limit: 10, time_range: 'medium_term' }),
      spotify.getMyTopArtists({ limit: 10, time_range: 'medium_term' }),
    ]);

    res.json({
      topTracks: topTracks.body.items,
      topArtists: topArtists.body.items,
    });
  } catch (err) {
    console.error('[SPOTIFY] Error fetching user data:', err);
    res.status(500).json({ error: 'Failed to fetch user Spotify data' });
  }
});

// Add this route to your spotify.js routes file
router.get('/user/:id/top-artists', async (req, res) => {
  try {
    const friend = await User.findById(req.params.id);
    if (!friend || !friend.spotifyAccessToken || !friend.spotifyRefreshToken) {
      return res.status(404).json({ error: 'Spotify not connected for this user' });
    }

    const spotify = await getUserSpotifyClient(friend);

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
    console.error('[SPOTIFY] Error fetching user top artists:', err);
    res.status(500).json({ error: 'Failed to fetch user top artists' });
  }
});
router.get('/friends/top', async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const friendships = await Friend.find({ userId }).populate('friendId');
    const friendsWithSpotify = friendships
      .map(f => f.friendId)
      .filter(f => f.spotifyAccessToken && f.spotifyRefreshToken);

    const results = await Promise.allSettled(
      friendsWithSpotify.map(async friend => {
        try {
          const spotify = await getUserSpotifyClient(friend);

          const [topTracks, topArtists] = await Promise.all([
            spotify.getMyTopTracks({ limit: 5, time_range: 'medium_term' }),
            spotify.getMyTopArtists({ limit: 5, time_range: 'medium_term' }),
          ]);

          return {
            friend: {
              id: friend._id,
              name: friend.displayName || friend.username,
              image: friend.profilePicture || null,
              location: friend.location,
            },
            topTracks: topTracks.body.items,
            topArtists: topArtists.body.items,
          };
        } catch (err) {
          console.warn(`Skipping friend ${friend._id} due to Spotify error`, err);
          return null;
        }
      })
    );

    const filteredResults = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    res.json({ friends: filteredResults });
  } catch (err) {
    console.error('Failed to fetch friends Spotify data:', err);
    res.status(500).json({ error: 'Failed to load friend Spotify data' });
  }
});


export default router;