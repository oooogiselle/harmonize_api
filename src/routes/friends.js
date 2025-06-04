import Friend from '../models/Friend.js';
import User   from '../models/User.js';

 router.post('/follow/:friendId', requireAuth, async (req, res) => {
   const userId   = req.session.userId;
   const friendId = req.params.friendId;

   if (userId === friendId)
     return res.status(400).json({ message: "You can’t follow yourself." });

   try {
    await Friend.findOneAndUpdate(
      { userId, friendId },
      {},
      { upsert: true, setDefaultsOnInsert: true }
    );

    const [current, target] = await Promise.all([
      User.findByIdAndUpdate(
        userId,
        { $addToSet: { following: friendId } },
        { new: true }
      ),
      User.findByIdAndUpdate(
        friendId,
        { $addToSet: { followers: userId } },
        { new: true }
      ),
    ]);

    res.status(201).json({ current, target });
   } catch (err) {
     console.error('[FOLLOW]', err);
     res.status(500).json({ message: 'Failed to follow', error: err.message });
   }
 });

 router.delete('/follow/:friendId', requireAuth, async (req, res) => {
   const userId   = req.session.userId;
   const friendId = req.params.friendId;

   try {
    await Friend.findOneAndDelete({ userId, friendId }); // ok if not found

    const [current, target] = await Promise.all([
      User.findByIdAndUpdate(
        userId,
        { $pull: { following: friendId } },
        { new: true }
      ),
      User.findByIdAndUpdate(
        friendId,
        { $pull: { followers: userId } },
        { new: true }
      ),
    ]);

    res.json({ current, target });
   } catch (err) {
     console.error('[UNFOLLOW]', err);
     res.status(500).json({ message: 'Failed to unfollow', error: err.message });
   }
 });
