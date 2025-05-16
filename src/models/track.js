import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true },
    artist:  String,
    genre:   [String],
    created: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default mongoose.model('Track', trackSchema);
