import { Router } from 'express';
import mongoose from 'mongoose';
import MusicPost from '../models/MusicPost.js';
import { getAccessToken } from '../spotifyClient.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import spotifyPreviewFinder from 'spotify-preview-finder';

const router = Router();

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

    const enhancedTracks = await Promise.all(
      data.tracks.items.map(async (track) => {
        if (!track.preview_url) {
          try {
            const searchQuery = `${track.name} ${track.artists[0]?.name}`;
            console.log(`Finding preview for: ${searchQuery}`);

            const previewResult = await spotifyPreviewFinder(searchQuery, 1);
            
            if (previewResult.success && previewResult.results.length > 0) {
              const firstResult = previewResult.results[0];
              if (firstResult.previewUrls && firstResult.previewUrls.length > 0) {
                const previewUrl = firstResult.previewUrls[0];
                console.log(`Found preview URL: ${previewUrl}`);
                track.preview_url = previewUrl;
                track.preview_source = 'spotify-preview-finder';
              } else {
                console.log(`No preview URLs found for: ${track.name}`);
              }
            } else {
              console.log(`No preview found for: ${track.name}`);
            }
          } catch (error) {
            console.error(`Error finding preview for ${track.name}:`, error.message);
          }
        }
        return track;
      })
    );

    res.json(enhancedTracks);
  } catch (err) {
    console.error('Spotify search error:', err);
    res.status(500).json({ error: 'Server error while searching Spotify' });
  }
});

const findPreviewUrl = async (title, artist) => {
  try {
    const searchQuery = `${title} ${artist}`;
    console.log(`Attempting to find preview for: "${searchQuery}"`);

    const previewResult = await spotifyPreviewFinder(searchQuery, 1);
    
    if (previewResult.success && previewResult.results.length > 0) {
      const firstResult = previewResult.results[0];
      if (firstResult.previewUrls && firstResult.previewUrls.length > 0) {
        const previewUrl = firstResult.previewUrls[0];
        console.log(`Preview found: ${previewUrl}`);
        return {
          url: previewUrl,
          source: 'spotify-preview-finder',
          spotifyUrl: firstResult.spotifyUrl
        };
      }
    }
    
    console.log(`No preview found for: "${searchQuery}"`);
    return null;
  } catch (error) {
    console.error(`Error finding preview for "${title}" by "${artist}":`, error.message);
    return null;
  }
};

router.post('/', authenticateUser, async (req, res) => {
  const { spotifyTrackId, caption, genre, tags, title, artist, coverUrl, previewUrl, duration } = req.body;

  if (!spotifyTrackId) {
    return res.status(400).json({ error: 'Spotify track ID is required' });
  }

  try {
    let postData = {};

    if (title && artist) {
      let finalPreviewUrl = previewUrl;

      if (!finalPreviewUrl) {
        console.log('No preview URL provided, attempting to find one...');
        const previewData = await findPreviewUrl(title, artist);
        finalPreviewUrl = previewData?.url || '';
      }

      postData = {
        spotifyTrackId,
        title,
        artist,
        coverUrl: coverUrl || '',
        previewUrl: finalPreviewUrl || '',
        duration: duration || null,
        caption: caption || '',
        genre: genre || '',
        tags: Array.isArray(tags) ? tags : [],
        uploadedBy: req.user._id,
      };
    } else {
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

      let finalPreviewUrl = trackData.preview_url;
      if (!finalPreviewUrl) {
        console.log('No preview URL from Spotify, attempting to find one...');
        const previewData = await findPreviewUrl(trackData.name, trackData.artists.map((a) => a.name).join(', '));
        finalPreviewUrl = previewData?.url || '';
      }

      postData = {
        spotifyTrackId,
        title: trackData.name,
        artist: trackData.artists.map((a) => a.name).join(', '),
        coverUrl: trackData.album.images?.[0]?.url || '',
        previewUrl: finalPreviewUrl || '',
        duration: trackData.duration_ms ? Math.floor(trackData.duration_ms / 1000) : null,
        caption: caption || '',
        genre: genre || '',
        tags: Array.isArray(tags) ? tags : [],
        uploadedBy: req.user._id,
      };
    }

    if (!postData.spotifyTrackId || !postData.title || !postData.artist) {
      return res.status(400).json({ error: 'Missing required track info' });
    }

    const musicPost = new MusicPost(postData);
    await musicPost.save();

    await musicPost.populate('uploadedBy', 'displayName username');

    res.status(201).json(musicPost);
  } catch (err) {
    console.error('Server error while creating post:', err);
    res.status(500).json({ error: 'Server error while creating post' });
  }
});

router.post('/:id/like', authenticateUser, async (req, res) => {
  const userId = req.user._id;
  const postId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const musicPost = await MusicPost.findById(postId)
      .populate('uploadedBy', 'displayName username');
    ;
    if (!musicPost) return res.status(404).json({ error: 'Post not found' });

    const hasLiked = musicPost.likedBy.some(id => id.toString() === userId.toString());
    if (hasLiked) {
      return res.status(400).json({ error: 'Post already liked by user' });
    }

    musicPost.likedBy.push(userId);
    musicPost.likes = musicPost.likedBy.length;
    
    await musicPost.save();
    console.log(`User ${userId} liked post ${postId}. Total likes: ${musicPost.likes}`);

    res.json(musicPost);
  } catch (err) {
    console.error('Error liking post:', err);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

router.post('/:id/unlike', authenticateUser, async (req, res) => {
  const userId = req.user._id;
  const postId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const musicPost = await MusicPost.findById(postId);
    if (!musicPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userIndex = musicPost.likedBy.findIndex(id => id.toString() === userId.toString());

    if (userIndex === -1) {
      return res.status(400).json({ error: 'Post not liked by user' });
    }

    musicPost.likedBy.splice(userIndex, 1);
    musicPost.likes = musicPost.likedBy.length;

    await musicPost.save();
    
    console.log(`User ${userId} unliked post ${postId}. Total likes: ${musicPost.likes}`);
    res.json(musicPost);
  } catch (err) {
    console.error('Error unliking post:', err);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

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