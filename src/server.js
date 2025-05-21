import dotenv from 'dotenv';
dotenv.config();

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error('SPOTIFY credentials not loaded – check your .env file');
  process.exit(1);
}

import express  from 'express';
import mongoose from 'mongoose';
import cors     from 'cors';
import session  from 'cookie-session';

import spotifyRoutes from './routes/spotify.js';
import authRoutes    from './routes/auth.js';

const app = express();

app.use(
  session({
    name: 'session',
    secret: process.env.SESSION_SECRET || 'default-secret',
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  })
);

app.use(cors({
  origin: [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ],
  credentials: true,
}));

app.use(express.json());



app.use('/',    spotifyRoutes);
app.use('/auth', authRoutes);
app.use('/api',  authRoutes);


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.listen(8080, () => console.log('Server running on port 8080'));
