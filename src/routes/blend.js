import { Router } from 'express';
import User from '../models/User.js';
import MusicTasteGraph from '../models/MusicTasteGraph.js';
const router = Router();

// GET /blend/:user1/:user2
router.get('/:user1/:user2', async (req,res) => {
  const { user1, user2 } = req.params;

  const u1 = await User.findById(user1);
  const u2 = await User.findById(user2);
  if (!u1 || !u2) return res.status(404).json({msg:'User not found'});

  const sharedArtists = u1.topArtists.filter(a => u2.topArtists.includes(a));
  const overlapScore = sharedArtists.length / Math.max(u1.topArtists.length || 1, u2.topArtists.length || 1);

  const graph = await MusicTasteGraph.create({
    user1, user2, overlapScore,
    sharedArtists,
    differentGenres: []
  });

  res.json(graph);
});

export default router;
