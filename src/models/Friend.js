import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema(
  {
    /* follower */ userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /* followee */ friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

friendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

export default mongoose.model('Friend', friendSchema);
