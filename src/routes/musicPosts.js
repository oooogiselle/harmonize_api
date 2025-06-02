import { Router } from 'express';
import express from 'express';
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
router.post('/', authenticateSpotifyUser, async (req, res) => {
  try {
    const {
      spotifyTrackId,
      title,
      artist,
      album,
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

    const musicPost = new MusicPost({
      spotifyTrackId,
      title,
      artist,
      album,
      coverUrl,
      previewUrl,
      duration,
      caption,
      genre,
      tags,
      uploadedBy: req.user.id
    });

    await musicPost.save();
    res.status(201).json(musicPost);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// LIKE a music post
router.post('/:id/like', async (req, res) => {
  const { userId } = req.body;

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

export default router;
