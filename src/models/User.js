import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  displayName: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  bio: {
    type: String,
    default: '',
  },
  avatar: String,

  email: {
    type: String,
    unique: true,
    sparse: true,
  },
  password: String,

  accountType: {
    type: String,
    enum: ['user', 'artist'],
    default: 'user',
  },

  spotifyId: {
    type: String,
    unique: true,
    sparse: true,
  },

  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  spotifyAccessToken: String,
  spotifyRefreshToken: String,
  spotifyTokenExpiresAt: Date,

  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
      required: false,
    }
  }
}, {
  timestamps: true,
});

userSchema.index({ location: '2dsphere' });

const User = mongoose.model('User', userSchema);
export default User;
