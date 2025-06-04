import express from 'express';
import Tile from '../models/Tile.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/* utility */
const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

/* ───────── GET /api/tiles?userId=xxx — list tiles for a user ───────── */
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!isValidObjectId(userId))
    return res.status(400).json({ error: 'Invalid or missing userId' });

  try {
    const tiles = await Tile.find({ userId }).sort({ createdAt: -1 });
    return res.json(tiles);
  } catch (err) {
    console.error('[TILES] list error:', err);
    return res.status(500).json({ error: 'Failed to fetch tiles' });
  }
});

/* ───────── GET /api/tiles/:userId — same as above (legacy) ───────── */
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!isValidObjectId(userId))
    return res.status(400).json({ error: 'Invalid userId format' });

  try {
    const tiles = await Tile.find({ userId }).sort({ createdAt: -1 });
    return res.json(tiles);
  } catch (err) {
    console.error('[TILES] legacy list error:', err);
    return res.status(500).json({ error: 'Failed to fetch tiles' });
  }
});

/* ───────── POST /api/tiles — create tile (auth) ───────── */
router.post('/', requireAuth, async (req, res) => {
  const currentUserId = req.session.userId;
  const {
    type = 'text',
    content = '',
    x = 0,
    y = 0,
    w = 1,
    h = 1,
    title = '',
    bgImage = '',
    bgColor = '',
    font = '',
  } = req.body;

  try {
    const tile = await Tile.create({
      userId: currentUserId,
      type,
      content,
      title,
      bgImage,
      bgColor,
      font,
      x: Number(x),
      y: Number(y),
      w: Number(w),
      h: Number(h),
    });
    return res.status(201).json(tile);
  } catch (err) {
    console.error('[TILES] create error:', err);
    return res.status(500).json({ error: 'Failed to create tile' });
  }
});

/* ───────── PATCH /api/tiles/bulk-layout — reorder tiles (auth) ───────── */
router.patch('/bulk-layout', requireAuth, async (req, res) => {
  const { updates } = req.body;
  const currentUserId = req.session.userId;

  if (!Array.isArray(updates))
    return res.status(400).json({ error: 'updates must be an array' });

  let updated = 0;
  for (const u of updates) {
    const id = u._id || u.id;
    if (!isValidObjectId(id)) continue;

    const tile = await Tile.findById(id);
    if (!tile || tile.userId.toString() !== currentUserId) continue;

    await Tile.findByIdAndUpdate(id, {
      x: Number(u.x),
      y: Number(u.y),
      w: Number(u.w),
      h: Number(u.h),
      updatedAt: new Date(),
    });
    updated += 1;
  }
  return res.json({ updated });
});

/* ───────── PATCH /api/tiles/:id — update tile (auth) ───────── */
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(400).json({ error: 'Invalid tile ID' });

  const tile = await Tile.findById(id);
  if (!tile || tile.userId.toString() !== req.session.userId)
    return res.status(403).json({ error: 'Not your tile' });

  try {
    const updated = await Tile.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    return res.json(updated);
  } catch (err) {
    console.error('[TILES] update error:', err);
    return res.status(500).json({ error: 'Failed to update tile' });
  }
});

/* ───────── DELETE /api/tiles/:id — delete tile (auth) ───────── */
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id))
    return res.status(400).json({ error: 'Invalid tile ID' });

  const tile = await Tile.findById(id);
  if (!tile || tile.userId.toString() !== req.session.userId)
    return res.status(403).json({ error: 'Not your tile' });

  try {
    await Tile.findByIdAndDelete(id);
    return res.status(204).send();
  } catch (err) {
    console.error('[TILES] delete error:', err);
    return res.status(500).json({ error: 'Failed to delete tile' });
  }
});

export default router;
