// routes/users.js
import { Router }   from 'express';
import mongoose     from 'mongoose';
import User         from '../models/User.js';
import { requireAuth } from './auth.js';   // assumes this sets req.user / req.session

const router = Router();

/* ────────────────────────────────────────────────────────── */
/*  SEARCH USERS (excludes you)                               */
/* ────────────────────────────────────────────────────────── */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q = '' } = req.query;
    const currentUserId = req.user?.id || req.session?.userId;   // whichever you store

    const query = {
      _id: { $ne: currentUserId },   // never show me
      ...(q.trim() && {
        $or: [
          { displayName: { $regex: q, $options: 'i' } },
          { username:    { $regex: q, $options: 'i' } },
        ],
      }),
    };

    const users = await User.find(query)
      .select('_id username displayName avatar')  // avatar is handy for dropdown
      .limit(20);

    res.json(users);
  } catch (err) {
    console.error('[USERS] Error searching users:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/* ────────────────────────────────────────────────────────── */
/*  FOLLOW / UNFOLLOW                                         */
/*    POST   /api/users/:id/follow     (follow)               */
/*    DELETE /api/users/:id/follow     (unfollow)             */
/* ────────────────────────────────────────────────────────── */
router.post('/:id/follow', requireAuth, async (req, res, next) => {
  if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const current = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { following: req.params.id } },
      { new: true, session }
    ).select('_id username displayName avatar following followers');

    const target = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { followers: req.user.id } },
      { new: true, session }
    ).select('_id username displayName avatar following followers');

    await session.commitTransaction();
    res.status(201).json({ current, target });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

router.delete('/:id/follow', requireAuth, async (req, res, next) => {
  if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot unfollow yourself' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const current = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { following: req.params.id } },
      { new: true, session }
    ).select('_id username displayName avatar following followers');

    const target = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { followers: req.user.id } },
      { new: true, session }
    ).select('_id username displayName avatar following followers');

    await session.commitTransaction();
    res.json({ current, target });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

/* OPTIONAL helpers – convenient for the Friends page
   GET /api/users/:id/following
   GET /api/users/:id/followers                                         */
router.get('/:id/following', requireAuth, async (req, res) => {
  const user = await User.findById(req.params.id)
                         .populate('following', '_id username displayName avatar');
  res.json(user?.following ?? []);
});

router.get('/:id/followers', requireAuth, async (req, res) => {
  const user = await User.findById(req.params.id)
                         .populate('followers', '_id username displayName avatar');
  res.json(user?.followers ?? []);
});

/* ────────────────────────────────────────────────────────── */
/*  SPOTIFY TOP ARTISTS (kept as-is, but moved below search)  */
/* ────────────────────────────────────────────────────────── */
router.get('/:userId/top-artists', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user || !user.spotifyAccessToken) {
      return res.status(404).json({ error: 'User not found or Spotify not connected' });
    }

    const { getUserSpotifyClient } = await import('../spotifyClient.js');
    const spotify = await getUserSpotifyClient(user);

    const result = await spotify.getMyTopArtists({ time_range: 'medium_term', limit: 20 });
    const artists = result.body.items.map(a => ({
      id:    a.id,
      name:  a.name,
      images:a.images,
      genres:a.genres,
      popularity:a.popularity,
    }));

    res.json({ items: artists });
  } catch (err) {
    console.error('Error fetching user top artists:', err);
    res.status(500).json({ error: 'Failed to fetch user top artists' });
  }
});

/* ────────────────────────────────────────────────────────── */
/*  GENERAL CRUD ROUTES (unchanged from your original)        */
/* ────────────────────────────────────────────────────────── */

// Get all users
router.get('/', async (req, res) => {
  const users = await User.find().select('-passwordHash');
  res.json(users);
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: 'Failed to create user', err });
  }
});

// Add favorite track
router.patch('/:id/favorite', async (req, res) => {
  const { trackId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { favoriteTracks: trackId } },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(400).json({ msg: 'Failed to add favorite track', err });
  }
});

// Get user by ID  (keep this LAST of all “/:param” routes)
router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate('favoriteTracks', 'title')
    .populate('friends',        'username');   // if you still store `friends`
  res.json(user);
});

// Update user
router.patch('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(400).json({ msg: 'Failed to update user', err });
  }
});

export default router;
