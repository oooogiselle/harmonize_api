import express from 'express';
import User from '../models/User.js';

const router = express.Router();

/* You can keep other routes like: */
router.get('/api/me', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  try {
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Failed to get user info', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ No duplicate /api/me/spotify route here

export default router;
