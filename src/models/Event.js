import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const eventSchema = new Schema({
  title:{ type: String, required:true },
  artistId:{ type: Schema.Types.ObjectId, ref:'Artist', required:true },
  location:{
    name:String,
    coordinates:{ type:[Number], required:true }   // [lng,lat]
  },
  date: { type: Date, required:true },
  description:String
}, { timestamps:true });

eventSchema.index({ location:'2dsphere' });

export default model('Event', eventSchema);
