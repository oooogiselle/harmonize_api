import mongoose from 'mongoose';

const tileSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:    { type: String, required: true },
    title:   { type: String },
    content: { type: String },
    bgImage: { type: String },
    bgColor: { type: String },
    font:    { type: String },
    x: Number, 
    y: Number, 
    w: Number, 
    h: Number,
  },
  { timestamps: true }
);

const Tile = mongoose.model('Tile', tileSchema);
export default Tile;