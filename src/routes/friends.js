// routes/friends.js
import { Router } from 'express';
import Friend from '../models/Friend.js';
import { requireAuth } from './auth.js';          // ⇽ NEW

const router = Router();

/* ───────── Follow  ───────── */
router.post('/follow/:friendId', requireAuth, async (req, res) => {
  const userId   = req.session.userId;           // authenticated user
  const friendId = req.params.friendId;

  if (userId === friendId)
    return res.status(400).json({ message: "You can’t follow yourself." });

  try {
    const doc = await Friend.findOneAndUpdate(
      { userId, friendId },
      {},                                        // nothing to update
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(doc);
  } catch (err) {
    console.error('[FOLLOW]', err);
    res.status(500).json({ message: 'Failed to follow', error: err.message });
  }
});

/* ───────── Un-follow ───────── */
router.delete('/follow/:friendId', requireAuth, async (req, res) => {
  const userId   = req.session.userId;
  const friendId = req.params.friendId;

  try {
    const deleted = await Friend.findOneAndDelete({ userId, friendId });
    if (!deleted) return res.status(404).json({ message: 'Not following' });
    res.json({ message: 'Unfollowed' });
  } catch (err) {
    console.error('[UNFOLLOW]', err);
    res.status(500).json({ message: 'Failed to unfollow', error: err.message });
  }
});

/* ───────── Lists  ───────── */
router.get('/followers/:userId',  async (req, res) => {
  const ids = await Friend.find({ friendId: req.params.userId }).select('userId -_id');
  res.json(ids.map(d => d.userId));
});

router.get('/following/:userId', async (req, res) => {
  const ids = await Friend.find({ userId: req.params.userId }).select('friendId -_id');
  res.json(ids.map(d => d.friendId));
});

/* ───────── Is-following? (optional) ───────── */
router.get('/is-following', async (req, res) => {
  const { userId, friendId } = req.query;
  const exists = await Friend.exists({ userId, friendId });
  res.json({ isFollowing: !!exists });
});

export default router;
