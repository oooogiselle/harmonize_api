// src/routes/tiles.js
import express from 'express';
import mongoose from 'mongoose';
import Tile from '../models/Tile.js';

const router = express.Router();

// POST /api/tiles — Create new tile
router.post('/', async (req, res) => {
  try {
    console.log('[POST /api/tiles] Request body:', req.body);
    const data = {
      ...req.body,
      userId: new mongoose.Types.ObjectId(req.body.userId),
    };

    const tile = await Tile.create(data);
    res.status(201).json(tile);
  } catch (err) {
    console.error('Tile POST error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create tile' });
  }
});

// GET /api/tiles/:userId — Fetch all tiles for a user
router.get('/:userId', async (req, res) => {
  try {
    const tiles = await Tile.find({ userId: req.params.userId });
    res.json(tiles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tiles' });
  }
});

// PATCH /api/tiles/:id — Update individual tile
router.patch('/:id', async (req, res) => {
  try {
    const updated = await Tile.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Tile not found' });
    res.json(updated);
  } catch (err) {
    console.error('Tile PATCH error:', err);
    res.status(500).json({ error: 'Failed to update tile' });
  }
});

// DELETE /api/tiles/:id — Delete tile
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Tile.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Tile not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Tile DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete tile' });
  }
});

// ✅ NEW: PUT /api/tiles/layout — Bulk update tile layout
router.put('/layout', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid layout update format' });
    }

    const bulkOps = updates.map(({ id, x, y, w, h }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { x, y, w, h } },
      },
    }));

    await Tile.bulkWrite(bulkOps);
    res.status(200).json({ message: 'Layout updated successfully' });
  } catch (err) {
    console.error('Tile LAYOUT update error:', err);
    res.status(500).json({ error: 'Failed to update layout' });
  }
});

export default router;
