// src/routes/tiles.js
import express from 'express';
import mongoose from 'mongoose';
import Tile from '../models/Tile.js';

const router = express.Router();

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && (String(new mongoose.Types.ObjectId(id)) === id);
};

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// POST /api/tiles — Create new tile
router.post('/', requireAuth, async (req, res) => {
  try {
    console.log('[POST /api/tiles] Request body:', req.body);
    console.log('[POST /api/tiles] Session userId:', req.session.userId);
    
    // Use session userId as fallback if not provided in body
    const userId = req.body.userId || req.session.userId;
    
    // Validate userId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid or missing userId' });
    }
    
    const data = {
      ...req.body,
      userId: new mongoose.Types.ObjectId(userId),
      // Ensure default values for layout
      x: req.body.x || 0,
      y: req.body.y || 0,
      w: req.body.w || 1,
      h: req.body.h || 1,
    };

    const tile = await Tile.create(data);
    console.log('[POST /api/tiles] Created tile:', tile);
    res.status(201).json(tile);
  } catch (err) {
    console.error('Tile POST error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create tile', details: err.message });
  }
});

// GET /api/users/:userId/tiles — Fetch all tiles for a user (with viewer permission check)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { viewerId } = req.query;
    
    console.log('[GET /api/users/:userId/tiles] userId:', userId, 'viewerId:', viewerId);
    
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    
    // For now, allow viewing any user's tiles (you can add privacy logic later)
    const tiles = await Tile.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: 1 });
    console.log('[GET /api/users/:userId/tiles] Found tiles:', tiles.length);
    res.json(tiles);
  } catch (err) {
    console.error('Tile GET error:', err);
    res.status(500).json({ error: 'Failed to fetch tiles', details: err.message });
  }
});

// GET /api/tiles/:userId — Alternative endpoint for fetching tiles
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('[GET /api/tiles/:userId] userId:', userId);
    
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    
    const tiles = await Tile.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: 1 });
    console.log('[GET /api/tiles/:userId] Found tiles:', tiles.length);
    res.json(tiles);
  } catch (err) {
    console.error('Tile GET error:', err);
    res.status(500).json({ error: 'Failed to fetch tiles', details: err.message });
  }
});

// PATCH /api/tiles/:id — Update individual tile
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[PATCH /api/tiles/:id] Updating tile:', id, 'with data:', req.body);
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tile ID' });
    }
    
    // Find the tile first to check ownership
    const existingTile = await Tile.findById(id);
    if (!existingTile) {
      return res.status(404).json({ error: 'Tile not found' });
    }
    
    // Check if user owns this tile (optional security check)
    if (existingTile.userId.toString() !== req.session.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this tile' });
    }
    
    const updated = await Tile.findByIdAndUpdate(id, req.body, { new: true });
    console.log('[PATCH /api/tiles/:id] Updated tile:', updated);
    res.json(updated);
  } catch (err) {
    console.error('Tile PATCH error:', err);
    res.status(500).json({ error: 'Failed to update tile', details: err.message });
  }
});

// DELETE /api/tiles/:id — Delete tile
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[DELETE /api/tiles/:id] Deleting tile:', id);
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tile ID' });
    }
    
    // Find the tile first to check ownership
    const existingTile = await Tile.findById(id);
    if (!existingTile) {
      return res.status(404).json({ error: 'Tile not found' });
    }
    
    // Check if user owns this tile
    if (existingTile.userId.toString() !== req.session.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this tile' });
    }
    
    const deleted = await Tile.findByIdAndDelete(id);
    console.log('[DELETE /api/tiles/:id] Deleted tile:', deleted?._id);
    res.json({ success: true, deletedId: deleted._id });
  } catch (err) {
    console.error('Tile DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete tile', details: err.message });
  }
});

// PATCH /api/tiles/bulk-layout — Bulk update tile positions
router.patch('/bulk-layout', requireAuth, async (req, res) => {
  try {
    console.log('[PATCH /api/tiles/bulk-layout] Request body:', req.body);
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid layout update format - updates must be an array' });
    }

    // Validate all IDs before processing and ensure user owns all tiles
    const validUpdates = [];
    for (const update of updates) {
      // Handle both _id and id fields
      const tileId = update._id || update.id;
      
      if (!tileId || !isValidObjectId(tileId)) {
        console.warn(`Invalid tile ID in bulk update: ${tileId}`);
        continue;
      }
      
      // Verify tile exists and user owns it
      const tile = await Tile.findById(tileId);
      if (!tile) {
        console.warn(`Tile not found for ID: ${tileId}`);
        continue;
      }
      
      if (tile.userId.toString() !== req.session.userId.toString()) {
        console.warn(`User ${req.session.userId} doesn't own tile ${tileId}`);
        continue;
      }
      
      validUpdates.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(tileId) },
          update: { 
            $set: { 
              x: Number(update.x) || 0, 
              y: Number(update.y) || 0, 
              w: Number(update.w) || 1, 
              h: Number(update.h) || 1 
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
    res.status(500).json({ error: 'Failed to update layout', details: err.message });
  }
});

export default router;