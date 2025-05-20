import { Router } from 'express';
import Track from '../models/Track.js';
const router = Router();

// GET /tracks
router.get('/', async (req,res) => {
  const tracks = await Track.find().populate('artistId','artistName');
  res.json(tracks);
});

// POST /tracks
router.post('/', async (req,res) => {
  const track = await Track.create(req.body);
  res.status(201).json(track);
});

export default router;
