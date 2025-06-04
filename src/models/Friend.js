// models/Friend.js
import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema({
  userId: { type: String, required: true },        // the one who is following
  friendId: { type: String, required: true },      // the one being followed
  createdAt: { type: Date, default: Date.now },
});

friendSchema.index({ userId: 1, friendId: 1 }, { unique: true }); // prevent duplicates

const Friend = mongoose.model('Friend', friendSchema);
export default Friend;
