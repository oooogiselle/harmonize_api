import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const playlistSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required:true },
  name:   { type: String, required:true },
  trackIds:[{ type: Schema.Types.ObjectId, ref:'Track' }],
  isPublic:{ type: Boolean, default:false }
}, { timestamps:true });

export default model('Playlist', playlistSchema);
