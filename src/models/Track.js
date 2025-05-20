import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const trackSchema = new Schema({
  title:     { type: String, required: true },
  artistId:  { type: Schema.Types.ObjectId, ref: 'Artist', required: true },
  audioUrl:  String,
  coverArtUrl:String,
  tags:      [String],
  visibility:{ type: String, enum:['public','demo','preview'], default:'public' },
  likes:     [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments:  [{
    userId:   { type: Schema.Types.ObjectId, ref: 'User' },
    content:  String,
    timestamp:{ type: Date, default: Date.now }
  }]
}, { timestamps:true });

export default model('Track', trackSchema);
