import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { requireAuth } from './auth.js';

const router = Router();

/* ─────────────────────────────── */
/*  SEARCH USERS (excludes self)   */
/* ─────────────────────────────── */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q = '' } = req.query;
    const currentUserId = req.user?.id || req.session?.userId;

    const query = {
      _id: { $ne: currentUserId },
      ...(q.trim() && {
        $or: [
          { displayName: { $regex: q, $options: 'i' } },
          { username: { $regex: q, $options: 'i' } },
        ],
      }),
    };

    const users = await User.find(query)
      .select('displayName username avatar spotifyId')
      .limit(20);

    res.json(users);
  } catch (err) {
    console.error('[USERS] Search error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/* ─────────────────────────────── */
/*  FOLLOW / UNFOLLOW              */
/* ─────────────────────────────── */
router.post('/:id/follow', requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || req.session?.userId;
    const targetUserId = req.params.id;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const current = await User.findByIdAndUpdate(
        currentUserId,
        { $addToSet: { following: targetUserId } },
        { new: true, session }
      ).select('_id username displayName avatar following followers');

      const target = await User.findByIdAndUpdate(
        targetUserId,
        { $addToSet: { followers: currentUserId } },
        { new: true, session }
      ).select('_id username displayName avatar following followers');

      if (!current || !target) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'User not found' });
      }

      await session.commitTransaction();
      res.status(201).json({ current, target });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error('[USERS] Follow error:', err);
    next(err);
  }
});

router.delete('/:id/follow', requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || req.session?.userId;
    const targetUserId = req.params.id;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'Cannot unfollow yourself' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const current = await User.findByIdAndUpdate(
        currentUserId,
        { $pull: { following: targetUserId } },
        { new: true, session }
      ).select('_id username displayName avatar following followers');

      const target = await User.findByIdAndUpdate(
        targetUserId,
        { $pull: { followers: currentUserId } },
        { new: true, session }
      ).select('_id username displayName avatar following followers');

      if (!current || !target) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'User not found' });
      }

      await session.commitTransaction();
      res.json({ current, target });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error('[USERS] Unfollow error:', err);
    next(err);
  }
});

/* ─────────────────────────────── */
/*  LOCATION UPDATE                */
/* ─────────────────────────────── */
/* ─────────────────────────────── */
/*  LOCATION UPDATE                */
/* ─────────────────────────────── */
router.post('/location', requireAuth, async (req, res) => {  // 👈 Add requireAuth here
  try {
    // Use the same pattern as other authenticated routes
    const userId = req.user?.id || req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { latitude, longitude } = req.body;

    // Validate coordinates - reject default/invalid values
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    if (latitude === 0 && longitude === 0) {
      return res.status(400).json({ error: 'Invalid coordinates: cannot be 0,0' });
    }
    
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return res.status(400).json({ error: 'Invalid coordinates: out of range' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude], // GeoJSON format: [lng, lat]
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[USERS] Location updated for user ${userId}:`, { latitude, longitude });
    res.json({ success: true, location: updatedUser.location });
    
  } catch (err) {
    console.error('[USERS] Location update error:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/* ─────────────────────────────── */
/*  FOLLOWING & FOLLOWERS LIST     */
/* ─────────────────────────────── */
router.get('/:id/following', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('following', '_id username displayName avatar location');
    res.json(user?.following ?? []);
  } catch (err) {
    console.error('[USERS] Following list error:', err);
    res.status(500).json({ error: 'Failed to fetch following list' });
  }
});

router.get('/:id/followers', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', '_id username displayName avatar location');
    res.json(user?.followers ?? []);
  } catch (err) {
    console.error('[USERS] Followers list error:', err);
    res.status(500).json({ error: 'Failed to fetch followers list' });
  }
});

/* ─────────────────────────────── */
/*  BASIC USER ROUTES              */
/* ─────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash -spotifyAccessToken -spotifyRefreshToken');
    res.json(users);
  } catch (err) {
    console.error('[USERS] List error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/', async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    console.error('[USERS] Creation error:', err);
    res.status(400).json({ error: 'Failed to create user' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(user);
  } catch (err) {
    console.error('[USERS] Update error:', err);
    res.status(400).json({ error: 'Failed to update user' });
  }
});

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
    console.error('[USERS] Favorite update error:', err);
    res.status(400).json({ error: 'Failed to add favorite track' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('following', 'username displayName avatar location')
      .populate('followers', 'username displayName avatar location')
      .select('-passwordHash -spotifyAccessToken -spotifyRefreshToken');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('[USERS] Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;
