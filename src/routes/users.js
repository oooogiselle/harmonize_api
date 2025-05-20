import { Router } from 'express';
import User from '../models/User.js';
const router = Router();

// GET /users
router.get('/', async (req,res) => {
  const users = await User.find().select('-passwordHash');
  res.json(users);
});

export default router;
