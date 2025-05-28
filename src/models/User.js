// models/User.js
const userSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  username:   { type: String, required: true, unique: true },
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  accountType:{ type: String, enum: ['user','artist'], default: 'user' },

  // filled in *after* OAuth
  spotifyId:  { type: String, unique: true, sparse: true },   // ← add sparse
  refreshToken: String,
  accessToken:  String,
  tokenExpiresAt: Date,
}, { timestamps: true });

// keep the compound index explicit as well (good practice)
userSchema.index({ spotifyId: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('User', userSchema);
