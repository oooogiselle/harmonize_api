import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const graphSchema = new Schema({
  user1:{ type: Schema.Types.ObjectId, ref:'User', required:true },
  user2:{ type: Schema.Types.ObjectId, ref:'User', required:true },
  overlapScore:Number,
  sharedArtists:[String],
  differentGenres:[String],
  generatedAt:{ type: Date, default: Date.now }
});

export default model('MusicTasteGraph', graphSchema);
