import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

router.get('/', async (_req, res) => {
  const users = await User.find().select('-passwordHash');
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

  router.get('/:id', async (req, res) => {
    const user = await User.findById(req.params.id)
      .populate('favoriteTracks', 'title')
      .populate('friends', 'username');
    res.json(user);
  });
  
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
