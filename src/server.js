import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'cookie-session';

import authRoutes    from './routes/auth.js';      // login + callback + /api/me/spotify + register
import spotifyRoutes from './routes/spotify.js';   // /refresh
import artistRoutes  from './routes/artists.js';   // /artists/*
import eventRoutes   from './routes/events.js';    // /events/*
import meRoutes      from './routes/me.js';        // /api/me
import tilesRoutes from './routes/tiles.js';
import homeRoutes    from './routes/home.js';

dotenv.config();

const {
  PORT = 8080,
  MONGO_URI,
  SESSION_SECRET,
} = process.env;

const FRONTEND = 'https://project-music-and-memories-umzm.onrender.com';

const app = express();

/* ───────── Trust proxy for secure cookies ───────── */
app.set('trust proxy', 1);

/* ───────── Session cookie ───────── */
app.use(
  session({
    name: 'session',
    secret: SESSION_SECRET,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: 'none',
    secure: true,
  })
);

/* ───────── CORS config ───────── */
app.use(
  cors({
    origin: ['http://127.0.0.1:5173', FRONTEND],
    credentials: true,
  })
);

app.use(express.json());

/* ───────── Route setup ───────── */
app.use('/auth',          authRoutes);      // /login, /callback, /api/me/spotify, /auth/register
app.use('/spotify',   spotifyRoutes);   // /spotify/refresh
app.use('/artists',   artistRoutes);    // /artists/*
app.use('/events',    eventRoutes);     // /events/*
app.use('/',          meRoutes);        // /api/me
app.use('/api/tiles', tilesRoutes);
app.use('/',          homeRoutes);

/* ───────── DB connection ───────── */
mongoose.connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

/* ───────── Server startup ───────── */
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
