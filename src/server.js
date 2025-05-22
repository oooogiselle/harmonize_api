import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'cookie-session';

import authRoutes    from './routes/auth.js';      // login + callback + /api/me/spotify
import spotifyRoutes from './routes/spotify.js';   // ONLY refresh or artist helpers
import artistRoutes  from './routes/artists.js';
import eventRoutes   from './routes/events.js';

dotenv.config();

const {
  PORT               = 8080,
  MONGO_URI,
  SESSION_SECRET,
} = process.env;

const FRONTEND = 'https://project-music-and-memories-umzm.onrender.com';

const app = express();

/* ───────── session – must send cookie cross‑site ───────── */
app.use(
  session({
    name:     'session',
    secret:   SESSION_SECRET,
    maxAge:   24 * 60 * 60 * 1000,
    sameSite: 'none',   // allow cross‑site
    secure:   true,     // required with 'none'
  }),
);

/* ───────── CORS ───────── */
app.use(
  cors({
    origin: [ 'http://127.0.0.1:5173', FRONTEND ],
    credentials: true,
  }),
);

app.use(express.json());

/* ───────── routes ───────── */
app.use('/',          authRoutes);        // /login, /spotify/callback, /api/me/spotify
app.use('/spotify',   spotifyRoutes);     // /refresh  (no duplicate callback)
app.use('/artists',   artistRoutes);
app.use('/events',    eventRoutes);

/* ───────── DB + start ───────── */
mongoose.connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => { console.error(err); process.exit(1); });

app.listen(PORT, () => console.log(`Server on ${PORT}`));
