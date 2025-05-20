import { Router } from 'express';
import Event from '../models/Event.js';
const router = Router();

// GET /events
router.get('/', async (req,res) => {
  const events = await Event.find().populate('artistId','artistName');
  res.json(events);
});

export default router;
