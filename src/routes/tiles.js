import express from 'express';
import Tile from '../models/Tile.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper function to validate ObjectId
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/* ───────── GET /api/users/:userId/tiles - Get tiles for a specific user ───────── */
router.get('/api/users/:userId/tiles', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { viewerId } = req.query;
    const currentUserId = req.session.userId;

    console.log('[TILES] Fetching tiles for user:', userId, 'viewer:', viewerId, 'session:', currentUserId);

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Build query - for now, get all tiles for the user
    // TODO: Add privacy filtering based on viewerId
    const query = { userId };
    
    const tiles = await Tile.find(query).sort({ createdAt: -1 });
    
    console.log('[TILES] Found tiles:', tiles.length);
    res.json(tiles);
  } catch (err) {
    console.error('[TILES] Error fetching user tiles:', err);
    res.status(500).json({ error: 'Failed to fetch tiles' });
  }
});

/* ───────── GET /api/tiles/:userId - Alternative endpoint for user tiles ───────── */
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session.userId;

    console.log('[TILES] Alternative endpoint - Fetching tiles for user:', userId, 'session:', currentUserId);

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const tiles = await Tile.find({ userId }).sort({ createdAt: -1 });
    
    console.log('[TILES] Found tiles (alternative):', tiles.length);
    res.json(tiles);
  } catch (err) {
    console.error('[TILES] Error fetching tiles (alternative):', err);
    res.status(500).json({ error: 'Failed to fetch tiles' });
  }
});

/* ───────── POST /api/tiles - Create new tile ───────── */
router.post('/', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const { userId, type, content, x, y, w, h, title } = req.body;

    console.log('[TILES] Creating tile:', { userId, type, currentUserId });

    // Validate that user can create tiles for this userId
    if (userId !== currentUserId) {
      return res.status(403).json({ error: 'Cannot create tiles for other users' });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const tileData = {
      userId,
      type: type || 'text',
      content: content || '',
      title: title || '',
      x: Number(x) || 0,
      y: Number(y) || 0,
      w: Number(w) || 1,
      h: Number(h) || 1,
    };

    const tile = await Tile.create(tileData);
    console.log('[TILES] Created tile:', tile._id);
    
    res.status(201).json(tile);
  } catch (err) {
    console.error('[TILES] Error creating tile:', err);
    res.status(500).json({ error: 'Failed to create tile' });
  }
});

/* ───────── PATCH /api/tiles/:id - Update single tile ───────── */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.session.userId;
    const updates = req.body;

    console.log('[TILES] Updating tile:', id, 'updates:', updates);

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tile ID format' });
    }

    // Find tile and verify ownership
    const tile = await Tile.findById(id);
    if (!tile) {
      return res.status(404).json({ error: 'Tile not found' });
    }

    if (tile.userId.toString() !== currentUserId) {
      return res.status(403).json({ error: 'Cannot update tiles you do not own' });
    }

    // Update tile
    const updatedTile = await Tile.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    console.log('[TILES] Updated tile:', updatedTile._id);
    res.json(updatedTile);
  } catch (err) {
    console.error('[TILES] Error updating tile:', err);
    res.status(500).json({ error: 'Failed to update tile' });
  }
});

/* ───────── PATCH /api/tiles/bulk-layout - Update multiple tile layouts ───────── */
router.patch('/bulk-layout', requireAuth, async (req, res) => {
  try {
    const { updates } = req.body;
    const currentUserId = req.session.userId;

    console.log('[TILES] Bulk layout update request body:', req.body);
    console.log('[TILES] Updates array:', updates);
    console.log('[TILES] Current user ID:', currentUserId);

    if (!Array.isArray(updates)) {
      console.error('[TILES] Updates is not an array:', typeof updates);
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    if (updates.length === 0) {
      console.log('[TILES] No updates provided');
      return res.json({ updated: 0, tiles: [] });
    }

    const results = [];
    
    for (const update of updates) {
      const { _id, id, x, y, w, h } = update;
      const tileId = _id || id; // Handle both _id and id
      
      console.log('[TILES] Processing update for tile:', tileId, update);
      
      if (!tileId || !isValidObjectId(tileId)) {
        console.warn('[TILES] Skipping invalid tile ID:', tileId);
        continue;
      }

      try {
        // Verify ownership
        const tile = await Tile.findById(tileId);
        if (!tile) {
          console.warn('[TILES] Tile not found:', tileId);
          continue;
        }
        
        if (tile.userId.toString() !== currentUserId) {
          console.warn('[TILES] Tile not owned by user:', tileId, 'owner:', tile.userId, 'current:', currentUserId);
          continue;
        }

        // Update layout
        const updatedTile = await Tile.findByIdAndUpdate(
          tileId,
          { 
            x: Number(x) || 0, 
            y: Number(y) || 0, 
            w: Number(w) || 1, 
            h: Number(h) || 1,
            updatedAt: new Date()
          },
          { new: true }
        );

        if (updatedTile) {
          results.push(updatedTile);
          console.log('[TILES] Successfully updated tile:', tileId);
        }
      } catch (err) {
        console.error('[TILES] Error updating individual tile:', tileId, err);
      }
    }

    console.log('[TILES] Bulk update completed:', results.length, 'tiles updated');
    res.json({ updated: results.length, tiles: results });
  } catch (err) {
    console.error('[TILES] Error in bulk layout update:', err);
    res.status(500).json({ error: 'Failed to update tile layouts', details: err.message });
  }
});

/* ───────── DELETE /api/tiles/:id - Delete tile ───────── */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.session.userId;

    console.log('[TILES] Deleting tile:', id);

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid tile ID format' });
    }

    // Find tile and verify ownership
    const tile = await Tile.findById(id);
    if (!tile) {
      return res.status(404).json({ error: 'Tile not found' });
    }

    if (tile.userId.toString() !== currentUserId) {
      return res.status(403).json({ error: 'Cannot delete tiles you do not own' });
    }

    await Tile.findByIdAndDelete(id);
    console.log('[TILES] Deleted tile:', id);
    
    res.status(204).send();
  } catch (err) {
    console.error('[TILES] Error deleting tile:', err);
    res.status(500).json({ error: 'Failed to delete tile' });
  }
});

export default router;