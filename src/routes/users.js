import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

// GET /users
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

export default router;
