// src/routes/tiles.js
import express from 'express';
import mongoose from 'mongoose';
import Tile from '../models/Tile.js';

const router = express.Router();

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && (String(new mongoose.Types.ObjectId(id)) === id);
};

// POST /api/tiles — Create new tile
router.post('/', async (req, res) => {
  try {
    console.log('[POST /api/tiles] Request body:', req.body);
    
    // Validate userId
    if (!req.body.userId || !isValidObjectId(req.body.userId)) {
      return res.status(400).json({ error: 'Invalid or missing userId' });
    }
    
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
    if (!isValidObjectId(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    
    const tiles = await Tile.find({ userId: req.params.userId });
    res.json(tiles);
  } catch (err) {
    console.error('Tile GET error:', err);
    res.status(500).json({ error: 'Failed to fetch tiles' });
  }
});

// PATCH /api/tiles/:id — Update individual tile
router.patch('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid tile ID' });
    }
    
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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid tile ID' });
    }
    
    const deleted = await Tile.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Tile not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Tile DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete tile' });
  }
});

// PATCH /api/tiles/bulk-layout — Bulk update tile positions
router.patch('/bulk-layout', async (req, res) => {
  try {
    console.log('[PATCH /api/tiles/bulk-layout] Request body:', req.body);
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid layout update format - updates must be an array' });
    }

    // Validate all IDs before processing
    const validUpdates = [];
    for (const update of updates) {
      if (!update.id || !isValidObjectId(update.id)) {
        console.warn(`Invalid tile ID in bulk update: ${update.id}`);
        continue;
      }
      validUpdates.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(update.id) },
          update: { 
            $set: { 
              x: update.x, 
              y: update.y, 
              w: update.w, 
              h: update.h 
            } 
          },
        },
      });
    }

    if (validUpdates.length === 0) {
      return res.status(400).json({ error: 'No valid tile updates provided' });
    }

    const result = await Tile.bulkWrite(validUpdates);
    console.log('[PATCH /api/tiles/bulk-layout] Bulk write result:', result);
    
    res.status(200).json({ 
      message: 'Layout updated successfully',
      updated: result.modifiedCount,
      matched: result.matchedCount
    });
  } catch (err) {
    console.error('Tile LAYOUT update error:', err);
    res.status(500).json({ error: 'Failed to update layout' });
  }
});

export default router;