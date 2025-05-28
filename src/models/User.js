import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  username:    { type: String, required: true, unique: true },
  email:       { type: String, required: false, unique: true, sparse: true },
  password:    { type: String },
  accountType: { type: String, enum: ['user', 'artist'], default: 'user' },
  spotifyId:   { type: String, unique: true, sparse: true },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);
export default User;
