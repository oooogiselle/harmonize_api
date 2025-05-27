import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
      spotifyId:   { type: String }, 
  
      username:    { type: String, required: true, unique: true },
      displayName: { type: String, required: true },
  
      password:    { type: String },
      accountType: { type: String, enum: ['user', 'artist'], default: 'user' },
  
      email:       { type: String, unique: true, sparse: true },
      photo:       String,
      country:     String,
    },
    { timestamps: true },
  );


const User = mongoose.model('User', userSchema);
export default User;
