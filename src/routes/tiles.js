// src/routes/tiles.js
import express from 'express';
import mongoose from 'mongoose';
import Tile from '../models/Tile.js';

const router = express.Router();

// POST /api/tiles
router.post('/', async (req, res) => {
  try {
    console.log('[POST /api/tiles] Request body:', req.body);

    // 🔧 Convert userId to ObjectId
    const data = {
      ...req.body,
      userId: new mongoose.Types.ObjectId(req.body.userId),
    };

    const tile = await Tile.create(data);
    res.status(201).json(tile);
  } catch (err) {
    console.error('Tile POST error:', err.message, err.stack); // 👀 More helpful error
    res.status(500).json({ error: 'Failed to create tile' });
  }
});

// GET /api/tiles/:userId
router.get('/:userId', async (req, res) => {
  try {
    const tiles = await Tile.find({ userId: req.params.userId });
    res.json(tiles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tiles' });
  }
});

// PATCH /api/tiles/:id
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

// DELETE /api/tiles/:id
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

export default router;
