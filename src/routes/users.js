// routes/users.js
import { Router } from 'express';
import User   from '../models/User.js';
import Friend from '../models/Friend.js';
import { requireAuth, optionalAuth } from './auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const users = await User.find()
    .select('-passwordHash -spotifyAccessToken -spotifyRefreshToken');
  res.json(users);
});

router.post('/', async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: 'Failed to create user', err });
  }
});

router.patch('/:id/favorite', requireAuth, async (req, res) => {
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

router.patch('/:id', requireAuth, async (req, res) => {
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

router.get('/search', async (req, res) => {
  const { username = '' } = req.query;
  if (!username.trim()) return res.json([]);

  try {
    const hits = await User.find({
      username: { $regex: username, $options: 'i' },
    })
      .limit(15)
      .select('_id username avatar');
    res.json(hits);
  } catch (err) {
    console.error('[SEARCH USERS]', err);
    res.status(500).json({ msg: 'Search failed', err: err.message });
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id)
      .select('-passwordHash -spotifyAccessToken -spotifyRefreshToken');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const followers = user.followers?.length || 0;
    const following = user.following?.length || 0;

    const isFollowing =
      req.session?.userId &&
      user.followers?.some((uid) => uid.toString() === req.session.userId);

    res.json({
      ...user.toObject(),
      followers,
      following,
      isFollowing,
    });
  } catch (err) {
    console.error('[GET PROFILE]', err);
    res.status(500).json({ msg: 'Failed to fetch profile', err: err.message });
  }
});

export default router;
