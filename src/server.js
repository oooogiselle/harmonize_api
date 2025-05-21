// src/server.js
import dotenv from 'dotenv';
dotenv.config();

// --- fail fast if env not loaded ---
if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error('❌  SPOTIFY credentials not loaded – check your .env file');
  process.exit(1);
}

import express  from 'express';
import mongoose from 'mongoose';
import cors     from 'cors';
import spotifyRoutes from './routes/spotify.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/', spotifyRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.listen(8080, () => console.log('Server running on port 8080'));
