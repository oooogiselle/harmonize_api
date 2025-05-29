import { Router } from 'express';
import Friend from '../models/Friend.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const friend = await Friend.create(req.body);
    res.status(201).json(friend);
  } catch (err) {
    console.error('Failed to add friend:', err);
    res.status(400).json({ msg: 'Failed to add friend', err });
  }
});

router.get('/', async (req, res) => {
    try {
        const friends = await Friend.find();
        res.json(friends);
    } catch (err) {
        console.error('Failed to fetch friends:', err);
        res.status(500).json({ msg: 'Failed to fetch friends', err })
    }
});

export default router;
