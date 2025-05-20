import { Router } from 'express';
import Artist from '../models/Artist.js';
const router = Router();

// POST /artists
router.post('/', async (req,res) => {
  const artist = await Artist.create(req.body);
  res.status(201).json(artist);
});

export default router;
