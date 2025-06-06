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
/*  FOLLOW / UNFOLLOW - FIXED      */
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
/*  FOLLOWING & FOLLOWERS LIST     */
/* ─────────────────────────────── */
router.get('/:id/following', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('following', '_id username displayName avatar');
    res.json(user?.following ?? []);
  } catch (err) {
    console.error('[USERS] Following list error:', err);
    res.status(500).json({ error: 'Failed to fetch following list' });
  }
});

router.get('/:id/followers', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', '_id username displayName avatar');
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

// User profile route - no Spotify dependencies
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('following', 'username displayName avatar')
      .populate('followers', 'username displayName avatar')
      .select('-passwordHash -spotifyAccessToken -spotifyRefreshToken'); // Hide sensitive data

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