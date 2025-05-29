// models/Friend.js
import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema({
  userName: String,
  displayName: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  }
});

friendSchema.index({ location: '2dsphere' }); // for geo queries

const Friend = mongoose.model('Friend', friendSchema);
export default Friend;
