import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  spotifyId:   { type: String, required: true, unique: true },
  username:    String,
  displayName: String,
  photo:       String,
  email:       String,
  country:     String,
  // You can add more user-related fields here if needed
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);
export default User;
