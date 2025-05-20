import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  bio: String,
  profileImage: String,
  topArtists:  [String],
  favoriteTracks: [{ type: Schema.Types.ObjectId, ref: 'Track' }],
  playlists:      [{ type: Schema.Types.ObjectId, ref: 'Playlist' }],
  friends:        [{ type: Schema.Types.ObjectId, ref: 'User' }],
  location: {
    city: String,
    coordinates: { type: [Number], default: undefined }
  }
}, { timestamps:true });

userSchema.index({ location: '2dsphere' });

export default model('User', userSchema);
