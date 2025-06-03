import { Router } from 'express';
import mongoose from 'mongoose';
import MusicPost from '../models/MusicPost.js';
import { authenticateSpotifyUser } from '../middleware/authMiddleware.js';

const router = Router();

// GET all music posts
router.get('/', async (req, res) => {
  try {
    const musicPosts = await MusicPost.find().sort({ createdAt: -1 });
    res.json(musicPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new music post (Spotify user only)
// router.post('/', authenticateSpotifyUser, async (req, res) => {
router.post('/', async (req, res) => {
  try {
    const {
      spotifyTrackId,
      title,
      artist,
      coverUrl,
      previewUrl,
      duration,
      caption,
      genre,
      tags
    } = req.body;

    if (!spotifyTrackId || !title || !artist) {
      return res.status(400).json({ error: 'Missing required track info' });
    }

    const postData = {
      spotifyTrackId,
      title,
      artist,
      uploadedBy: req.user?.id || null, // safe fallback if req.user is undefined
    };

    if (coverUrl) postData.coverUrl = coverUrl;
    if (previewUrl) postData.previewUrl = previewUrl;
    if (typeof duration === 'number') postData.duration = duration;
    if (caption) postData.caption = caption;
    if (genre) postData.genre = genre;
    if (Array.isArray(tags) && tags.length > 0) postData.tags = tags;

    const musicPost = new MusicPost(postData);
    await musicPost.save();

    res.status(201).json(musicPost);
  } catch (err) {
    console.error('Server error while creating post:', err);
    res.status(500).json({ error: 'Server error while creating post' });
  }
});

// LIKE a music post
router.post('/:id/like', async (req, res) => {
  const { userId } = req.user.id; // from authenticated user

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
    res.status(400).json({ error: err.message });
  }
});

// UNLIKE a music post
router.post('/:id/unlike', async (req, res) => {
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const musicPost = await MusicPost.findById(req.params.id);
    if (!musicPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const index = musicPost.likedBy.findIndex(
      (id) => id.toString() === userId
    );

    if (index !== -1) {
      musicPost.likedBy.splice(index, 1);
      musicPost.likes = Math.max(0, musicPost.likes - 1); // prevent negative
      await musicPost.save();
    }

    res.json(musicPost);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to unlike post' });
  }
});

export default router;
