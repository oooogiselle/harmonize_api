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

router.patch('/:id/like', async (req, res) => {
    const { userId } = req.body;
    try {
      const track = await Track.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { likes: userId } },
        { new: true }
      );
      res.json(track);
    } catch (err) {
      res.status(400).json({ msg: 'Like failed', err });
    }
  });
  
  router.patch('/:id/comment', async (req, res) => {
    const { userId, content } = req.body;
    try {
      const track = await Track.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            comments: {
              userId,
              content,
              timestamp: new Date()
            }
          }
        },
        { new: true }
      );
      res.json(track);
    } catch (err) {
      res.status(400).json({ msg: 'Comment failed', err });
    }
  });
  
  
export default router;

