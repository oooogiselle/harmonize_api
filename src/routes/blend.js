import { Router } from 'express';
import User from '../models/User.js';
import MusicTasteGraph from '../models/MusicTasteGraph.js';

const router = Router();

router.get('/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;

  try {
    const u1 = await User.findById(user1);
    const u2 = await User.findById(user2);

    if (!u1 || !u2) {
      return res.status(404).json({ msg: 'One or both users not found' });
    }

    const shared = u1.topArtists.filter((artist) => u2.topArtists.includes(artist));
    const overlapScore = shared.length / Math.max(u1.topArtists.length || 1, u2.topArtists.length || 1);

    const graph = await MusicTasteGraph.create({
      user1,
      user2,
      overlapScore,
      sharedArtists: shared,
      differentGenres: [],
      generatedAt: new Date(),
    });

    res.json(graph);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Blend error', err });
  }
});

export default router;
