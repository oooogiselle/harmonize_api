import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth } from './auth.js';

const router = Router();


router.get('/search', requireAuth, async (req, res) => {
  try {
    console.log('[USERS] Search request received');
    const { q = '' } = req.query;
    const currentUserId = req.session.userId;

    console.log('[USERS] Search query:', q, 'Current user:', currentUserId);

    let query = {
      _id: { $ne: currentUserId }, // Exclude current user
    };

    // Add search criteria if query provided
    if (q.trim()) {
      query.$or = [
        { displayName: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('displayName username spotifyId')
      .limit(20);

    console.log('[USERS] Found users:', users.length);
    res.json(users);
  } catch (err) {
    console.error('[USERS] Error searching users:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get user's top artists (for blending) - ALSO SPECIFIC, so put before /:id
router.get('/:userId/top-artists', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists and has Spotify connected
    const user = await User.findById(userId);
    if (!user || !user.spotifyAccessToken) {
      return res.status(404).json({ error: 'User not found or Spotify not connected' });
    }

    // Get user's Spotify client
    const { getUserSpotifyClient } = await import('../spotifyClient.js');
    const spotify = await getUserSpotifyClient(user);
    
    const result = await spotify.getMyTopArtists({
      time_range: 'medium_term',
      limit: 20,
    });

    const artists = result.body.items.map(artist => ({
      id: artist.id,
      name: artist.name,
      images: artist.images,
      genres: artist.genres,
      popularity: artist.popularity,
    }));

    res.json({ items: artists });
  } catch (err) {
    console.error('Error fetching user top artists:', err);
    res.status(500).json({ error: 'Failed to fetch user top artists' });
  }
});

// Now the general routes can come after the specific ones

// Get all users
router.get('/', async (req, res) => {
  const users = await User.find().select('-passwordHash');
  res.json(users);
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: 'Failed to create user', err });
  }
});

// Add favorite track
router.patch('/:id/favorite', async (req, res) => {
  const { trackId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { favoriteTracks: trackId } },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(400).json({ msg: 'Failed to add favorite track', err });
  }
});

// Get user by ID - PUT THIS LAST among the /:id routes
router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate('favoriteTracks', 'title')
    .populate('friends', 'username');
  res.json(user);
});

// Update user
router.patch('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(400).json({ msg: 'Failed to update user', err });
  }
});

export default router;