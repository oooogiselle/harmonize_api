import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
      spotifyId:   { type: String },     // optional until Spotify is linked
  
      username:    { type: String, required: true, unique: true },
      displayName: { type: String, required: true },
  
      /* NEW ── local-auth fields */
      password:    { type: String },     // hashed
      accountType: { type: String, enum: ['user', 'artist'], default: 'user' },
  
      /* OPTIONAL profile extras */
      email:       { type: String, unique: true, sparse: true }, // sparse ⇒ many nulls allowed
      photo:       String,
      country:     String,
    },
    { timestamps: true },
  );


const User = mongoose.model('User', userSchema);
export default User;
