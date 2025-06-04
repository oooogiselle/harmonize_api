// routes/friends.js
import { Router } from 'express';
import Friend from '../models/Friend.js';

const router = Router();

// Follow a user
router.post('/follow', async (req, res) => {
  const { userId, friendId } = req.body;
  if (userId === friendId) {
    return res.status(400).json({ msg: "You can't follow yourself." });
  }

  try {
    const newFollow = await Friend.create({ userId, friendId });
    res.status(201).json(newFollow);
  } catch (err) {
    console.error('Follow failed:', err);
    res.status(400).json({ msg: 'Failed to follow', err });
  }
});

// Unfollow a user
router.delete('/unfollow', async (req, res) => {
  const { userId, friendId } = req.body;

  try {
    const result = await Friend.findOneAndDelete({ userId, friendId });
    if (!result) return res.status(404).json({ msg: 'Follow relationship not found' });
    res.json({ msg: 'Unfollowed successfully' });
  } catch (err) {
    console.error('Unfollow failed:', err);
    res.status(500).json({ msg: 'Failed to unfollow', err });
  }
});

// Get who a user is following
router.get('/following/:userId', async (req, res) => {
  try {
    const following = await Friend.find({ userId: req.params.userId });
    res.json(following.map(f => f.friendId));
  } catch (err) {
    console.error('Fetch following failed:', err);
    res.status(500).json({ msg: 'Failed to get following', err });
  }
});

// Get who follows a user
router.get('/followers/:userId', async (req, res) => {
  try {
    const followers = await Friend.find({ friendId: req.params.userId });
    res.json(followers.map(f => f.userId));
  } catch (err) {
    console.error('Fetch followers failed:', err);
    res.status(500).json({ msg: 'Failed to get followers', err });
  }
});

// (Optional) Check if a user follows another
router.get('/is-following', async (req, res) => {
  const { userId, friendId } = req.query;
  try {
    const follow = await Friend.findOne({ userId, friendId });
    res.json({ isFollowing: !!follow });
  } catch (err) {
    console.error('Check follow failed:', err);
    res.status(500).json({ msg: 'Failed to check follow status', err });
  }
});

export default router;
