import mongoose from 'mongoose';

const MusicPostSchema = new mongoose.Schema({
    spotifyTrackId: { type: String, required: true },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    genre: { type: String },
    coverUrl: { type: String },
    previewUrl: { type: String },
    duration: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    playCount: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]  
})

export default mongoose.model('MusicPost', MusicPostSchema);