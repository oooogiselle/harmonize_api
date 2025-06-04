import { Router } from 'express';
import mongoose from 'mongoose';
import MusicPost from '../models/MusicPost.js';
import { getAccessToken } from '../spotifyClient.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = Router();

// GET all music posts
router.get('/', async (req, res) => {
  try {
    const musicPosts = await MusicPost.find()
      .populate('uploadedBy', 'displayName username')
      .sort({ createdAt: -1 });
    res.json(musicPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /spotify/search?q=track_name (public endpoint for search)
router.get('/spotify/search', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const accessToken = await getAccessToken();

    const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchRes.ok) {
      const err = await searchRes.json();
      console.error('Spotify search error:', err);
      return res.status(400).json({ error: 'Failed to fetch search results from Spotify' });
    }

    const data = await searchRes.json();
    res.json(data.tracks.items);
  } catch (err) {
    console.error('Spotify search error:', err);
    res.status(500).json({ error: 'Server error while searching Spotify' });
  }
});

// POST a new music post (logged in user only)
router.post('/', authenticateUser, async (req, res) => {
  const { spotifyTrackId, caption, genre, tags, title, artist, coverUrl, previewUrl, duration } = req.body;

  if (!spotifyTrackId) {
    return res.status(400).json({ error: 'Spotify track ID is required' });
  }

  try {
    let postData = {};

    // If track details are provided from frontend, use them
    if (title && artist) {
      postData = {
        spotifyTrackId,
        title,
        artist,
        coverUrl: coverUrl || '',
        previewUrl: previewUrl || '',
        duration: duration || null,
        caption: caption || '',
        genre: genre || '',
        tags: Array.isArray(tags) ? tags : [],
        uploadedBy: req.user._id,
      };
    } else {
      // Otherwise, fetch from Spotify API
      const accessToken = await getAccessToken();
      const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${spotifyTrackId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!trackRes.ok) {
        const err = await trackRes.json();
        console.error('Spotify track fetch error:', err);
        return res.status(400).json({ error: 'Failed to fetch track info from Spotify' });
      }

      const trackData = await trackRes.json();
      console.log('Track data:', trackData);

      postData = {
        spotifyTrackId,
        title: trackData.name,
        artist: trackData.artists.map((a) => a.name).join(', '),
        coverUrl: trackData.album.images?.[0]?.url || '',
        previewUrl: trackData.preview_url || '',
        duration: trackData.duration_ms ? Math.floor(trackData.duration_ms / 1000) : null,
        caption: caption || '',
        genre: genre || '',
        tags: Array.isArray(tags) ? tags : [],
        uploadedBy: req.user._id,
      };
    }

    // Validate required fields
    if (!postData.spotifyTrackId || !postData.title || !postData.artist) {
      return res.status(400).json({ error: 'Missing required track info' });
    }

    const musicPost = new MusicPost(postData);
    await musicPost.save();

    // Populate the user info before sending response
    await musicPost.populate('uploadedBy', 'displayName username');

    res.status(201).json(musicPost);
  } catch (err) {
    console.error('Server error while creating post:', err);
    res.status(500).json({ error: 'Server error while creating post' });
  }
});

// LIKE a music post (requires authentication)
router.post('/:id/like', async (req, res) => {
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const musicPost = await MusicPost.findById(req.params.id);
    if (!musicPost) return res.status(404).json({ error: 'Post not found' });

    if (!musicPost.likedBy.includes(userId)) {
      musicPost.likedBy.push(userId);
      musicPost.likes += 1;
      await musicPost.save();
    }

    res.json(musicPost);
  } catch (err) {
    console.error('Error liking post:', err);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// UNLIKE a music post (requires authentication)
router.post('/:id/unlike', async (req, res) => {
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const musicPost = await MusicPost.findById(req.params.id);
    if (!musicPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const index = musicPost.likedBy.findIndex(
      (id) => id.toString() === userId.toString()
    );

    if (index !== -1) {
      musicPost.likedBy.splice(index, 1);
      musicPost.likes = Math.max(0, musicPost.likes - 1);
      await musicPost.save();
    }

    res.json(musicPost);
  } catch (err) {
    console.error('Error unliking post:', err);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// GET user's own posts (requires authentication)
router.get('/my-posts', authenticateUser, async (req, res) => {
  try {
    const musicPosts = await MusicPost.find({ uploadedBy: req.user._id })
      .populate('uploadedBy', 'displayName username')
      .sort({ createdAt: -1 });
    res.json(musicPosts);
  } catch (err) {
    console.error('Error fetching user posts:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
