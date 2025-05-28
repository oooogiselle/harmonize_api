import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  username:    { type: String, required: true, unique: true },
  email:       { type: String, required: false, unique: true, sparse: true },
  password:    { type: String },
  accountType: { type: String, enum: ['user', 'artist'], default: 'user' },
  spotifyId: {
    type: String,
    unique: true,     // keep it unique so one Spotify acct == one Reverberate acct
    sparse: true      // <-- ALLOWS many docs without this field
    // ✗  NO default: ''            (delete if you currently have it)
    // ✗  NO `required: true` here  (you'll add it *after* OAuth succeeds)
  },}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);
export default User;
