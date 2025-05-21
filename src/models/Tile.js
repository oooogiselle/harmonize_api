// models/Tile.js
import mongoose from 'mongoose';

const tileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },          // e.g., 'text', 'artist', etc.
  content: { type: mongoose.Schema.Types.Mixed },  // Flexible data per type
  x: Number,
  y: Number,
  w: Number,
  h: Number,
  bgColor: String,
  bgImage: String,
  font: String,
}, { timestamps: true });

export default mongoose.model('Tile', tileSchema);
