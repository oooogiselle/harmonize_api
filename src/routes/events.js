import { Router } from 'express';
import Event from '../models/Event.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json(event);
  } catch (err) {
    console.error('Failed to create event:', err);
    res.status(400).json({ msg: 'Failed to create event', err });
  }
});

router.get('/', async (req, res) => {
  const events = await Event.find().populate('artistId', 'artistName');
  res.json(events);
});

export default router;
