import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  spotifyId:    { type: String, required: false },
  username:     String,
  displayName:  String,
  password:     String, // ✅ Add this
  accountType:  String, // ✅ Add this
  photo:        String,
  email:        String,
  country:      String,
}, { timestamps: true });


const User = mongoose.model('User', userSchema);
export default User;
