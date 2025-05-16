import { Router } from 'express';
import Track from './models/track.js';

const router = Router();

router.get('/hello', (_, res) => res.json({ message: 'Hello, world!' }));

router.get('/tracks', async (_, res) => {
  const data = await Track.find().lean();
  res.json(data);
});

router.post('/tracks', async (req, res) => {
  const track = await Track.create(req.body);
  res.status(201).json(track);
});

export default router;
