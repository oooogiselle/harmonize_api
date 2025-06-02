import mongoose from 'mongoose';

const MusicPostSchema = new mongoose.Schema({
    spotifyTrackId: { type: String, required: true }, // e.g., "spotify:track:abc123"
    title: { type: String, required: true },
    artist: { type: String, required: true },
    album: { type: String }, // optional
    genre: { type: String },
    caption: { type: String }, // user-added
    coverUrl: { type: String },
    previewUrl: { type: String }, // 30s preview URL from Spotify
    duration: { type: Number }, // in seconds
    tags: [{ type: String }],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional
    createdAt: { type: Date, default: Date.now },
    playCount: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]  
})

export default mongoose.model('MusicPost', MusicPostSchema);